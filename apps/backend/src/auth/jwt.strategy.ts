import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly userCache = new Map<string, { user: any; expiresAt: number }>();
  private readonly cacheTtlMs = 15_000;

  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'edupoint-super-secret-key-2026',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const cached = this.userCache.get(payload.sub);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        faculty: true,
        class: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    const { password, ...safeUser } = user;
    this.userCache.set(payload.sub, {
      user: safeUser,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return safeUser;
  }
}
