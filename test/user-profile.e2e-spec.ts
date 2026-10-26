import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Connection, Types } from 'mongoose';
import * as request from 'supertest';
import { CacheService } from '../src/common/cache/cache.service';
import { authHeader, createTestApp, loginHelper } from './helpers/e2e-app';

describe('GET/POST /users/me', () => {
  let app: INestApplication;
  let conn: Connection;
  let cache: CacheService;
  let userId: string;
  let token: string;
  const credentials = { identifier: 'alice', password: 'abc12345' };
  let sessionKeys: string[];

  beforeAll(async () => {
    app = await createTestApp();
    conn = app.get<Connection>(getConnectionToken());
    cache = app.get(CacheService);
  }, 30000);

  beforeEach(async () => {
    await conn.collection('users').deleteMany({});
    sessionKeys = [];
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'Alice',
        email: 'alice@example.com',
        password: 'abc12345',
      })
      .expect(200);
    userId = res.body.data.id;
    token = await loginHelper(app, credentials);
    sessionKeys.push(sessionKey(token));
  });

  afterEach(async () => {
    await Promise.all(
      sessionKeys.map((key) => cache.del(key).catch(() => undefined)),
    );
  });

  afterAll(async () => {
    await conn.collection('users').deleteMany({});
    await app.close();
  });

  function sessionKey(raw: string): string {
    return 'auth:sess:' + createHash('sha256').update(raw).digest('hex');
  }

  it('returns own profile for an authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set(authHeader(token))
      .expect(200);
    expect(res.body.data).toMatchObject({
      id: userId,
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
    });
    expect(res.body.data).not.toHaveProperty('password');
    expect(Object.keys(res.body).sort()).toEqual(
      ['code', 'data', 'message', 'success'].sort(),
    );
  });

  it('updates own email and normalizes it to lowercase', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/me')
      .set(authHeader(token))
      .send({ email: 'NEW@Example.com' })
      .expect(200);
    expect(res.body.data.email).toBe('new@example.com');
  });

  it('returns 409 EMAIL_EXISTS when the new email is taken', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'Bob', email: 'bob@example.com', password: 'abc12345' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/users/me')
      .set(authHeader(token))
      .send({ email: 'bob@example.com' })
      .expect(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 409,
      data: null,
    });
    expect(res.body.message).toBe('邮箱已存在');
    expect(res.body).not.toHaveProperty('statusCode');
  });

  it('returns 401 without a token or with a malformed token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
    await request(app.getHttpServer()).post('/users/me').send({}).expect(401);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('silently ignores isAdmin in the self-update body', async () => {
    // 全局白名单 forbidNonWhitelisted：多余字段直接 400，提权不可能落库
    await request(app.getHttpServer())
      .post('/users/me')
      .set(authHeader(token))
      .send({ isAdmin: true })
      .expect(400);

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set(authHeader(token))
      .expect(200);
    expect(me.body.data.isAdmin).toBe(false);
  });

  it('returns 401 with an old token after the account is soft-deleted', async () => {
    await conn
      .collection('users')
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $set: { deletedAt: new Date() } },
      );
    await request(app.getHttpServer())
      .get('/users/me')
      .set(authHeader(token))
      .expect(401);
  });
});
