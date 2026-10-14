import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/** 统一错误体：{ code, message, statusCode }，不外泄 stack/内部路径 */
interface ErrorBody {
  code: string;
  message: string | string[];
  statusCode: number;
}

/** Mongoose CastError 的最小结构（非法 ObjectId），避免依赖 mongoose 内部类型导出 */
interface CastErrorLike {
  name: string;
  kind?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, code, message } = this.normalize(exception);

    if (status >= 500) {
      // 服务端错误留内部日志，但不向客户端回传细节
      this.logger.error(
        message,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorBody = {
      code,
      message,
      statusCode: status,
    };
    response.status(status).json(body);
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
      const response =
        typeof raw === 'string'
          ? { message: raw }
          : (raw as Record<string, unknown>);
      const message =
        (response.message as string | string[] | undefined) ??
        exception.message;

      // ValidationPipe 的非法输入：message 为字段错误数组，统一业务 code
      if (status === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
        return { status, code: 'VALIDATION_ERROR', message };
      }

      // Service 抛出的业务异常用字符串 message 承载稳定 code（如 USERNAME_EXISTS）
      if (typeof message === 'string') {
        return { status, code: message, message };
      }

      const code = (response.code as string | undefined) ?? 'ERROR';
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
