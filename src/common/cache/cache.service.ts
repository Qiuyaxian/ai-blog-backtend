import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

/**
 * 统一缓存服务——业务模块访问 Redis 的唯一入口（宪法原则 IV）。
 * 写入必须带正整数 TTL（秒），不提供永久写入口；读取未命中返回 null；删除幂等。
 * 失败一律上抛，不做静默降级（是否回源由业务模块决定）。
 */
@Injectable()
export class CacheService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Pick<Redis, 'set' | 'get' | 'del' | 'multi'>,
  ) {}

  /** 信任边界：键必须是非空字符串（契约 §2.1）；空白键不触达客户端 */
  private requireKey(key: string): void {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new TypeError(
        `cache key must be a non-empty string, got: ${String(key)}`,
      );
    }
  }

  /** 写入并设置过期（秒）。ttl 必须为正整数，否则 RangeError（FR-004）。 */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.requireKey(key);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError(
        `ttlSeconds must be a positive integer, got: ${String(ttlSeconds)}`,
      );
    }
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  /** 读取并反序列化；未命中（不存在/已过期）返回 null（FR-005），脏 JSON 抛错。 */
  async get<T>(key: string): Promise<T | null> {
    this.requireKey(key);
    const raw = await this.redis.get(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  /** 删除键；键不存在也成功（FR-006）。 */
  async del(key: string): Promise<void> {
    this.requireKey(key);
    await this.redis.del(key);
  }

  /**
   * 原子自增并刷新 TTL（multi 管道一次提交，滑动窗口计数用）。
   * 返回自增后的计数值。
   */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    this.requireKey(key);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError(
        `ttlSeconds must be a positive integer, got: ${String(ttlSeconds)}`,
      );
    }
    const replies = (await this.redis
      .multi()
      .incr(key)
      .expire(key, ttlSeconds)
      .exec()) as Array<[Error | null, number | null]>;
    const incrError = replies[0][0];
    if (incrError) {
      throw incrError;
    }
    return Number(replies[0][1]);
  }
}
