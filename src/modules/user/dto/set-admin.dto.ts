import { IsBoolean, IsMongoId } from 'class-validator';

/** 管理员提权/降权入参（管理员专用） */
export class SetAdminDto {
  @IsMongoId()
  id: string;

  @IsBoolean()
  isAdmin: boolean;
}
