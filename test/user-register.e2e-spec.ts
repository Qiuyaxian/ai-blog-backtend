import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { createTestApp } from './helpers/e2e-app';

describe('POST /users (register)', () => {
  let app: INestApplication;
  let conn: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    conn = app.get<Connection>(getConnectionToken());
  });

  beforeEach(async () => {
    await conn.collection('users').deleteMany({});
  });

  afterAll(async () => {
    await conn.collection('users').deleteMany({});
    await app.close();
  });

  const validBody = {
    username: 'Alice',
    email: 'alice@example.com',
    password: 'abc12345',
  };

  it('registers a user: 200, sanitized body, isAdmin=false', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send(validBody)
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      code: 200,
      data: expect.objectContaining({
        username: 'Alice',
        email: 'alice@example.com',
        isAdmin: false,
      }),
      message: 'ok',
    });
    // 顶层恰为统一外壳四字段，无多余键
    expect(Object.keys(res.body).sort()).toEqual(
      ['code', 'data', 'message', 'success'].sort(),
    );
    expect(res.body.data.id).toEqual(expect.any(String));
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('usernameLower');
    expect(res.body.data).not.toHaveProperty('deletedAt');
    expect(res.body.data).not.toHaveProperty('__v');

    const doc = await conn
      .collection('users')
      .findOne({ usernameLower: 'alice' });
    expect(doc).not.toBeNull();
    expect(doc?.password).not.toBe('abc12345');
  });

  it('rejects duplicate username and email with 409, distinguished by message', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send(validBody)
      .expect(200);

    const dupName = await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, email: 'other@example.com' })
      .expect(409);
    expect(dupName.body.code).toBe(409);
    expect(dupName.body.message).toBe('用户名已存在');
    expect(dupName.body.data).toBeNull();
    expect(dupName.body).not.toHaveProperty('statusCode');

    const dupEmail = await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, username: 'Other' })
      .expect(409);
    expect(dupEmail.body).toMatchObject({
      success: false,
      code: 409,
      data: null,
    });
    expect(dupEmail.body.message).toBe('邮箱已存在');
  });

  it('is case-insensitive on username uniqueness', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send(validBody)
      .expect(200);
    await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, username: '  ALICE  ', email: 'caps@example.com' })
      .expect(409)
      .expect((res) => {
        expect(res.body.code).toBe(409);
        expect(res.body.message).toBe('用户名已存在');
      });
  });

  it('rejects weak password and bad email with 400', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, password: 'short' })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe(400);
        expect(Array.isArray(res.body.message)).toBe(true);
      });

    await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, email: 'not-an-email' })
      .expect(400);
  });

  it('never accepts isAdmin through registration', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        ...validBody,
        email: 'admin@example.com',
        username: 'admin',
        isAdmin: true,
      })
      .expect(400);
  });

  it('allows login with the new credentials immediately after register (US5)', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send(validBody)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'Alice', password: 'abc12345' })
      .expect(200);
    expect(res.body.data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.data.user).toMatchObject({ username: 'Alice' });
    expect(Object.keys(res.body).sort()).toEqual(
      ['code', 'data', 'message', 'success'].sort(),
    );
  });
});
