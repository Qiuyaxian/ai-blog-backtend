import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { createTestApp } from './helpers/e2e-app';

describe('GET/POST /users/me', () => {
  let app: INestApplication;
  let conn: Connection;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    conn = app.get<Connection>(getConnectionToken());
  });

  beforeEach(async () => {
    await conn.collection('users').deleteMany({});
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'Alice',
        email: 'alice@example.com',
        password: 'abc12345',
      })
      .expect(201);
    userId = res.body.id;
  });

  afterAll(async () => {
    await conn.collection('users').deleteMany({});
    await app.close();
  });

  it('returns own profile for an authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('x-test-user', JSON.stringify({ id: userId, isAdmin: false }))
      .expect(200);
    expect(res.body).toMatchObject({
      id: userId,
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
    });
    expect(res.body).not.toHaveProperty('password');
  });

  it('updates own email and normalizes it to lowercase', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/me')
      .set('x-test-user', JSON.stringify({ id: userId, isAdmin: false }))
      .send({ email: 'NEW@Example.com' })
      .expect(200);
    expect(res.body.email).toBe('new@example.com');
  });

  it('returns 409 EMAIL_EXISTS when the new email is taken', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'Bob', email: 'bob@example.com', password: 'abc12345' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/users/me')
      .set('x-test-user', JSON.stringify({ id: userId, isAdmin: false }))
      .send({ email: 'bob@example.com' })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('returns 401 without the test-user header', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
    await request(app.getHttpServer()).post('/users/me').send({}).expect(401);
  });

  it('silently ignores isAdmin in the self-update body', async () => {
    // 全局白名单 forbidNonWhitelisted：多余字段直接 400，提权不可能落库
    await request(app.getHttpServer())
      .post('/users/me')
      .set('x-test-user', JSON.stringify({ id: userId, isAdmin: false }))
      .send({ isAdmin: true })
      .expect(400);

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('x-test-user', JSON.stringify({ id: userId, isAdmin: false }))
      .expect(200);
    expect(me.body.isAdmin).toBe(false);
  });

  it('returns 404 when the authenticated user no longer exists', async () => {
    await request(app.getHttpServer())
      .get('/users/me')
      .set(
        'x-test-user',
        JSON.stringify({ id: '65ab000000000000000000ff', isAdmin: false }),
      )
      .expect(404);
  });
});
