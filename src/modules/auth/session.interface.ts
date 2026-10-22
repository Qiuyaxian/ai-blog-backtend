import { CurrentUser } from '../user/guards/current-user.interface';

/**
 * 登录会话：以不透明令牌的 sha256 摘要为键存入 Redis，值只保留用户 id。
 * 刻意不含角色/管理员标记——每请求经 UserService.getAuthPrincipal 回查库中当前值，
 * 软删即时 401、降权即时 403（ADR-004）。
 */
export interface SessionPayload {
  sub: string;
}

/** AuthGuard 注入到 request.user 的身份形状，沿用 001 CurrentUser 约定 */
export type AuthenticatedRequest = { user?: CurrentUser };
