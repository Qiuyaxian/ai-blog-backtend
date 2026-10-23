import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CurrentUser } from '../user/guards/current-user.interface';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

type RequestWithUser = {
  headers: Record<string, string | undefined>;
  user?: CurrentUser;
};

/**
 * 全局鉴权 Guard（默认拒绝 + 白名单）。
 * Bearer 令牌 → Redis 会话 → Mongo 回查当前账号状态 → 注入 {id,isAdmin}。
 * 任何无法核验的情况（格式错、会话缺失、账号软删、依赖故障）一律 401（fail-closed）。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearer(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    // Redis 会话：异常/未命中均 401，不暴露内部细节（FR-015）
    let session: { sub: string } | null;
    try {
      session = await this.authService.resolveSession(token);
    } catch {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
    if (!session) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    // 回查库中当前账号：软删/不存在 401，查询故障 fail-closed
    let principal: { id: string; isAdmin: boolean } | null;
    try {
      principal = await this.userService.getAuthPrincipal(session.sub);
    } catch {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
    if (!principal) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    request.user = { id: principal.id, isAdmin: principal.isAdmin };
    return true;
  }

  /**
   * 从 Authorization 头提取 Bearer 令牌；scheme 大小写不敏感，令牌段非空。
   * 返回 null 表示格式不合法（无头/错 scheme/空令牌）。
   */
  private extractBearer(header: string | undefined): string | null {
    if (!header) {
      return null;
    }
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? match[1] : null;
  }
}
