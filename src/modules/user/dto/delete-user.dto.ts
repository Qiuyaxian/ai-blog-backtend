import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/** 管理员软删除入参（管理员专用） */
export class DeleteUserDto {
  @ApiProperty({
    description: '待软删除用户 ID（24 位十六进制 MongoId）',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  id: string;
}
