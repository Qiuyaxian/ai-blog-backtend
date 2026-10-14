import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as request from 'supertest';
import { createTestApp } from './helpers/e2e-app';

describe('admin user management', () => {
  let app: INestApplication;
  let conn: Connection;
  const adminHeader = () => ({
    'x-test-user': JSON.stringify({ id: adminId, isAdmin: true }),
  });
  const userHeader = (id: string) => ({
    'x-test-user': JSON.stringify({ id, isAdmin: false }),
  });
  let adminId: string;
  let targetId: string;

  beforeAll(async () => {
    app = await createTestApp();
    conn = app.get<Connection>(getConnectionToken());
  });

  beforeEach(async () => {
    await conn.collection('users').deleteMany({});

    const admin = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'root',
        email: 'root@example.com',
        password: 'abc12345',
      })
      .expect(201);
    adminId = admin.body.id;
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
      .expect(201);
    targetId = target.body.id;
  });

  afterAll(async () => {
    await conn.collection('users').deleteMany({});
    await app.close();
  });

  it('admin lists users with sanitized items', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?limit=10')
      .set(adminHeader())
      .expect(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0]).not.toHaveProperty('password');
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('admin gets a single user detail; bad id -> 400, missing -> 404', async () => {
    const ok = await request(app.getHttpServer())
      .get(`/users/detail?id=${targetId}`)
      .set(adminHeader())
      .expect(200);
    expect(ok.body.id).toBe(targetId);

    await request(app.getHttpServer())
      .get('/users/detail?id=bad-id')
      .set(adminHeader())
      .expect(400);

    await request(app.getHttpServer())
      .get('/users/detail?id=65ab000000000000000000ff')
      .set(adminHeader())
      .expect(404);
  });

  it('promotes and demotes a user', async () => {
    const promoted = await request(app.getHttpServer())
      .post('/users/admin')
      .set(adminHeader())
      .send({ id: targetId, isAdmin: true })
      .expect(200);
    expect(promoted.body.isAdmin).toBe(true);

    // 此时有两名管理员，降权 target 允许
    await request(app.getHttpServer())
      .post('/users/admin')
      .set(adminHeader())
      .send({ id: targetId, isAdmin: false })
      .expect(200)
      .expect((res) => expect(res.body.isAdmin).toBe(false));
  });

  it('protects the last admin from demotion and deletion', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/admin')
      .set(adminHeader())
      .send({ id: adminId, isAdmin: false })
      .expect(409);
    expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');

    const del = await request(app.getHttpServer())
      .post('/users/delete')
      .set(adminHeader())
      .send({ id: adminId })
      .expect(409);
    expect(del.body.code).toBe('LAST_ADMIN_PROTECTED');
  });

  it('soft-deletes a user: disappears from list/detail, record remains', async () => {
    const delRes = await request(app.getHttpServer())
      .post('/users/delete')
      .set(adminHeader())
      .send({ id: targetId })
      .expect(200);
    expect(delRes.body).toEqual({ id: targetId });

    const list = await request(app.getHttpServer())
      .get('/users')
      .set(adminHeader())
      .expect(200);
    expect(list.body.items.map((u: { id: string }) => u.id)).not.toContain(
      targetId,
    );

    await request(app.getHttpServer())
      .get(`/users/detail?id=${targetId}`)
      .set(adminHeader())
      .expect(404);

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
      .set(adminHeader())
      .send({ id: targetId })
      .expect(404);
  });

  it('forbids normal users (403) and anonymous (401) from admin routes', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
    await request(app.getHttpServer())
      .get('/users')
      .set(userHeader(targetId))
      .expect(403);
    await request(app.getHttpServer())
      .post('/users/admin')
      .set(userHeader(targetId))
      .send({ id: targetId, isAdmin: true })
      .expect(403);
    await request(app.getHttpServer())
      .post('/users/delete')
      .set(userHeader(targetId))
      .send({ id: targetId })
      .expect(403);
    await request(app.getHttpServer()).post('/users/delete').expect(401);
  });
});
