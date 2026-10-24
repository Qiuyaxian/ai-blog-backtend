import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/** 登录入参：identifier 为用户名或邮箱（归一化在 Service 内区分） */
export class LoginDto {
  @ApiProperty({
    description: '用户名或邮箱（首尾空白自动去除）',
    example: 'alice',
    minLength: 2,
    maxLength: 254,
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @Length(2, 254)
  identifier: string;

  // 登录路径只判非空与长度，不强制字符组合（注册强度已在创建时保证）
  @ApiProperty({
    description: '登录密码（明文经 HTTPS 传输，服务端仅存 bcrypt 哈希）',
    example: 'Passw0rd!',
    minLength: 8,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  password: string;
}
