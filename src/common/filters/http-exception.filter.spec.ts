import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/** 最小 express 风格响应桩，只记录 filter 写出的状态与 body */
function mockHost(body: unknown): {
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
      getRequest: () => ({ body }),
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

  it('passes through a business HttpException with its code and status', () => {
    const { host, res } = mockHost({});
    filter.catch(new ConflictException('USERNAME_EXISTS'), host);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({
      code: 'USERNAME_EXISTS',
      statusCode: 409,
    });
    expect(JSON.stringify(res.payload)).not.toMatch(/stack/i);
  });

  it('normalizes validation errors (array message) to VALIDATION_ERROR / 400', () => {
    const { host, res } = mockHost({ email: 'bad' });
    filter.catch(
      new BadRequestException(['email must be an email', 'password too weak']),
      host,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('maps a Mongoose CastError to INVALID_ID / 400', () => {
    const { host, res } = mockHost({});
    filter.catch(new CastError(), host);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ code: 'INVALID_ID', statusCode: 400 });
  });

  it('returns 500 for an unknown error without leaking internals', () => {
    const { host, res } = mockHost({});
    filter.catch(new Error('ECONNREFUSED /secret/path'), host);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
    expect(JSON.stringify(res.payload)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(res.payload)).not.toContain('/secret/path');
  });
});
