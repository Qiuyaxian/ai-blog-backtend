import { IsEmail, IsOptional, MaxLength } from 'class-validator';

/** 本人自助修改入参：当前仅支持改邮箱；刻意不声明 isAdmin */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
