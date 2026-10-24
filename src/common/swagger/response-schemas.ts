import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../modules/user/dto/user-response.dto';

/** 登录成功响应：不透明访问令牌 + 过期时间 + 本人脱敏资料 */
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
    example: '2026-10-31T01:30:00.000Z',
  })
  expiresAt: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

/** 登出成功响应 */
export class LogoutResultResponse {
  @ApiProperty({ description: '固定为 true', example: true, enum: [true] })
  success: true;
}

/** 用户分页列表响应（_id 游标倒序） */
export class UserListPageResponse {
  @ApiProperty({
    type: [UserResponseDto],
    description: '本页用户（最多等于请求 limit，缺省 20/封顶 50）',
  })
  items: UserResponseDto[];

  @ApiProperty({
    description: '下一页游标（本页最后一条用户 ID）；无下一页时为 null',
    nullable: true,
    example: '507f1f77bcf86cd799439011',
  })
  nextCursor: string | null;
}

/** 软删除成功响应 */
export class DeleteResultResponse {
  @ApiProperty({
    description: '被软删除的用户 ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;
}

/** 全局统一错误响应（HttpExceptionFilter 产出，禁止泄露堆栈/内部路径） */
export class ErrorResponse {
  @ApiProperty({ description: '业务/错误码', example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({
    description: '错误信息；参数校验失败时为字段错误数组',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['password must be longer than or equal to 8 characters'],
  })
  message: string | string[];

  @ApiProperty({ description: 'HTTP 状态码', example: 400 })
  statusCode: number;
}
