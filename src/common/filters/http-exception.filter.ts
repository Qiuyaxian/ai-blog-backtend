import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiResponse,
  isEnvelopeExcludedPath,
} from '../response/response.constants';

/** Mongoose CastError 的最小结构（非法 ObjectId），避免依赖 mongoose 内部类型导出 */
interface CastErrorLike {
  name: string;
  kind?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ path: string }>();
    const path = request.path;

    // 探针/根探活路径保持各自原生错误体（如 Terminus ready 503），不套统一外壳
    if (isEnvelopeExcludedPath(path)) {
      this.passthrough(exception, response);
      return;
    }

    const { status, code, message } = this.normalize(exception);

    if (status >= 500) {
      // 服务端错误留内部日志，但不向客户端回传细节
      this.logger.error(
        message,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiResponse<null> = {
      code,
      data: null,
      message,
      path,
      time: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  /** 豁免路径：原样透传异常状态与 body，不改写为统一外壳 */
  private passthrough(exception: unknown, response: Response): void {
    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json(exception.getResponse() as Record<string, unknown>);
      return;
    }
    this.logger.error(
      'unhandled',
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Internal server error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string | string[];
  } {
    // 非法 ObjectId 透传到查询时 Mongoose 抛 CastError，统一映射 400
    if (this.isCastError(exception)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_ID',
        message: 'invalid id',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const resp =
        typeof raw === 'string'
          ? { message: raw }
          : (raw as Record<string, unknown>);
      const message =
        (resp.message as string | string[] | undefined) ?? exception.message;

      // ValidationPipe 的非法输入：message 为字段错误数组，统一业务 code
      if (status === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
        return { status, code: 'VALIDATION_ERROR', message };
      }

      // Service 抛出的业务异常用字符串 message 承载稳定 code（如 USERNAME_EXISTS）
      if (typeof message === 'string') {
        return { status, code: message, message };
      }

      const code = (resp.code as string | undefined) ?? 'ERROR';
      return { status, code, message };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'internal server error',
    };
  }

  private isCastError(error: unknown): error is CastErrorLike {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { name?: string }).name === 'CastError'
    );
  }
}
