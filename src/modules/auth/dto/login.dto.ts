import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/** 登录入参：identifier 为用户名或邮箱（归一化在 Service 内区分） */
export class LoginDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @Length(2, 254)
  identifier: string;

  // 登录路径只判非空与长度，不强制字符组合（注册强度已在创建时保证）
  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  password: string;
}
