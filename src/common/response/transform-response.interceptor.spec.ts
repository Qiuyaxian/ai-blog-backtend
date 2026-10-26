import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import {
  ApiResponse,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
} from './response.constants';
import { TransformResponseInterceptor } from './transform-response.interceptor';

/** 构造仅含 switchToHttp 的最小 context 桩 */
function mockContext(
  path: string,
  status: { code?: number } = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path }),
      getResponse: () => ({ status: (code: number) => (status.code = code) }),
    }),
  } as unknown as ExecutionContext;
}

function mockHandler(payload$: Observable<unknown>): CallHandler {
  return { handle: () => payload$ };
}

describe('TransformResponseInterceptor', () => {
  const interceptor = new TransformResponseInterceptor();

  it('对象返回值包成四字段统一外壳，data 引用保留', (done) => {
    const payload = { id: 'u1', username: 'alice' };
    interceptor
      .intercept(mockContext('/users/me'), mockHandler(of(payload)))
      .subscribe({
        next: (body) => {
          const envelope = body as ApiResponse<typeof payload>;
          expect(envelope).toEqual({
            success: true,
            code: 200,
            message: SUCCESS_MESSAGE,
            data: payload,
          });
          expect(envelope.code).toBe(SUCCESS_CODE);
          expect(typeof envelope.code).toBe('number');
          expect(envelope.data).toBe(payload);
          expect(envelope).not.toHaveProperty('path');
          expect(envelope).not.toHaveProperty('time');
        },
        complete: done,
      });
  });

  it.each([
    ['null', null],
    ['空数组', []],
    ['空对象', {}],
  ])('data 支持 %s，不丢弃不替换', (_label, payload) => {
    let body: ApiResponse<unknown> | undefined;
    interceptor
      .intercept(mockContext('/users'), mockHandler(of(payload)))
      .subscribe({
        next: (value) => {
          body = value as ApiResponse<unknown>;
        },
      });
    expect(body).toEqual({
      success: true,
      code: SUCCESS_CODE,
      message: SUCCESS_MESSAGE,
      data: payload,
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

  it.each([
    ['GET 查询', '/users/me'],
    ['POST 创建资源', '/users'],
    ['POST 动作', '/auth/login'],
    ['POST 管理动作', '/users/delete'],
    ['PUT（项目禁用但兜底）', '/users/u1'],
  ])('%s 成功状态码统一为 200', (_label, path) => {
    const status: { code?: number } = {};
    interceptor
      .intercept(mockContext(path, status), mockHandler(of({ id: 'u1' })))
      .subscribe(() => undefined);
    expect(status.code).toBe(200);
  });

  it('豁免路径成功时不改写状态码（status 桩不被调用）', () => {
    const status: { code?: number } = {};
    interceptor
      .intercept(
        mockContext('/health/live', status),
        mockHandler(of({ status: 'up' })),
      )
      .subscribe(() => undefined);
    expect(status.code).toBeUndefined();
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
