# 用户模块设计文档

> 状态：已确认（Confirmed）
> 日期：2026-10-13（2026-10-14 代码评审通过后转 Confirmed）
>
> 状态枚举遵循 `AGENTS.md` §9.2。本文是 [ADR-002](../adr/ADR-002-user-module.md) 的实现展开，配套功能规格 `specs/001-user-module/spec.md` 与实现计划 `specs/001-user-module/plan.md`。通用 Mongoose 集成约定（连接、注入、索引、分页、ObjectId 校验）见 [MongoDB + NestJS 集成设计文档](./mongodb-integration-design.md)，本文不重复。

## 1. 概述

**文档目的**：定义用户模块的目录结构、数据模型、接口分层、权限判定、密码安全与错误映射，作为编码与测试的实现依据。

**适用范围**：账号注册、本人资料查看与修改、管理员查看（列表/详情）、调整管理员标记与软删除用户。不含登录/会话/令牌签发（后续认证功能）、账号物理删除、用户自助注销、密码找回与自助改密。

**技术栈**：NestJS 9、`@nestjs/mongoose` 9 + Mongoose 6、MongoDB 7（与 ADR-001 基线一致）。

## 2. 模块结构

按宪法原则 II，业务域固定分层：

```text
src/modules/user/
├── user.module.ts
├── user.controller.ts
├── user.service.ts
├── dto/
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   ├── set-admin.dto.ts
│   ├── delete-user.dto.ts
│   ├── user-query.dto.ts
│   └── user-response.dto.ts      # 脱敏出参
├── schemas/
│   └── user.schema.ts
└── guards/
    ├── roles.guard.ts            # 角色判定（认证态由后续登录模块提供）
    └── current-user.interface.ts # request.user 读取约定
```

- 模块经 `MongooseModule.forFeature` 注册 `User`，`exports: [UserService]`，供未来文章/评论模块通过 Service 引用用户，禁止跨模块直连 Schema。
- Controller 不写业务逻辑；Service 不接触 `@Req/@Res`。

## 3. 数据模型

### 3.1 字段定义

| 字段            | 类型    | 约束/选项                                                             | 说明                         |
| --------------- | ------- | --------------------------------------------------------------------- | ---------------------------- |
| `username`      | string  | `required`、`trim`、`minlength: 2`、`maxlength: 32`                   | 展示与登录名，保留原大小写   |
| `usernameLower` | string  | `required`、`trim`、`lowercase`、唯一索引，不落响应                   | 大小写不敏感唯一性裁决字段   |
| `email`         | string  | `required`、`trim`、`lowercase`、`maxlength: 254`、邮箱正则、唯一索引 | 联系方式与登录标识，落库小写 |
| `password`      | string  | `required`，仅存 bcrypt 哈希，不落响应、不进日志                      | 强度在 DTO 校验明文          |
| `isAdmin`       | boolean | 非必填，`default: false`，仅管理员（超管）可更新                      | 是否管理员（超管）           |
| `createdAt`     | Date    | `timestamps` 自动                                                     | 创建时间                     |
| `updatedAt`     | Date    | `timestamps` 自动                                                     | 更新时间                     |
| `deletedAt`     | Date    | 可选，默认不存在；仅管理员软删除时写入，`select: false`               | 软删除标记，非空即已删除     |

Schema 声明要点：

```typescript
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 32 })
  username: string;

  @Prop({ required: true, trim: true, lowercase: true, select: false })
  usernameLower: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'INVALID_EMAIL'],
  })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ type: Date, default: null, select: false })
  deletedAt: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ usernameLower: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
```

> 邮箱正则只做"形状"校验（含 `@` 与域名点号），不试图完整覆盖 RFC 5322；真伪由未来邮箱验证流程兜底。
>
> `password` 用 `select: false` 让查询默认不返回；仅登录认证（后续模块）显式 `.select('+password')` 时才取出。

### 3.2 脱敏出参

统一经 `user-response.dto.ts` 输出，字段固定为：`id`、`username`、`email`、`isAdmin`、`createdAt`、`updatedAt`。任何路径都不返回 `password`、`usernameLower`、`deletedAt`、`__v`。用一个纯函数 `toUserResponse(doc)` 集中转换，禁止各 Controller 手挑字段。

### 3.3 唯一性与错误映射

- 唯一性以数据库唯一索引为最终裁决（并发安全）；Service 不把"先查后插"当作唯一性保证，只用于错误信息友好化。
- 捕获 Mongoose `11000` 错误，按 `keyPattern` 判定冲突字段：

| 冲突索引          | 业务错误（HTTP）      |
| ----------------- | --------------------- |
| `usernameLower_1` | 409 `USERNAME_EXISTS` |
| `email_1`         | 409 `EMAIL_EXISTS`    |

## 4. DTO 与输入校验

- 全局已启用 `ValidationPipe`（`whitelist: true`、`forbidNonWhitelisted: true`）；DTO 用 `class-validator` 装饰器。
- `CreateUserDto`：`username`、`email`、`password`。**不含 `isAdmin`**——注册即普通用户，杜绝权重赋值提权。
- `UpdateUserDto`：仅允许 `email`（可选，`@IsOptional` + 邮箱校验）。用户名与密码修改不在本期。
- `SetAdminDto`：`{ id: string; isAdmin: boolean }`，`id` 用 `@IsMongoId()` 校验；目标用户标识走 body，不用路径参数。
- `DeleteUserDto`：`{ id: string }`，`@IsMongoId()`；软删除目标标识走 body。
- 密码强度（规格澄清结论）：长度 8–64，且同时含字母与数字。

```typescript
export class CreateUserDto {
  @IsString()
  @Length(2, 32)
  @Matches(/^\S.*\S$|^\S$/)
  username: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(8, 64)
  @Matches(/[a-zA-Z]/)
  @Matches(/\d/)
  password: string;
}
```

> `class-validator` / `class-transformer` 已按 T001 经人工评审后安装（见 §9 与 `package.json`）。

## 5. Service 层

职责：哈希、归一化、落库、唯一性错误转换、最后管理员保护。核心方法：

| 方法                       | 行为                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(dto)`              | 生成 `usernameLower`；bcrypt 哈希密码；不写 `isAdmin`（缺省即 false）；插入并转换 `E11000`                                                                             |
| `findById(id)`             | 按 id 查未删除用户，非法 ObjectId 抛 400；返回脱敏视图。**T031 起只读调用（detail）不存在/已软删返回 `null`（200），写操作调用方（setAdmin/softDelete）仍按 404 处理** |
| `updateEmail(userId, dto)` | 改邮箱，捕获 `email_1` 冲突转 409                                                                                                                                      |
| `list({ page, pageSize })` | 管理员用，仅返回 `deletedAt: null`，页码分页（见 §7；T031 起替换 `{limit,cursor}`）                                                                                    |
| `setAdmin(dto, actor)`     | 仅管理员；入参 `{ id, isAdmin }` 走 body；目标不存在 404；降权时校验最后管理员约束（见 §6）                                                                            |
| `softDelete(dto, actor)`   | 仅管理员；入参 `{ id }` 走 body；已删除返回 404；删除唯一管理员拒绝（见 §6）；置 `deletedAt`；**T031 起成功返回 `null`（原 `{id}` 废止）**                             |

密码哈希：

```typescript
const hash = await bcrypt.hash(dto.password, 10); // cost >= 10，宪法硬性要求
```

> `bcrypt` 有 72 字节输入上限。DTO 已限长 64 字符，UTF-8 下最坏 64×4=256 字节可能超限。拍板：在 Service 哈希前不额外截断（截断会改变语义），由 64 长度上限在多数真实密码下落在 72 字节内；超长多字节字符的极端输入由 `bcrypt` 报错转 400。
> ponytail: 此处不做预哈希（pre-hash）层，上限为"密码 ≤64 字符"；若放宽长度策略，升级路径是改用不受 72 字节限制的处理或 argon2（需先修宪）。

## 6. 权限与"最后管理员"保护

- 角色判定放 `RolesGuard`，用 `@Roles('admin')` 标注管理员接口。Guard 从请求上读取"当前用户"。**`isAdmin` 是唯一受管理员（超管）保护的写字段**：普通用户即使在自己的资料修改请求中带上 `isAdmin`，也因 DTO 白名单（`UpdateUserDto` 不含该字段）被丢弃；仅 `POST /users/admin`（body 携带目标 `id`）经管理员 Guard 后可写。
- 当前登录模块尚未建设：约定由后续认证模块以 `request.user = { id, isAdmin }` 注入；本模块先让 Guard 依赖一个 `CurrentUser` 读取接口，未认证直接 401。令牌解析不在本模块。
- 最后管理员保护（`setAdmin` 把 `true → false` 时）：

```typescript
if (dto.isAdmin === false) {
  const target = await this.userModel
    .findById(dto.id)
    .select('isAdmin deletedAt')
    .exec();
  if (!target || target.deletedAt)
    throw new NotFoundException('USER_NOT_FOUND');
  if (target.isAdmin) {
    const adminCount = await this.userModel
      .countDocuments({ isAdmin: true, deletedAt: null })
      .exec();
    if (adminCount <= 1) throw new ConflictException('LAST_ADMIN_PROTECTED');
  }
}
```

> ponytail: "统计 + 拒绝"在两个管理员被并发降权/删除时有理论竞态（都读到 count=2）。上限：管理员人数极少且为人工后台低频操作，概率可忽略；升级路径是引入可条件更新的单例"管理员名额"文档或分布式锁，不在本期。

软删除（不物理删，凭据与唯一值保留）：

```typescript
async softDelete(dto: DeleteUserDto): Promise<{ id: string }> {
  const target = await this.userModel.findById(dto.id).select('isAdmin deletedAt').exec();
  if (!target || target.deletedAt) throw new NotFoundException('USER_NOT_FOUND');
  if (target.isAdmin) {
    const adminCount = await this.userModel
      .countDocuments({ isAdmin: true, deletedAt: null })
      .exec();
    if (adminCount <= 1) throw new ConflictException('LAST_ADMIN_PROTECTED');
  }
  await this.userModel.updateOne({ _id: dto.id }, { $set: { deletedAt: new Date() } }).exec();
  return { id: dto.id };
}
```

- 所有常规查询默认带 `deletedAt: null`（注册查重、登录、列表、详情）；`usernameLower`/`email` 唯一索引保持不变——软删后唯一值不释放，重新注册同名/邮箱会 409（对应 FR-017）。

## 7. 用户列表分页

> **T031（2026-10-26，005-unified-response / ADR-006 决策 16）改为页码分页**：入参 `page`（缺省 1）+ `pageSize`（缺省 20、封顶 50）；取数 `countDocuments({deletedAt:null})` 取 `total` + `skip((page-1)*pageSize).limit(pageSize).sort({_id:-1})`；返回 `{ total, list, page, pageTotal, index }`，其中 `pageTotal=ceil(total/pageSize)`（total=0 时 0）、`index=(page-1)*pageSize+1`（本页首条全局序号，从 1 起）；越界页 200 + 空 `list`。下文游标分页为 T031 前历史设计，保留作演进轨迹。

~~按通用集成文档 §3.5 用 `_id` 游标分页，`limit` 缺省 20、服务端封顶 50（超过 50 截断而非报错），深翻页不用 `skip`：按 `_id` 倒序（ObjectId 内嵌创建时间，等价于创建时间倒序）、上一页末位 `_id` 作游标。返回 `{ items, nextCursor }`，items 全部走脱敏转换；查询多取 1 条（`limit + 1`）判断是否有下一页。~~

## 8. 接口一览

> HTTP 方法约定：全模块统一只用 **GET 与 POST**，不使用 PUT / PATCH / DELETE。查询用 GET，写操作一律 POST，动作通过路径语义表达（如 `/users/admin`）。**POST 参数优先放 body，不使用 `:id` 路径参数**——资源标识与动作参数都作为 body 字段传递。

| 方法 | 路径            | 鉴权   | 说明                                                              |
| ---- | --------------- | ------ | ----------------------------------------------------------------- |
| POST | `/users`        | 公开   | 注册，body = `CreateUserDto`，返回 200 + 脱敏用户                 |
| GET  | `/users/me`     | 已登录 | 查看本人资料                                                      |
| POST | `/users/me`     | 已登录 | 修改本人邮箱，body = `UpdateUserDto`                              |
| GET  | `/users`        | 管理员 | 用户列表（游标分页，仅未删除）                                    |
| GET  | `/users/detail` | 管理员 | 查看单个用户，query 带 `id`，仅未删除                             |
| POST | `/users/admin`  | 管理员 | 设置/取消管理员，body = `SetAdminDto`（含目标 `id` 与 `isAdmin`） |
| POST | `/users/delete` | 管理员 | 软删除用户，body = `DeleteUserDto`（含 `id`），返回 200           |

错误码：400 非法 id/输入、401 未认证、403 无权限、404 用户不存在或已删除、409 用户名/邮箱冲突或最后管理员保护。错误响应不泄露堆栈与内部字段。

## 9. 依赖与初始化

- 已新增（T001 已完成人工评审并安装）：`bcrypt`、`class-validator`、`class-transformer`；类型定义 `@types/bcrypt` 已安装。
- 首个管理员账号：规格假设由种子/初始化产生，具体方式（种子脚本或环境变量引导）在 plan/tasks 阶段定，不在本设计预设。
- 唯一索引在开发环境随 `autoIndex` 创建；生产按集成文档 §2.4 由迁移脚本显式建索引，建前先查重清洗。

## 10. 测试策略（TDD）

按宪法原则 III，全部生产逻辑先写失败测试：

- 单元（Service）：注册成功默认非管理员；重复用户名/邮箱 → 对应 409；邮箱大小写/空格归一后冲突；密码 bcrypt 存储且不等于明文；出参不含 password/usernameLower/deletedAt；最后管理员降权或删除被拒、非唯一管理员可降权/删除；非法 ObjectId → 400；软删除后不出现在列表、详情 404、记录仍在、同名不能再注册；重复删除幂等返回 404。
- 单元（Guard/DTO）：普通用户访问管理员接口（列表/详情/setAdmin/delete）403、未认证 401；注册 DTO 不接受 `isAdmin` 字段（`forbidNonWhitelisted`）；弱密码/非法邮箱被拒。
- E2E：注册 → 查本人 → 改邮箱闭环；管理员列表分页与单用户详情；管理员软删除后该账号登录被拒、列表不可见；越权删除路径。`pnpm lint && pnpm test` 全绿为完成标准。

## 11. 相关文档

- [ADR-002：用户模块数据模型与权限基线](../adr/ADR-002-user-module.md)
- [ADR-001：采用 MongoDB 作为核心数据存储](../adr/ADR-001-mongodb.md)
- [MongoDB + NestJS 集成设计文档](./mongodb-integration-design.md)
- 功能规格：`specs/001-user-module/spec.md`

## 12. 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-14：代码评审通过，状态 Pending → Confirmed；同步已安装依赖与实际落地文件结构。
- 2026-10-14：随实现计划产出，状态 Draft → Pending。
- 2026-10-13：补齐 CRUD——新增管理员查单个用户（GET `/users/detail`）与软删除（POST `/users/delete`）；Schema 加 `deletedAt`，全部查询过滤已删除，删除唯一管理员拒绝，软删后唯一值不释放；同步 §3–§8、§10。
- 2026-10-13：POST 写操作参数改走 body，`POST /users/:id/admin` 改为 `POST /users/admin`，目标 `id` 并入 `SetAdminDto`；同步 §4 DTO、§5 Service、§6 引用。
- 2026-10-13：接口方法统一为 GET/POST，原 PATCH 路径（改邮箱、设置管理员）改为 POST；§8 增补 HTTP 方法约定。
- 2026-10-13：澄清——`isAdmin` 明确为非必填、缺省 false，且仅管理员（超管）可更新；同步 §3.1 字段表、Schema、§5 create、§6 Guard。
- 2026-10-13：初始草稿，随 `001-user-module` 规格与 ADR-002 创建，待评审。
