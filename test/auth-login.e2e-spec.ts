import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Connection, Types } from 'mongoose';
import * as request from 'supertest';
import { CacheService } from '../src/common/cache/cache.service';
import { authHeader, createTestApp } from './helpers/e2e-app';

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

  async function login(
    overrides: { identifier?: string; password?: string } = {},
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: overrides.identifier ?? 'alice',
        password: overrides.password ?? 'abc12345',
      })
      .expect(200);
    rememberSessionKey(res.body.token);
    return res.body.token as string;
  }

  describe('US2 bearer authorization', () => {
    it('accepts a valid token on /users/me with the correct identity', async () => {
      const created = await register();
      const token = await login();
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set(authHeader(token))
        .expect(200);
      expect(res.body).toMatchObject({
        username: created.username,
        email: created.email,
      });
    });

    it('returns 401 with no header or a bad token', async () => {
      await register();
      await request(app.getHttpServer()).get('/users/me').expect(401);
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer forged-token-value')
        .expect(401);
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Basic abc')
        .expect(401);
    });

    it('returns 403 when a normal user token hits an admin route', async () => {
      await register();
      const token = await login();
      await request(app.getHttpServer())
        .get('/users')
        .set(authHeader(token))
        .expect(403);
    });

    it('returns 401 with the old token after the account is soft-deleted', async () => {
      await register();
      const token = await login();
      const userDoc = await conn
        .collection('users')
        .findOne({ usernameLower: 'alice' });
      expect(userDoc).not.toBeNull();
      if (!userDoc) {
        throw new Error('test fixture user not found');
      }
      await conn
        .collection('users')
        .updateOne(
          { _id: new Types.ObjectId(userDoc._id) },
          { $set: { deletedAt: new Date() } },
        );
      await request(app.getHttpServer())
        .get('/users/me')
        .set(authHeader(token))
        .expect(401);
    });

    it('returns 403 on admin route after the logged-in admin is demoted directly in DB', async () => {
      await register({ username: 'boss', email: 'boss@example.com' });
      const adminDoc = await conn
        .collection('users')
        .findOne({ usernameLower: 'boss' });
      expect(adminDoc).not.toBeNull();
      if (!adminDoc) {
        throw new Error('test fixture admin not found');
      }
      await conn
        .collection('users')
        .updateOne(
          { _id: new Types.ObjectId(adminDoc._id) },
          { $set: { isAdmin: true } },
        );
      const token = await login({ identifier: 'boss' });

      // 降权前 admin 可访问
      await request(app.getHttpServer())
        .get('/users?limit=1')
        .set(authHeader(token))
        .expect(200);

      await conn
        .collection('users')
        .updateOne(
          { _id: new Types.ObjectId(adminDoc._id) },
          { $set: { isAdmin: false } },
        );

      // 降权即时生效：同一旧令牌访问 admin 接口 403
      await request(app.getHttpServer())
        .get('/users?limit=1')
        .set(authHeader(token))
        .expect(403);
    });
  });

  describe('US3 logout', () => {
    it('revokes the token immediately: 200 then same token 401', async () => {
      await register();
      const token = await login();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set(authHeader(token))
        .expect(200)
        .expect((res) => expect(res.body).toEqual({ success: true }));

      await request(app.getHttpServer())
        .get('/users/me')
        .set(authHeader(token))
        .expect(401);
    });

    it('requires authentication for logout (no header -> 401)', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('keeps session B alive when session A is logged out', async () => {
      await register();
      const tokenA = await login();
      const tokenB = await login();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set(authHeader(tokenA))
        .expect(200);

      // A 已吊销
      await request(app.getHttpServer())
        .get('/users/me')
        .set(authHeader(tokenA))
        .expect(401);
      // B 不受影响
      await request(app.getHttpServer())
        .get('/users/me')
        .set(authHeader(tokenB))
        .expect(200);
    });
  });

  describe('US4 login failure lockout', () => {
    async function findUserId(usernameLower: string): Promise<string> {
      const doc = await conn.collection('users').findOne({ usernameLower });
      expect(doc).not.toBeNull();
      if (!doc) {
        throw new Error(`fixture user ${usernameLower} not found`);
      }
      return String(doc._id);
    }

    it('locks after 5 consecutive failures: 6th attempt with correct password still 401, lock key exists', async () => {
      await register();
      const userId = await findUserId('alice');
      const lockKey = `auth:lock:${userId}`;
      const failKey = `auth:fail:${userId}`;
      sessionKeys.push(lockKey, failKey);

      const first = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'alice', password: 'wrongpass1' })
        .expect(401);

      // 再错 4 次（共 5 次）
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ identifier: 'alice', password: 'wrongpass1' })
          .expect(401);
      }

      // 第 6 次：即使密码正确，锁定期仍 401，且响应体与密码错误字节级同构
      const sixth = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'alice', password: 'abc12345' })
        .expect(401);
      expect(sixth.body).toEqual(first.body);
      expect(JSON.stringify(sixth.body)).not.toMatch(
        /LOCKED|423|remaining|locked/i,
      );

      // 锁定键存在于 Redis（不在 Mongo）
      await expect(cache.get<string>(lockKey)).resolves.toBe('1');
    });

    it('never creates fail/lock keys for unknown identifiers; real account still logs in', async () => {
      await register();
      const aliceId = await findUserId('alice');
      sessionKeys.push(`auth:fail:${aliceId}`, `auth:lock:${aliceId}`);

      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ identifier: 'ghost-user', password: 'wrongpass1' })
          .expect(401);
      }

      // 不存在标识无任何计数键（fail/lock 都不写）
      const ghostId = '65ab000000000000000000ff';
      await expect(cache.get(`auth:fail:${ghostId}`)).resolves.toBeNull();
      await expect(cache.get(`auth:lock:${ghostId}`)).resolves.toBeNull();

      // 真实账号不受影响，可正常登录
      const ok = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'alice', password: 'abc12345' })
        .expect(200);
      rememberSessionKey(ok.body.token);
    });

    it('isolates lockout per account: locking A does not block B', async () => {
      await register();
      await register({ username: 'Bella', email: 'bella@example.com' });
      const aId = await findUserId('alice');
      sessionKeys.push(`auth:fail:${aId}`, `auth:lock:${aId}`);

      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ identifier: 'alice', password: 'wrongpass1' })
          .expect(401);
      }

      // 账号 B 仍可正常登录
      const loginB = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'bella', password: 'abc12345' })
        .expect(200);
      rememberSessionKey(loginB.body.token);
    });
  });
});
