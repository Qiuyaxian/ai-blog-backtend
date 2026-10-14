import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * 注册入参。刻意不声明 isAdmin：
 * 全局 ValidationPipe 白名单保证提权字段无法经注册写入。
 */
export class CreateUserDto {
  @IsString()
  @Length(2, 32)
  username: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  // 8–64 位且必须同时含字母与数字
  @IsString()
  @Length(8, 64)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
    message: 'password must contain both letters and digits',
  })
  password: string;
}
