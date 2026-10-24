import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * 注册入参。刻意不声明 isAdmin：
 * 全局 ValidationPipe 白名单保证提权字段无法经注册写入。
 */
export class CreateUserDto {
  @ApiProperty({
    description: '用户名（2–32 字符）',
    example: 'alice',
    minLength: 2,
    maxLength: 32,
  })
  @IsString()
  @Length(2, 32)
  username: string;

  @ApiProperty({
    description: '邮箱（合法邮箱格式，≤254 字符）',
    example: 'alice@example.com',
    format: 'email',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  email: string;

  // 8–64 位且必须同时含字母与数字
  @ApiProperty({
    description: '密码（8–64 位，必须同时含字母与数字）',
    example: 'abc12345',
    minLength: 8,
    maxLength: 64,
    pattern: '^(?=.*[a-zA-Z])(?=.*\\d).+$',
  })
  @IsString()
  @Length(8, 64)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
    message: 'password must contain both letters and digits',
  })
  password: string;
}
