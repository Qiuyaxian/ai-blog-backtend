import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

/**
 * 登录鉴权模块。CacheModule 为 @Global，CacheService/ConfigService 可直接注入；
 * 用户数据经 UserModule 导出的 UserService 只读协作。
 * AuthGuard 经 APP_GUARD 全局注册：默认拒绝，@Public() 白名单放行（契约 §4）。
 */
@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
