import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { SetAdminDto } from './dto/set-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { toUserResponse, UserResponseDto } from './dto/user-response.dto';
import { User, UserDocument } from './schemas/user.schema';

/** Mongoose 唯一索引冲突错误的最小结构 */
interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, number>;
}

function isDuplicateKey(err: unknown): err is MongoDuplicateKeyError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    // 大小写/空格归一：username 保留原大小写展示，唯一性按 usernameLower 裁决
    const username = dto.username.trim();
    const created = await this.userModel
      .create({
        username,
        usernameLower: username.toLowerCase(),
        email: dto.email.trim().toLowerCase(),
        // 注册永远不能提权：isAdmin 不取 dto
        isAdmin: false,
        password: await bcrypt.hash(dto.password, 10),
      })
      .catch((err: unknown) => {
        if (isDuplicateKey(err)) {
          throw new ConflictException(
            err.keyPattern?.usernameLower ? 'USERNAME_EXISTS' : 'EMAIL_EXISTS',
          );
        }
        throw err;
      });

    return this.toResponse(created);
  }

  async findById(id: string): Promise<UserResponseDto> {
    this.assertObjectId(id);
    const doc = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('USER_NOT_FOUND');
    }
    return toUserResponse(doc);
  }

  /**
   * 鉴权专用只读查询：返回会话回查所需的最小身份信息。
   * 软删/不存在返回 null（调用方 Guard 据此拒绝）；查询异常原样上抛（fail-closed）。
   */
  async getAuthPrincipal(
    id: string,
  ): Promise<{ id: string; isAdmin: boolean } | null> {
    const doc = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .select('_id isAdmin')
      .lean()
      .exec();
    if (!doc) {
      return null;
    }
    return { id: String(doc._id), isAdmin: doc.isAdmin };
  }

  async updateEmail(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.assertObjectId(userId);
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: userId, deletedAt: null },
        { $set: { email: dto.email?.trim().toLowerCase() } },
        { new: true, runValidators: true },
      )
      .lean()
      .exec()
      .catch((err: unknown) => {
        if (isDuplicateKey(err)) {
          throw new ConflictException('EMAIL_EXISTS');
        }
        throw err;
      });

    if (!updated) {
      throw new NotFoundException('USER_NOT_FOUND');
    }
    return toUserResponse(updated);
  }

  private assertObjectId(id: string): void {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('INVALID_ID');
    }
  }

  async list(query: UserQueryDto): Promise<{
    items: UserResponseDto[];
    nextCursor: string | null;
  }> {
    // 多取一条判断是否有下一页；按 _id 游标倒序
    const filter: { deletedAt: null; _id?: { $lt: Types.ObjectId } } = {
      deletedAt: null,
    };
    if (query.cursor) {
      this.assertObjectId(query.cursor);
      filter._id = { $lt: new Types.ObjectId(query.cursor) };
    }

    const docs = await this.userModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > query.limit;
    const page = hasMore ? docs.slice(0, query.limit) : docs;
    const last = page[page.length - 1];
    return {
      items: page.map((doc) => toUserResponse(doc)),
      nextCursor: hasMore && last ? String(last._id) : null,
    };
  }

  async setAdmin(dto: SetAdminDto): Promise<UserResponseDto> {
    this.assertObjectId(dto.id);

    // 降权前检查：至少保留一名未删除管理员
    if (!dto.isAdmin) {
      const adminCount = await this.userModel
        .countDocuments({ isAdmin: true, deletedAt: null })
        .exec();
      const target = await this.userModel
        .findOne({ _id: dto.id, deletedAt: null })
        .lean()
        .exec();
      if (target?.isAdmin && adminCount <= 1) {
        throw new ConflictException('LAST_ADMIN_PROTECTED');
      }
    }

    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: dto.id, deletedAt: null },
        { $set: { isAdmin: dto.isAdmin } },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException('USER_NOT_FOUND');
    }
    return toUserResponse(updated);
  }

  async softDelete(dto: DeleteUserDto): Promise<{ id: string }> {
    this.assertObjectId(dto.id);

    // 删除管理员前检查：最后一名未删除管理员不可删
    const target = await this.userModel
      .findOne({ _id: dto.id, deletedAt: null })
      .lean()
      .exec();
    if (!target) {
      throw new NotFoundException('USER_NOT_FOUND');
    }
    if (target.isAdmin) {
      const adminCount = await this.userModel
        .countDocuments({ isAdmin: true, deletedAt: null })
        .exec();
      if (adminCount <= 1) {
        throw new ConflictException('LAST_ADMIN_PROTECTED');
      }
    }

    const result = await this.userModel
      .updateOne(
        { _id: dto.id, deletedAt: null },
        { $set: { deletedAt: new Date() } },
      )
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException('USER_NOT_FOUND');
    }
    return { id: dto.id };
  }

  private toResponse(created: UserDocument): UserResponseDto {
    const maybeToObject = (created as { toObject?: () => unknown }).toObject;
    const plain = maybeToObject ? maybeToObject.call(created) : created;
    return toUserResponse(plain as Parameters<typeof toUserResponse>[0]);
  }
}
