import { IsMongoId } from 'class-validator';

/** 管理员软删除入参（管理员专用） */
export class DeleteUserDto {
  @IsMongoId()
  id: string;
}
