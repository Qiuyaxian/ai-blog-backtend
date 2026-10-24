import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsMongoId } from 'class-validator';

/** 管理员提权/降权入参（管理员专用） */
export class SetAdminDto {
  @ApiProperty({
    description: '目标用户 ID（24 位十六进制 MongoId）',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  id: string;

  @ApiProperty({
    description: 'true 提权为管理员；false 降权为普通用户',
    example: true,
  })
  @IsBoolean()
  isAdmin: boolean;
}
