import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthOnly } from '../user/guards/auth.decorators';
import { AuthService } from './auth.service';
import { CurrentToken } from './decorators/current-token.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginResultResponse } from './dto/login-result.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 成功外壳、data 类型、状态码、错误响应均全局处理（Swagger 插件推断 + wrapSuccessEnvelope），方法零响应注解
  @Public()
  @Post('login')
  @ApiOperation({
    summary: '用户名或邮箱登录',
    description:
      '校验账号密码并签发不透明访问令牌；服务端会话存 Redis（默认 7 天）。密码错误/账号不存在/软删/锁定期间对外统一 401 INVALID_CREDENTIALS。',
  })
  login(@Body() dto: LoginDto): Promise<LoginResultResponse> {
    // LoginResult（service）与 LoginResultResponse（文档模型）结构同构，TS 结构类型直接兼容
    return this.authService.login(dto);
  }

  // 不打 @Public：经全局 AuthGuard 认证后方可登出；AuthOnly 提供 Bearer 文档
  @AuthOnly()
  @Post('logout')
  @ApiOperation({
    summary: '登出',
    description: '立即吊销当前令牌的服务端会话；登出后原令牌再访问返回 401。',
  })
  async logout(@CurrentToken() token: string): Promise<null> {
    await this.authService.logout(token);
    return null;
  }
}
