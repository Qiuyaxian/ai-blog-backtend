import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { CacheService } from '../src/common/cache/cache.service';
import { createTestApp } from './helpers/e2e-app';

/**
 * US1 登录链路 E2E：注册 → 用户名/邮箱登录 → 401 统一错误。
 * 真实 mongod（ai_blog_test）+ redis；套件只清本用例产生的 Redis 逻辑键，禁止 flushdb。
 */
describe('POST /auth/login (e2e)', () => {
  let app: INestApplication;
  let conn: Connection;
  let cache: CacheService;
  let sessionKeys: string[];

  beforeAll(async () => {
    app = await createTestApp();
    conn = app.get<Connection>(getConnectionToken());
    cache = app.get(CacheService);
  }, 30000);

  beforeEach(async () => {
    await conn.collection('users').deleteMany({});
    sessionKeys = [];
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

  async function register(overrides: Record<string, unknown> = {}) {
    const body = {
      username: 'Alice',
      email: 'alice@example.com',
      password: 'abc12345',
      ...overrides,
    };
    await request(app.getHttpServer()).post('/users').send(body).expect(201);
    return body;
  }

  function rememberSessionKey(token: string): void {
    // 逻辑键（不含 keyPrefix，CacheService 内部叠加 local:）
    sessionKeys.push(
      'auth:sess:' + createHash('sha256').update(token).digest('hex'),
    );
  }

  it('logs in with username: 200 token/expiresAt/user without password', async () => {
    await register();
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'abc12345' })
      .expect(200);

    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    rememberSessionKey(res.body.token);

    const expiresAt = new Date(res.body.expiresAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt - Date.now()).toBeGreaterThan(sevenDays - 5000);
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(sevenDays);

    expect(res.body.user).toMatchObject({
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
    });
    expect(res.body.user.id).toEqual(expect.any(String));
    expect(res.body.user.createdAt).toEqual(expect.any(String));
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('usernameLower');
    expect(res.body.user).not.toHaveProperty('deletedAt');
  });

  it('logs in with spaced uppercase email', async () => {
    await register();
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: ' ALICE@EXAMPLE.COM ', password: 'abc12345' })
      .expect(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    rememberSessionKey(res.body.token);
  });

  it('returns 401 INVALID_CREDENTIALS for wrong password', async () => {
    await register();
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'wrongpass99' })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the same 401 shape for unknown identifier', async () => {
    await register();
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'wrongpass99' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'ghost', password: 'abc12345' })
      .expect(401);
    expect(unknown.body).toEqual(wrongPassword.body);
  });
});
