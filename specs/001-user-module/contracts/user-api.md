# 接口契约：用户模块

> Phase 1 产物。HTTP 仅用 GET/POST；POST 参数走 body（团队硬约束，见 `docs/development/coding-style.md` §2.4）。本期不设全局/版本前缀（现有 `src/main.ts` 无 `setGlobalPrefix`），下列路径即实际挂载路径（如 `POST /users`）；前缀策略待后续统一版本化时另立变更。

通用：

- 错误响应由全局异常过滤器统一包装，不泄露堆栈/内部字段。
- 出参用户对象一律为脱敏形态：`{ id, username, email, isAdmin, createdAt, updatedAt }`。

## 1. 注册

- `POST /users`（公开）
- Body（CreateUserDto）：

```json
{ "username": "Alice", "email": "alice@example.com", "password": "abc12345" }
```

- 成功：`201`，返回脱敏用户；`isAdmin` 恒为 false。
- 失败：
  - `400` 字段非法（邮箱格式、密码 8–64 且含字母+数字、用户名 2–32）
  - `409 USERNAME_EXISTS` / `409 EMAIL_EXISTS`（按冲突字段区分）

## 2. 查看本人资料

- `GET /users/me`（已登录）
- 成功：`200` 脱敏用户。
- 失败：`401` 未认证。

## 3. 修改本人邮箱

- `POST /users/me`（已登录）
- Body（UpdateUserDto，字段可选）：

```json
{ "email": "new@example.com" }
```

- 成功：`200` 更新后的脱敏用户。
- 失败：`400` 邮箱非法；`401`；`409 EMAIL_EXISTS`。
- 注：body 中即使带 `isAdmin` 也被白名单丢弃。

## 4. 用户列表（管理员）

- `GET /users`（管理员）
- Query（UserQueryDto）：`limit`（服务端封顶 50）、`cursor`（可选，上一页末位 id）
- 成功：`200`

```json
{ "items": [{ "...脱敏用户": "..." }], "nextCursor": "65ab...或 null" }
```

- 仅含 `deletedAt:null` 用户。
- 失败：`401`、`403`。

## 5. 查看单个用户（管理员）

- `GET /users/detail?id=<objectId>`（管理员）
- 成功：`200` 脱敏用户。
- 失败：`400` 非法 id；`401`；`403`；`404 USER_NOT_FOUND`（不存在或已软删）。

## 6. 设置/取消管理员（管理员）

- `POST /users/admin`（管理员）
- Body（SetAdminDto）：

```json
{ "id": "65ab...", "isAdmin": false }
```

- 成功：`200` 更新后的脱敏用户。
- 失败：`400` 非法 id；`401`；`403`；`404 USER_NOT_FOUND`；`409 LAST_ADMIN_PROTECTED`（取消唯一管理员）。

## 7. 软删除用户（管理员）

- `POST /users/delete`（管理员）
- Body（DeleteUserDto）：

```json
{ "id": "65ab..." }
```

- 成功：`200`：`{ "id": "65ab..." }`。
- 语义：置 `deletedAt`，不物理删；之后该账号不可登录、不在列表、详情 404；用户名/邮箱不释放。
- 失败：`400` 非法 id；`401`；`403`；`404 USER_NOT_FOUND`（含重复删除）；`409 LAST_ADMIN_PROTECTED`（删除唯一管理员）。

## 错误码汇总

| HTTP | code                                                  | 触发                      |
| ---- | ----------------------------------------------------- | ------------------------- |
| 400  | VALIDATION_ERROR / INVALID_ID                         | DTO 校验、非法 ObjectId   |
| 401  | UNAUTHENTICATED                                       | 缺少/无效当前用户         |
| 403  | FORBIDDEN                                             | 普通用户访问管理员接口    |
| 404  | USER_NOT_FOUND                                        | 不存在或已软删            |
| 409  | USERNAME_EXISTS / EMAIL_EXISTS / LAST_ADMIN_PROTECTED | 唯一冲突 / 最后管理员保护 |
