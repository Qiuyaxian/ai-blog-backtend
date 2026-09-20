import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      // 根据 NODE_ENV 动态加载对应的 .env 文件
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
      isGlobal: true, // 设为全局，其他模块无需重复导入 ConfigModule
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
