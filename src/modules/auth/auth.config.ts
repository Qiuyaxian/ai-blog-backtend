import { ConfigService } from '@nestjs/config';
import { SESSION_TTL_DEFAULT } from './auth.constants';

/** 会话 TTL 配置键（env）。 */
export const AUTH_TOKEN_TTL_KEY = 'AUTH_TOKEN_TTL_SECONDS';

/**
 * 读取会话 TTL（秒）：缺省 7 天；必须为正整数，否则启动 fail-fast。
 * 风格对齐 src/common/cache/redis.config.ts（只经 ConfigService，不直读 process.env）。
 */
export function getAuthTokenTtlSeconds(config: ConfigService): number {
  const raw = config.get<string>(AUTH_TOKEN_TTL_KEY);
  if (raw === undefined || raw.trim() === '') {
    return SESSION_TTL_DEFAULT;
  }
  const ttl = Number(raw);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error(
      `${AUTH_TOKEN_TTL_KEY} must be a positive integer (seconds), got: ${raw}`,
    );
  }
  return ttl;
}
