import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ServiceUnavailableException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, { count: number; resetAt: number }>();
  private readonly forgotAttempts = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private consumeLimit(store: Map<string, { count: number; resetAt: number }>, key: string, max: number, windowMs: number) {
    const now = Date.now();
    const current = store.get(key);
    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      throw new HttpException({ message: `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${retryAfterSeconds} giây.`, retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
    }
    current.count += 1;
  }

  async login(dto: LoginDto, ip = 'unknown') {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const limitKey = `${ip}:${normalizedEmail}`;
    this.consumeLimit(this.loginAttempts, limitKey, 5, 15 * 60 * 1000);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        faculty: true,
        class: { include: { faculty: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị tạm khóa bởi Quản trị viên');
    }

    if (!user.password) {
      throw new UnauthorizedException('Tài khoản chưa được thiết lập mật khẩu');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    this.loginAttempts.delete(limitKey);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      authVersion: user.authVersion,
    };

    const accessToken = this.jwtService.sign(payload);
    const { password, authVersion, ...safeUser } = user;

    return {
      accessToken,
      user: safeUser,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        faculty: true,
        class: { include: { faculty: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng');
    }

    const { password, authVersion, ...safeUser } = user;
    return safeUser;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new BadRequestException('Người dùng không hợp lệ');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: newHash,
        isFirstLogin: false,
        authVersion: { increment: 1 },
      },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async forgotPassword(email: string, ip = 'unknown') {
    // Không giả báo đã gửi email khi hệ thống chưa có mailer/token reset thật.
    // Không tra cứu email để tránh làm lộ tài khoản có tồn tại hay không.
    this.consumeLimit(this.forgotAttempts, ip, 3, 60 * 60 * 1000);
    void email;
    throw new ServiceUnavailableException('Chức năng gửi email đặt lại mật khẩu chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } });
    return { message: 'Đăng xuất thành công' };
  }
}
