import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, tap } from 'rxjs';

interface AccessLogEntry {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

/**
 * 访问日志：每请求一条结构化 JSON，入口生成 requestId 关联同请求日志。
 *
 * ponytail: 天花板=请求级 requestId 关联 + 访问日志 + 耗时；
 * 不做跨服务 TraceContext 传播、不导出指标。升级路径=接入统一 Trace 与指标设施。
 * 刻意不记录请求体，password 等敏感字段天然不落日志。
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      path: string;
      requestId?: string;
    }>();
    const res = http.getResponse<{
      setHeader: (key: string, value: string) => void;
    }>();

    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const start = Date.now();

    const emit = (statusCode: number): void => {
      const entry: AccessLogEntry = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode,
        durationMs: Date.now() - start,
      };
      const line = JSON.stringify(entry);
      if (statusCode >= 500) {
        this.logger.error(line);
      } else {
        this.logger.log(line);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => emit(http.getResponse<{ statusCode: number }>().statusCode),
        error: (err: unknown) =>
          emit(err instanceof HttpException ? err.getStatus() : 500),
      }),
    );
  }
}
