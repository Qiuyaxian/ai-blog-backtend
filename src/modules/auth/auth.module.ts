import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * 登录鉴权模块。CacheModule 为 @Global，CacheService/ConfigService 可直接注入；
 * 用户数据经 UserModule 导出的 UserService 只读协作。
 * 全局 AuthGuard（APP_GUARD）在 US2（T022）注册，本阶段不影响存量接口。
 */
@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
