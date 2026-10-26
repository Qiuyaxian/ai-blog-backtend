import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/** 最小 express 风格响应桩，只记录 filter 写出的状态与 body */
function mockHost(path: string): {
  host: ArgumentsHost;
  res: Record<string, unknown>;
} {
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ path }),
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

/** 仿 Mongoose CastError（继承 Error 且带 kind/path/value） */
class CastError extends Error {
  kind = 'ObjectId';

  path = '_id';

  value = 'not-an-id';

  constructor() {
    super('Cast to ObjectId failed');
    this.name = 'CastError';
  }
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('业务异常输出统一错误外壳（success:false/数字 code=HTTP 状态/message/data:null，无 statusCode/path/time）', () => {
    const { host, res } = mockHost('/users');
    filter.catch(new ConflictException('USERNAME_EXISTS'), host);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual({
      success: false,
      code: 409,
      message: '用户名已存在',
      data: null,
    });
    expect(Object.keys(res.payload as object).sort()).toEqual(
      ['code', 'data', 'message', 'success'].sort(),
    );
    expect(res.payload).not.toHaveProperty('statusCode');
    expect(res.payload).not.toHaveProperty('path');
    expect(res.payload).not.toHaveProperty('time');
    expect(JSON.stringify(res.payload)).not.toMatch(/stack/i);
  });

  it('校验错误（message 数组）归一为数字 400，保留字段错误数组', () => {
    const { host, res } = mockHost('/users');
    filter.catch(
      new BadRequestException(['email must be an email', 'password too weak']),
      host,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({
      success: false,
      code: 400,
      message: ['email must be an email', 'password too weak'],
      data: null,
    });
    expect(res.payload).not.toHaveProperty('statusCode');
  });

  it('Mongoose CastError 映射为数字 400 与集中配置文案', () => {
    const { host, res } = mockHost('/users/detail');
    filter.catch(new CastError(), host);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({
      success: false,
      code: 400,
      message: '无效的资源 ID',
      data: null,
    });
  });

  it('未登记字符串 code 的 HttpException 外壳 code 仍输出数字状态，文案回退异常 message', () => {
    const { host, res } = mockHost('/users');
    filter.catch(new ConflictException('SOME_NEW_BIZ_CODE'), host);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({
      success: false,
      code: 409,
      data: null,
    });
    expect((res.payload as { message: string }).message).toBe(
      'SOME_NEW_BIZ_CODE',
    );
  });

  it('未知错误返回 500 统一外壳且不泄露内部细节', () => {
    const { host, res } = mockHost('/x');
    filter.catch(new Error('ECONNREFUSED /secret/path'), host);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({
      success: false,
      code: 500,
      message: '服务器内部错误',
      data: null,
    });
    expect(JSON.stringify(res.payload)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(res.payload)).not.toContain('/secret/path');
  });

  it('豁免路径 /health/ready 透传 Terminus 503 原始体，不套外壳', () => {
    const terminusResult = {
      status: 'error',
      info: {},
      error: { redis: { status: 'down' } },
      details: { redis: { status: 'down' } },
    };
    const { host, res } = mockHost('/health/ready');
    filter.catch(new ServiceUnavailableException(terminusResult), host);

    expect(res.statusCode).toBe(503);
    expect(res.payload).toEqual(terminusResult);
    expect(res.payload).not.toHaveProperty('success');
    expect(res.payload).not.toHaveProperty('code');
    expect(res.payload).not.toHaveProperty('data');
  });

  it('豁免路径 / 透传 HttpException 原始 response', () => {
    const { host, res } = mockHost('/');
    filter.catch(new ConflictException('raw conflict'), host);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual({
      message: 'raw conflict',
      error: 'Conflict',
      statusCode: 409,
    });
  });
});
