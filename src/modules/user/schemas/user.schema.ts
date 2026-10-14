import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 32 })
  username: string;

  // 归一化（trim+lowercase）后的用户名，承载大小写不敏感唯一索引；不对外返回。
  // lowercase/trim 与 Service 归一化双保险，唯一索引为最终裁决
  @Prop({
    required: true,
    unique: true,
    select: false,
    lowercase: true,
    trim: true,
  })
  usernameLower: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true, default: false })
  isAdmin: boolean;

  @Prop({ default: null, select: false })
  deletedAt: Date | null;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
