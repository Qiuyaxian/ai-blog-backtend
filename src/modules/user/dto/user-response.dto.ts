import { ApiProperty } from '@nestjs/swagger';

/** 对外脱敏用户视图：固定 6 个字段，禁止出现 password/usernameLower/deletedAt/__v */
export class UserResponseDto {
  @ApiProperty({
    description: '用户 ID（24 位十六进制 MongoId）',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({ description: '用户名', example: 'alice' })
  username: string;

  @ApiProperty({ description: '邮箱', example: 'alice@example.com' })
  email: string;

  @ApiProperty({ description: '是否为管理员', example: false })
  isAdmin: boolean;

  @ApiProperty({
    description: '创建时间（ISO 8601）',
    type: String,
    format: 'date-time',
    example: '2026-10-24T01:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '最后更新时间（ISO 8601）',
    type: String,
    format: 'date-time',
    example: '2026-10-24T01:30:00.000Z',
  })
  updatedAt: Date;
}

/** toUserResponse 入参的最小结构（hydrated doc / lean 对象均可），不用 any */
type UserDocLike = {
  _id?: unknown;
  id?: unknown;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** 集中转换脱敏出参，任何接口返回用户一律经过此函数 */
export function toUserResponse(doc: UserDocLike): UserResponseDto {
  const rawId = doc._id ?? doc.id;
  return {
    id: String(rawId),
    username: doc.username,
    email: doc.email,
    isAdmin: doc.isAdmin,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
