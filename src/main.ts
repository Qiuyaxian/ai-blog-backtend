import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // 启用关闭钩子，确保 Mongoose 连接优雅释放（设计 §5.4）
  await app.listen(3000);
}
bootstrap();
