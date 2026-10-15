import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from './common/cache/cache.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './modules/user/user.module';
import { buildMongooseOptions } from './mongoose.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      // 根据 NODE_ENV 动态加载对应的 .env 文件
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
      isGlobal: true, // 设为全局，其他模块无需重复导入 ConfigModule
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService], // ConfigModule 已 isGlobal，无需再 imports: [ConfigModule]
      useFactory: buildMongooseOptions,
    }),
    CacheModule,
    HealthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
