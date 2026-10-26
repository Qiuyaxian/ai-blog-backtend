# 接口契约：用户模块

> ⚠️ **响应外壳已更新（2026-10-26，005-unified-response，T030）**：本文件示例中的成功/失败响应体均已包入统一外壳 `{success,code,message,data}`（成功读 `data`、失败 `data:null` 且无 `statusCode`）。成功 HTTP 状态码统一 200，错误保持语义化状态码；**外壳 `code` 为数字且恒等于 HTTP 状态码（成功 200，失败 400/401/403/404/409/500），同状态细分原因看 `message`**；本文出现的字符串错误码（如 `USER_NOT_FOUND`）现为服务端内部异常键，不再原样出现在响应 `code`。响应外壳唯一真相见 [005 的 api-contract.md](../../005-unified-response/contracts/api-contract.md)，本文件不再逐条改写。

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

- 成功：`200`，返回脱敏用户；`isAdmin` 恒为 false。
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
- Query：`page`（正整数，缺省 1）、`pageSize`（正整数，缺省 20，封顶 50；005 T031 起替换旧 `limit`/`cursor`）
- 成功：`200`，页码分页结构（CRUD 五形态之一，见 005 T031 / ADR-006 决策 16）：

```json
{
  "total": 31,
  "list": [{ "...脱敏用户": "..." }],
  "page": 1,
  "pageTotal": 2,
  "index": 1
}
```

- 字段：`total` 总条数；`list` 当前页；`pageTotal=ceil(total/pageSize)`（无数据为 0）；`index=(page-1)*pageSize+1` 本页首条全局序号（从 1 起）。
- 仅含 `deletedAt:null` 用户；越界页 200 + 空 `list`。
- 失败：`400` 参数非法；`401`、`403`。

## 5. 查看单个用户（管理员）

- `GET /users/detail?id=<objectId>`（管理员）
- 成功：`200` 脱敏用户；**用户不存在或已软删时返回 200 + `data:null`**（005 T031：只读单查空结果不是错误）。
- 失败：`400` 非法 id；`401`；`403`。注：写操作（admin/delete）目标不存在仍为 404。

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

- 成功：`200`：`data` 为 `null`（005 T031：删除不回传 id，成功语义看顶层 `success`）。
- 语义：置 `deletedAt`，不物理删；之后该账号不可登录、不在列表、详情返回 200 + `data:null`；用户名/邮箱不释放。
- 失败：`400` 非法 id；`401`；`403`；`404 USER_NOT_FOUND`（含重复删除）；`409 LAST_ADMIN_PROTECTED`（删除唯一管理员）。

## 错误码汇总

| HTTP | code                                                  | 触发                                                                                     |
| ---- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 400  | VALIDATION_ERROR / INVALID_ID                         | DTO 校验、非法 ObjectId                                                                  |
| 401  | UNAUTHENTICATED                                       | 缺少/无效当前用户                                                                        |
| 403  | FORBIDDEN                                             | 普通用户访问管理员接口                                                                   |
| 404  | USER_NOT_FOUND                                        | 写操作目标不存在或已软删（admin/delete）；只读 detail 空结果为 200 + `data:null`（T031） |
| 409  | USERNAME_EXISTS / EMAIL_EXISTS / LAST_ADMIN_PROTECTED | 唯一冲突 / 最后管理员保护                                                                |
