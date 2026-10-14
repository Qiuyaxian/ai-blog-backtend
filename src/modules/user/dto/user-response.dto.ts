/** 对外脱敏用户视图：固定 6 个字段，禁止出现 password/usernameLower/deletedAt/__v */
export class UserResponseDto {
  id: string;

  username: string;

  email: string;

  isAdmin: boolean;

  createdAt: Date;

  updatedAt: Date;
}

/** toUserResponse 入参的最小结构（hydrated doc / lean 对象均可），不用 any */
type UserDocLike = {
  _id?: unknown;
  id?: unknown;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** 集中转换脱敏出参，任何接口返回用户一律经过此函数 */
export function toUserResponse(doc: UserDocLike): UserResponseDto {
  const rawId = doc._id ?? doc.id;
  return {
    id: String(rawId),
    username: doc.username,
    email: doc.email,
    isAdmin: doc.isAdmin,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
