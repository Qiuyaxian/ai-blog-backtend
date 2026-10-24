import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';

/** 本人自助修改入参：当前仅支持改邮箱；刻意不声明 isAdmin */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: '新邮箱（合法邮箱格式，≤254 字符）',
    example: 'alice-new@example.com',
    format: 'email',
    maxLength: 254,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
