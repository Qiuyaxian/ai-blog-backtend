import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AccessLogInterceptor } from './access-log.interceptor';

/** 收集 Logger 输出：成功走 log、异常走 error */
function spyLogger(interceptor: AccessLogInterceptor) {
  const lines: string[] = [];
  jest.spyOn(interceptor.logger, 'log').mockImplementation((line: string) => {
    lines.push(line);
  });
  jest.spyOn(interceptor.logger, 'error').mockImplementation((line: string) => {
    lines.push(line);
  });
  return lines;
}

function mockContext(body: Record<string, unknown>, statusCode = 200) {
  const headers: Record<string, string> = {};
  const req = { method: 'POST', path: '/users', body };
  const res = {
    statusCode,
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
    getHeader: (key: string) => headers[key],
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, req, res };
}

function nextWith(result: unknown): CallHandler {
  return { handle: () => of(result) } as CallHandler;
}

describe('AccessLogInterceptor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs one structured JSON line per successful request with a uuid requestId', (done) => {
    const interceptor = new AccessLogInterceptor();
    const lines = spyLogger(interceptor);
    const { context, req, res } = mockContext({ username: 'a' });

    interceptor.intercept(context, nextWith({ id: '1' })).subscribe({
      complete: () => {
        expect(lines).toHaveLength(1);
        const entry = JSON.parse(lines[0]);
        expect(entry).toMatchObject({
          method: 'POST',
          path: '/users',
          statusCode: 200,
        });
        expect(entry.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
        expect(typeof entry.durationMs).toBe('number');
        // requestId 挂到 request 与响应头，供同请求其他日志关联
        expect(req).toMatchObject({ requestId: entry.requestId });
        expect(res.getHeader('x-request-id')).toBe(entry.requestId);
        done();
      },
    });
  });

  it('logs the error path too, rethrows, and never prints the password', (done) => {
    const interceptor = new AccessLogInterceptor();
    const lines = spyLogger(interceptor);
    const { context } = mockContext({
      username: 'a',
      password: 'super-secret',
    });
    const handler = {
      handle: () => throwError(() => new Error('boom')),
    } as CallHandler;

    interceptor.intercept(context, handler).subscribe({
      error: (err: unknown) => {
        expect(err).toBeInstanceOf(Error);
        expect(lines).toHaveLength(1);
        const entry = JSON.parse(lines[0]);
        expect(entry.statusCode).toBe(500);
        expect(entry.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
        expect(lines[0]).not.toContain('super-secret');
        expect(lines[0]).not.toContain('password');
        done();
      },
    });
  });
});
