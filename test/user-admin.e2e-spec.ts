import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Connection, Types } from 'mongoose';
import * as request from 'supertest';
import { CacheService } from '../src/common/cache/cache.service';
import { authHeader, createTestApp, loginHelper } from './helpers/e2e-app';

describe('admin user management', () => {
  let app: INestApplication;
  let conn: Connection;
  let cache: CacheService;
  let adminId: string;
  let targetId: string;
  let adminToken: string;
  let userToken: string;
  let sessionKeys: string[];

  beforeAll(async () => {
    app = await createTestApp();
    conn = app.get<Connection>(getConnectionToken());
    cache = app.get(CacheService);
  }, 30000);

  beforeEach(async () => {
    await conn.collection('users').deleteMany({});
    sessionKeys = [];

    const admin = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'root',
        email: 'root@example.com',
        password: 'abc12345',
      })
      .expect(200);
    adminId = admin.body.data.id;
    // 测试库直接置管理员（绕过注册不提权的业务约束）
    await conn
      .collection('users')
      .updateOne(
        { _id: new Types.ObjectId(adminId) },
        { $set: { isAdmin: true } },
      );

    const target = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'bob', email: 'bob@example.com', password: 'abc12345' })
      .expect(200);
    targetId = target.body.data.id;

    adminToken = await loginHelper(app, {
      identifier: 'root',
      password: 'abc12345',
    });
    userToken = await loginHelper(app, {
      identifier: 'bob',
      password: 'abc12345',
    });
    sessionKeys.push(sessionKey(adminToken), sessionKey(userToken));
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

  it('admin lists users with page result {total,list,page,pageTotal,index}', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?page=1&pageSize=10')
      .set(authHeader(adminToken))
      .expect(200);
    expect(res.body.data).toMatchObject({
      total: 2,
      page: 1,
      pageTotal: 1,
      index: 1,
    });
    expect(res.body.data.list).toHaveLength(2);
    expect(res.body.data.list[0]).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('items');
    expect(res.body.data).not.toHaveProperty('nextCursor');
    expect(Object.keys(res.body).sort()).toEqual(
      ['code', 'data', 'message', 'success'].sort(),
    );
  });

  it('paginates by page/pageSize: second page index continues and out-of-range page is an empty 200', async () => {
    // 再造 20 个用户：连 root/bob 共 22，pageSize=20 → 第 2 页 2 条
    await conn.collection('users').insertMany(
      Array.from({ length: 20 }, (_, i) => ({
        username: `u${i}`,
        usernameLower: `u${i}`,
        email: `u${i}@example.com`,
        password: 'x',
        isAdmin: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );

    const p2 = await request(app.getHttpServer())
      .get('/users?page=2&pageSize=20')
      .set(authHeader(adminToken))
      .expect(200);
    expect(p2.body.data).toMatchObject({
      total: 22,
      page: 2,
      pageTotal: 2,
      index: 21,
    });
    expect(p2.body.data.list).toHaveLength(2);

    const over = await request(app.getHttpServer())
      .get('/users?page=99&pageSize=20')
      .set(authHeader(adminToken))
      .expect(200);
    expect(over.body.data.list).toEqual([]);
    expect(over.body.data).toMatchObject({ total: 22, page: 99, index: 1961 });
  });

  it('admin gets a single user detail; bad id -> 400, missing/soft-deleted -> 200 + data:null', async () => {
    const ok = await request(app.getHttpServer())
      .get(`/users/detail?id=${targetId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(ok.body.data.id).toBe(targetId);

    const badId = await request(app.getHttpServer())
      .get('/users/detail?id=bad-id')
      .set(authHeader(adminToken))
      .expect(400);
    expect(badId.body).toMatchObject({
      success: false,
      code: 400,
      data: null,
    });
    expect(badId.body.message).toBe('无效的资源 ID');
    expect(badId.body).not.toHaveProperty('statusCode');

    // 只读单查：不存在是合法空结果，200 + data:null（T031，不再是 404）
    const missing = await request(app.getHttpServer())
      .get('/users/detail?id=65ab000000000000000000ff')
      .set(authHeader(adminToken))
      .expect(200);
    expect(missing.body).toMatchObject({
      success: true,
      code: 200,
      data: null,
    });
  });

  it('promotes and demotes a user', async () => {
    const promoted = await request(app.getHttpServer())
      .post('/users/admin')
      .set(authHeader(adminToken))
      .send({ id: targetId, isAdmin: true })
      .expect(200);
    expect(promoted.body.data.isAdmin).toBe(true);

    // 此时有两名管理员，降权 target 允许
    await request(app.getHttpServer())
      .post('/users/admin')
      .set(authHeader(adminToken))
      .send({ id: targetId, isAdmin: false })
      .expect(200)
      .expect((res) => expect(res.body.data.isAdmin).toBe(false));
  });

  it('protects the last admin from demotion and deletion', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/admin')
      .set(authHeader(adminToken))
      .send({ id: adminId, isAdmin: false })
      .expect(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 409,
      data: null,
    });
    expect(res.body.message).toBe('最后一个管理员不可删除');
    expect(res.body).not.toHaveProperty('statusCode');

    const del = await request(app.getHttpServer())
      .post('/users/delete')
      .set(authHeader(adminToken))
      .send({ id: adminId })
      .expect(409);
    expect(del.body).toMatchObject({
      success: false,
      code: 409,
      data: null,
    });
    expect(del.body.message).toBe('最后一个管理员不可删除');
    expect(del.body).not.toHaveProperty('statusCode');
  });

  it('soft-deletes a user: disappears from list/detail, record remains', async () => {
    const delRes = await request(app.getHttpServer())
      .post('/users/delete')
      .set(authHeader(adminToken))
      .send({ id: targetId })
      .expect(200);
    expect(delRes.body.data).toBeNull();
    expect(Object.keys(delRes.body).sort()).toEqual(
      ['code', 'data', 'message', 'success'].sort(),
    );

    const list = await request(app.getHttpServer())
      .get('/users')
      .set(authHeader(adminToken))
      .expect(200);
    expect(list.body.data.list.map((u: { id: string }) => u.id)).not.toContain(
      targetId,
    );

    // 只读单查软删用户：200 + data:null（T031）
    const detail = await request(app.getHttpServer())
      .get(`/users/detail?id=${targetId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(detail.body.data).toBeNull();

    // 物理记录仍在且 deletedAt 已写
    const raw = await conn
      .collection('users')
      .findOne({ _id: new Types.ObjectId(targetId) });
    expect(raw).not.toBeNull();
    expect(raw?.deletedAt).toBeInstanceOf(Date);

    // 软删不释放唯一值：同名/邮箱再注册冲突
    await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'bob',
        email: 'bob2@example.com',
        password: 'abc12345',
      })
      .expect(409);

    // 重复删除 404
    await request(app.getHttpServer())
      .post('/users/delete')
      .set(authHeader(adminToken))
      .send({ id: targetId })
      .expect(404);
  });

  it('forbids normal users (403) and anonymous (401) from admin routes', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
    await request(app.getHttpServer())
      .get('/users')
      .set(authHeader(userToken))
      .expect(403);
    await request(app.getHttpServer())
      .post('/users/admin')
      .set(authHeader(userToken))
      .send({ id: targetId, isAdmin: true })
      .expect(403);
    await request(app.getHttpServer())
      .post('/users/delete')
      .set(authHeader(userToken))
      .send({ id: targetId })
      .expect(403);
    await request(app.getHttpServer()).post('/users/delete').expect(401);
  });
});
