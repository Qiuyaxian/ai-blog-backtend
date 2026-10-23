import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService, LoginResult } from './auth.service';
import { CurrentToken } from './decorators/current-token.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  // 不打 @Public：经全局 AuthGuard 认证后方可登出
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentToken() token: string): Promise<{ success: true }> {
    await this.authService.logout(token);
    return { success: true };
  }
}
