/**
 * request.user 的读取约定。
 * 由后续登录模块（令牌解析中间件/守卫）注入；本模块只依赖此形状，不实现令牌解析。
 */
export interface CurrentUser {
  id: string;
  isAdmin: boolean;
}
