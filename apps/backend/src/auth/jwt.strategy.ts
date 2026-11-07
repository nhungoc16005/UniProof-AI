import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET bắt buộc trong production'); })() : 'edupoint-local-development-only'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string; authVersion?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        faculty: true,
        class: { include: { faculty: true } },
      },
    });

    if (!user || !user.isActive || (payload.authVersion ?? 0) !== user.authVersion) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    const { password, authVersion, ...safeUser } = user;
    return safeUser;
  }
}
