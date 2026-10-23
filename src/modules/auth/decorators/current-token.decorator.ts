import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type RequestWithAuthorization = {
  headers: { authorization?: string };
};

/**
 * 从 Authorization 头取 Bearer 原始令牌注入控制器参数。
 * Controller 不直接依赖 @Req（分层规则）；令牌格式已由全局 AuthGuard 校验。
 */
export const CurrentToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuthorization>();
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? match[1] : undefined;
  },
);
