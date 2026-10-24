import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ErrorResponse,
  LoginResultResponse,
  LogoutResultResponse,
} from '../../common/swagger/response-schemas';
import { AuthService, LoginResult } from './auth.service';
import { CurrentToken } from './decorators/current-token.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: '用户名或邮箱登录',
    description:
      '校验账号密码并签发不透明访问令牌；服务端会话存 Redis（默认 7 天）。密码错误/账号不存在/软删/锁定期间对外统一 401 INVALID_CREDENTIALS。',
  })
  @ApiResponse({
    status: 200,
    type: LoginResultResponse,
    description: '登录成功',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: '参数校验失败（VALIDATION_ERROR）',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '凭据无效、账号不存在或处于锁定期（INVALID_CREDENTIALS）',
  })
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  // 不打 @Public：经全局 AuthGuard 认证后方可登出
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth('Bearer')
  @ApiOperation({
    summary: '登出',
    description: '立即吊销当前令牌的服务端会话；登出后原令牌再访问返回 401。',
  })
  @ApiResponse({
    status: 200,
    type: LogoutResultResponse,
    description: '登出成功',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '无令牌、令牌无效/过期或已登出',
  })
  async logout(@CurrentToken() token: string): Promise<{ success: true }> {
    await this.authService.logout(token);
    return { success: true };
  }
}
