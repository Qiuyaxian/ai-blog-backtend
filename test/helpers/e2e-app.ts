import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AccessLogInterceptor } from '../../src/common/interceptors/access-log.interceptor';
import type { CurrentUser } from '../../src/modules/user/guards/current-user.interface';

/**
 * 测试桩：从 x-test-user 头（JSON {id,isAdmin}）写入 request.user；
 * 无头则不写，交由 RolesGuard 判 401/403。登录模块落地后删除本桩。
 */
@Injectable()
export class TestUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: CurrentUser }>();
    const raw = req.headers['x-test-user'];
    if (raw) {
      req.user = JSON.parse(raw) as CurrentUser;
    }
    return true;
  }
}

/**
 * 自举测试应用。
 *
 * ponytail: 全局 ValidationPipe/Filter/Interceptor 与 src/main.ts 重复约 3 行，
 * 需手动保持同步；登录模块落地后删除测试桩 Guard。
 */
export async function createTestApp() {
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
  app.useGlobalInterceptors(new AccessLogInterceptor());
  // 桩 Guard 在业务 Guard 之外预填 request.user，本身不拦截
  app.useGlobalGuards(new TestUserGuard());
  await app.init();
  return app;
}
