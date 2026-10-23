import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AccessLogInterceptor } from './common/interceptors/access-log.interceptor';
import { setupSwagger } from './common/swagger/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 全局入参校验：白名单剥离未声明字段、拒绝多余字段、payload 按 DTO 类型转型
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // 全局异常归一：业务 code 透传、校验错误 VALIDATION_ERROR、非法 ID INVALID_ID
  app.useGlobalFilters(new HttpExceptionFilter());
  // 全局访问日志：每请求一条结构化 JSON，requestId 挂请求对象与 x-request-id 响应头
  app.useGlobalInterceptors(new AccessLogInterceptor());
  app.enableShutdownHooks(); // 启用关闭钩子，确保 Mongoose 连接优雅释放（设计 §5.4）
  // Swagger 文档装配（/api-docs，production 自动关闭）；另一个装配点：test/helpers/e2e-app.ts
  setupSwagger(app, app.get(ConfigService));
  await app.listen(3000);
}
bootstrap();
