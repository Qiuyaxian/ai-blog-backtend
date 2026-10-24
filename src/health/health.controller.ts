import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from '../common/cache/redis.health';
import { Public } from '../modules/auth/decorators/public.decorator';

/** readiness ping 结果节流窗口（ms），设计 §5.1：高频探针不放大 DB 抖动 */
const PING_CACHE_TTL_MS = 5000;

@ApiTags('infra')
@Controller('health')
export class HealthController {
  private cachedReadiness: HealthCheckResult | null = null;

  private cachedAt = 0;

  constructor(
    private readonly health: HealthCheckService,
    private readonly mongooseIndicator: MongooseHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  /** liveness：只反映进程存活，不打 DB（设计 §5.1，避免 DB 抖动引发 Pod 反复重启） */
  @Public()
  @Get('live')
  @ApiOperation({
    summary: '存活探针（公开）',
    description: '只反映进程存活，不触达 MongoDB/Redis；正常返回 200。',
  })
  live(): { status: 'up' } {
    return { status: 'up' };
  }

  /** readiness：MongoDB 与 Redis ping，5s 内复用上次结果 */
  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: '就绪探针（公开）',
    description:
      '检查 MongoDB 与 Redis 连通性（结果 5s 节流）：全部正常 200；任一依赖不可用 503。',
  })
  ready(): Promise<HealthCheckResult> {
    const now = Date.now();
    if (this.cachedReadiness && now - this.cachedAt < PING_CACHE_TTL_MS) {
      return Promise.resolve(this.cachedReadiness);
    }
    return this.health
      .check([
        () => this.mongooseIndicator.pingCheck('mongodb'),
        () => this.redisIndicator.isHealthy('redis'),
      ])
      .then((result) => {
        this.cachedReadiness = result;
        this.cachedAt = Date.now();
        return result;
      });
  }
}
