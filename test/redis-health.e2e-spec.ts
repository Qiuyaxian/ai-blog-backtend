/**
 * Redis 健康检查 E2E（T015）。
 *
 * 前置：本地 redis-server 在运行（见 specs/002-redis-integration/quickstart.md §1），
 * 同时需要本地 MongoDB（createTestApp 自举整个 AppModule）。
 * 本用例不断 Redis：停服 down→恢复 up 的翻转由 T013 控制器测试 + T018 手工验证共同保证。
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './helpers/e2e-app';

describe('Redis health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(() => app.close());

  it('GET /health/ready reports redis up alongside mongodb', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(body.status).toBe('ok');
    expect(body.info.redis).toEqual({ status: 'up' });
    expect(body.info.mongodb).toEqual({ status: 'up' });
  });

  it('GET /health/live does not depend on redis details', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(body).toEqual({ status: 'up' });
  });
});
