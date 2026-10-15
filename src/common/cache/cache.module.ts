import {
  Global,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';
import { buildRedisOptions } from './redis.config';
import { CacheService } from './cache.service';
import { RedisHealthIndicator } from './redis.health';

export type RedisClient = Redis;

/**
 * 构造 Redis 单例并完成启动连通性校验（FR-008 fail-fast，research R3）。
 * lazyConnect 下：connect→ping 成功才返回；任一步失败则 disconnect 并 reject，中止应用启动。
 * 运行期断线由 ioredis 退避自动重连（FR-011），错误经 error 事件脱敏上屏（FR-012）。
 */
export async function createRedisClient(config: ConfigService): Promise<Redis> {
  const options = buildRedisOptions(config);
  const client = new Redis(options);

  // 运行期连接错误上屏：只打目标标识与错误首行，禁止输出 password / 缓存值（FR-012）
  const target = `${options.host}:${options.port}/${options.db}`;
  client.on('error', (err: Error) => {
    Logger.error(
      `[redis] connection error (${target}): ${err.name}: ${
        err.message.split('\n')[0]
      }`,
      'Redis',
    );
  });

  try {
    await client.connect();
    await client.ping();
  } catch (err) {
    client.disconnect();
    throw err;
  }
  return client;
}

const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Promise<Redis> =>
    createRedisClient(config),
};

/**
 * 全局缓存基础设施模块。
 * 导出 CacheService 与 RedisHealthIndicator（供 HealthModule readiness 注入）；
 * REDIS_CLIENT 不对外导出，业务无法绕过封装（宪法 II/IV）。
 *
 * ponytail: 全应用单 Redis 实例、单连接；多租户/分片需求出现时在此工厂改为连接池或
 * 按 key 前缀路由多实例，token 不变则业务零改动。
 */
@Global()
@Module({
  providers: [redisClientProvider, CacheService, RedisHealthIndicator],
  exports: [CacheService, RedisHealthIndicator],
})
export class CacheModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
