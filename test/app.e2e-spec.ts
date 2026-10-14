import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 测试统一环境：ConfigModule 按 NODE_ENV 读 .env.local，连接串与 createTestApp 一致
    process.env.NODE_ENV = 'local';
    process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/ai_blog';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // 首次连接 + autoIndex 建索引可能超过 Jest 默认 5s hook 超时
  }, 30000);

  afterAll(() => app.close());

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
