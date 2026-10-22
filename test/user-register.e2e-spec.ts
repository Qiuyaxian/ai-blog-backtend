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

  it('registers a user: 201, sanitized body, isAdmin=false', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send(validBody)
      .expect(201);

    expect(res.body).toMatchObject({
      username: 'Alice',
      email: 'alice@example.com',
      isAdmin: false,
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('usernameLower');
    expect(res.body).not.toHaveProperty('deletedAt');
    expect(res.body).not.toHaveProperty('__v');

    const doc = await conn
      .collection('users')
      .findOne({ usernameLower: 'alice' });
    expect(doc).not.toBeNull();
    expect(doc?.password).not.toBe('abc12345');
  });

  it('rejects duplicate username and email with 409 distinct codes', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send(validBody)
      .expect(201);

    const dupName = await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, email: 'other@example.com' })
      .expect(409);
    expect(dupName.body.code).toBe('USERNAME_EXISTS');

    const dupEmail = await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, username: 'Other' })
      .expect(409);
    expect(dupEmail.body.code).toBe('EMAIL_EXISTS');
  });

  it('is case-insensitive on username uniqueness', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send(validBody)
      .expect(201);
    await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, username: '  ALICE  ', email: 'caps@example.com' })
      .expect(409)
      .expect((res) => expect(res.body.code).toBe('USERNAME_EXISTS'));
  });

  it('rejects weak password and bad email with 400', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ ...validBody, password: 'short' })
      .expect(400)
      .expect((res) => expect(res.body.code).toBe('VALIDATION_ERROR'));

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
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'Alice', password: 'abc12345' })
      .expect(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.user).toMatchObject({ username: 'Alice' });
  });
});
