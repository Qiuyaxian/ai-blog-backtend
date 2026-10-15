import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';

/**
 * Redis 健康指示器（@nestjs/terminus 9 已移除内置 Redis 指示器，需自定义，见 research R2）。
 * 以一次 PING 判定连通性，结果并入 /health/ready。
 *
 * ponytail: 只 PING 单实例/单连接；升级哨兵/集群后改为检查 Sentinel master 或集群 nodes，
 * 并把多个节点结果聚合进 getStatus。
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Pick<Redis, 'ping'>,
  ) {
    super();
  }

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (err) {
      const result = this.getStatus(key, false, {
        message: (err as Error).message,
      });
      throw new HealthCheckError(`${key} failed`, result);
    }
  }
}
