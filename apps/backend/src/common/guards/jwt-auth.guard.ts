import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException, Optional } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ALLOW_FIRST_LOGIN_KEY } from '../decorators/allow-first-login.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Optional() private reflector?: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const valid = await super.canActivate(context);
    if (!valid) return false;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (user && user.isFirstLogin) {
      const allowFirstLogin = this.reflector?.getAllAndOverride<boolean>(ALLOW_FIRST_LOGIN_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowFirstLogin) {
        throw new ForbiddenException({
          code: 'FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED',
          message: 'Tài khoản yêu cầu đổi mật khẩu lần đầu trước khi thực hiện thao tác nghiệp vụ',
        });
      }
    }
    return true;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return user;
  }
}
