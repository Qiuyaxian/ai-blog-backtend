import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  isEnvelopeExcludedPath,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
} from './response.constants';

/**
 * 全局成功响应封装：业务接口返回值统一包进
 * { code, data, message, path, time }；异常不处理（交全局异常过滤器）。
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
    const path = context.switchToHttp().getRequest<{ path: string }>().path;

    if (isEnvelopeExcludedPath(path)) {
      return next.handle();
    }

    return next.handle().pipe(
      map(
        (data): ApiResponse<T> => ({
          code: SUCCESS_CODE,
          data,
          message: SUCCESS_MESSAGE,
          path,
          time: new Date().toISOString(),
        }),
      ),
    );
  }
}
