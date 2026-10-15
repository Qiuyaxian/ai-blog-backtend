import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

/** 建连超时（ms）：启动 ping fail-fast 不被无限阻塞 */
const CONNECT_TIMEOUT_MS = 5000;
/** 单命令超时（ms） */
const COMMAND_TIMEOUT_MS = 3000;
/** 单命令在抖动期的最大重试次数，到点 reject 而非无限等待 */
const MAX_RETRIES_PER_REQUEST = 3;
/** 自动重连退避上限（ms）：自定义线性退避（times*100），封顶 2s，永不放弃 */
const RECONNECT_MAX_DELAY_MS = 2000;

/**
 * Redis 连接选项，设计 §3.2 / research R3/R4/R8。
 * 抽成纯函数便于复用与单测：fail-fast、离线快速失败、自动重连、键前缀集中在此。
 */
export function buildRedisOptions(config: ConfigService): RedisOptions {
  const host = config.get<string>('REDIS_HOST');
  if (!host) {
    // 不给默认地址：配置缺失必须显式暴露，避免静默连向非预期实例（FR-008）
    throw new Error('REDIS_HOST is required but was not provided');
  }

  const password = config.get<string>('REDIS_PASSWORD') || undefined;
  const keyPrefix =
    config.get<string>('REDIS_KEY_PREFIX') ||
    `${process.env.NODE_ENV || 'local'}:`;

  return {
    host,
    port: Number(config.get<string>('REDIS_PORT', '6379')),
    db: Number(config.get<string>('REDIS_DB', '0')),
    ...(password ? { password } : {}),
    keyPrefix,
    // 延迟到模块工厂内显式 ping：连不通即中止启动（fail-fast）
    lazyConnect: true,
    // 断连期命令立即失败，不排队挂起、不静默成功（FR-010）
    enableOfflineQueue: false,
    maxRetriesPerRequest: MAX_RETRIES_PER_REQUEST,
    connectTimeout: CONNECT_TIMEOUT_MS,
    commandTimeout: COMMAND_TIMEOUT_MS,
    // 自动重连：自定义线性退避（times*100）封顶 2s，恢复后无需重启（FR-011）
    retryStrategy: (times: number) =>
      Math.min(times * 100, RECONNECT_MAX_DELAY_MS),
  };
}
