import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../user/dto/user-response.dto';

/** 登录结果数据（登录接口返回类型，Swagger 插件据此推断外壳 data 类型） */
export class LoginResultResponse {
  @ApiProperty({
    description:
      '不透明访问令牌（调用受保护接口时放入 Authorization: Bearer <token>）',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  })
  token: string;

  @ApiProperty({
    description: '会话过期时间（ISO 8601，默认 7 天后）',
    type: String,
    format: 'date-time',
    example: '2026-11-02T01:30:00.000Z',
  })
  expiresAt: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
