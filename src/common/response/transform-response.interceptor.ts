import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map, tap } from 'rxjs';
import {
  ApiResponse,
  isEnvelopeExcludedPath,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
} from './response.constants';

/**
 * 全局成功响应封装：业务接口返回值统一包进
 * { success, code, message, data }；异常不处理（交全局异常过滤器）。
 *
 * data 原样保留：null / [] / {} / 任意业务对象均不丢弃、不替换。
 *
 * ponytail: 天花板=仅封装 Controller 正常返回的 JSON body；
 * 不支持流式响应/文件下载（当前不存在此类接口）。
 * 升级路径=按响应 content-type 或路由 metadata 细化判定。
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const http = context.switchToHttp();
    const { path } = http.getRequest<{
      path: string;
    }>();

    if (isEnvelopeExcludedPath(path)) {
      return next.handle();
    }

    // 成功状态码统一为 200，免除逐接口 @HttpCode
    const response = http.getResponse<{ status: (code: number) => void }>();

    return next.handle().pipe(
      tap(() => response.status(HttpStatus.OK)),
      map(
        (data): ApiResponse<T> => ({
          success: true,
          code: SUCCESS_CODE,
          message: SUCCESS_MESSAGE,
          data,
        }),
      ),
    );
  }
}
