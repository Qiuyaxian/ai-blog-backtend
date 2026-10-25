import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { TransformResponseInterceptor } from './transform-response.interceptor';
import {
  ApiResponse,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
} from './response.constants';

/** 构造仅含 switchToHttp 的最小 context 桩 */
function mockContext(path: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path }),
    }),
  } as unknown as ExecutionContext;
}

function mockHandler(payload$: Observable<unknown>): CallHandler {
  return { handle: () => payload$ };
}

describe('TransformResponseInterceptor', () => {
  const interceptor = new TransformResponseInterceptor();

  it('业务路径：返回值包成五字段统一外壳', (done) => {
    const payload = { id: 'u1', username: 'alice' };
    interceptor
      .intercept(mockContext('/users/me'), mockHandler(of(payload)))
      .subscribe({
        next: (body) => {
          const envelope = body as ApiResponse<typeof payload>;
          expect(envelope).toEqual({
            code: SUCCESS_CODE,
            data: payload,
            message: SUCCESS_MESSAGE,
            path: '/users/me',
            time: expect.any(String),
          });
          expect(envelope.data).toBe(payload);
          expect(new Date(envelope.time).getTime()).not.toBeNaN();
        },
        complete: done,
      });
  });

  it('豁免路径 /health/live：原样透传不包裹', (done) => {
    const payload = { status: 'up' };
    interceptor
      .intercept(mockContext('/health/live'), mockHandler(of(payload)))
      .subscribe({
        next: (body) => expect(body).toBe(payload),
        complete: done,
      });
  });

  it('豁免路径 /：原样透传纯文本', (done) => {
    interceptor
      .intercept(mockContext('/'), mockHandler(of('Hello World!')))
      .subscribe({
        next: (body) => expect(body).toBe('Hello World!'),
        complete: done,
      });
  });

  it('异常不被吞掉，继续流向异常过滤器', (done) => {
    const error = new Error('boom');
    interceptor
      .intercept(mockContext('/users'), mockHandler(throwError(() => error)))
      .subscribe({
        next: () => done(new Error('不应进入 next')),
        error: (err) => {
          expect(err).toBe(error);
          done();
        },
      });
  });
});
