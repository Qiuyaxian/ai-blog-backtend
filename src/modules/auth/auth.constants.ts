/**
 * 登录鉴权模块的 Redis 逻辑键前缀与安全策略常量（003-user-login）。
 *
 * 逻辑键与 ioredis keyPrefix 叠加（如 local:auth:sess:<hash>）；
 * 阈值/锁定时长是安全策略，刻意不走环境变量，避免被错误配置放宽（research R7）。
 */

/** 会话键前缀，键尾为令牌的 sha256 摘要（不存原令牌）。 */
export const AUTH_SESSION_PREFIX = 'auth:sess:';

/** 同账号连续登录失败计数键前缀（滑动窗口）。 */
export const AUTH_FAIL_PREFIX = 'auth:fail:';

/** 账号锁定键前缀（固定窗口，键存在即锁定）。 */
export const AUTH_LOCK_PREFIX = 'auth:lock:';

/** 连续失败多少次后锁定。 */
export const FAIL_THRESHOLD = 5;

/** 锁定时长与失败计数窗口（秒，15 分钟）。 */
export const LOCK_TTL_SECONDS = 900;

/** 会话 TTL 缺省值（秒，7 天）；可经 AUTH_TOKEN_TTL_SECONDS 覆盖。 */
export const SESSION_TTL_DEFAULT = 604800;
