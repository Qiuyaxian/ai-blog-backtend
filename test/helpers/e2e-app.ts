import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AccessLogInterceptor } from '../../src/common/interceptors/access-log.interceptor';
import { TransformResponseInterceptor } from '../../src/common/response/transform-response.interceptor';
import { setupSwagger } from '../../src/common/swagger/swagger';

/**
 * 自举测试应用。
 *
 * ponytail: 全局 ValidationPipe/Filter/Interceptor 与 src/main.ts 重复少量装配行，
 * 需手动保持同步（仅有的两个装配点）。鉴权经 AuthModule 的 APP_GUARD 自动生效，
 * 无测试桩 Guard。Swagger 装配与 src/main.ts 共用 setupSwagger。
 */
export async function createTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = 'local';
  // 与开发库隔离：E2E 写测试专用库
  process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/ai_blog_test';

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new AccessLogInterceptor(),
  );
  setupSwagger(app, app.get(ConfigService));
  await app.init();
  return app;
}

/** 登录凭据 */
export interface LoginCredential {
  identifier: string;
  password: string;
}

/** 经公开登录端点取真实 Bearer 令牌 */
export async function loginHelper(
  app: INestApplication,
  credential: LoginCredential,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send(credential)
    .expect(200);
  return res.body.data.token as string;
}

/** 组装 Bearer 认证头 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
