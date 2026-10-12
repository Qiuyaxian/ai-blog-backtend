import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';

/** readiness ping 结果节流窗口（ms），设计 §5.1：高频探针不放大 DB 抖动 */
const PING_CACHE_TTL_MS = 5000;

@Controller('health')
export class HealthController {
  private cachedReadiness: HealthCheckResult | null = null;

  private cachedAt = 0;

  constructor(
    private readonly health: HealthCheckService,
    private readonly mongooseIndicator: MongooseHealthIndicator,
  ) {}

  /** liveness：只反映进程存活，不打 DB（设计 §5.1，避免 DB 抖动引发 Pod 反复重启） */
  @Get('live')
  live(): { status: 'up' } {
    return { status: 'up' };
  }

  /** readiness：MongoDB ping，5s 内复用上次结果 */
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    const now = Date.now();
    if (this.cachedReadiness && now - this.cachedAt < PING_CACHE_TTL_MS) {
      return Promise.resolve(this.cachedReadiness);
    }
    return this.health
      .check([() => this.mongooseIndicator.pingCheck('mongodb')])
      .then((result) => {
        this.cachedReadiness = result;
        this.cachedAt = Date.now();
        return result;
      });
  }
}
