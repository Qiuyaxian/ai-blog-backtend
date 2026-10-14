import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CurrentUser } from './current-user.interface';

export const ROLES_KEY = 'roles';

/** 标记路由所需角色；不带此装饰器时 Guard 仅做"已登录"检查 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUser }>().user;

    if (!user) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 认证-only 模式：路由未声明角色要求，任何已登录用户放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (requiredRoles.includes('admin') && !user.isAdmin) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return true;
  }
}
