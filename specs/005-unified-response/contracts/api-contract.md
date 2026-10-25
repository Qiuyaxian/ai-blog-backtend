# API Contract: 全局统一响应外壳（005-unified-response）

**Date**: 2026-10-26 | **Status**: Draft

9 个业务接口统一外壳；HTTP 状态码不变。`time` 为 ISO 8601（示例用 `…` 省略实际值）。

## 1. 通用形状

成功（2xx）：

```json
{ "code": "SUCCESS", "data": <业务数据>, "message": "ok", "path": "<请求路径>", "time": "<ISO8601>" }
```

失败（4xx/5xx）：

```json
{
  "code": "<错误码>",
  "data": null,
  "message": "<字符串或字符串[]>",
  "path": "<请求路径>",
  "time": "<ISO8601>"
}
```

顶层字段恒为且仅为 `code/data/message/path/time`；无 `statusCode`、无 `error`。

## 2. 各业务接口契约（data 内容）

| 接口               | HTTP | `data` 类型                                                   | 主要错误 code（HTTP）                                                                                                  |
| ------------------ | ---- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST /auth/login   | 200  | `LoginResultResponse{ token, expiresAt, user }`               | VALIDATION_ERROR(400)、INVALID_CREDENTIALS(401)                                                                        |
| POST /auth/logout  | 200  | `LogoutResultResponse{ success:true }`                        | UNAUTHENTICATED(401)                                                                                                   |
| POST /users        | 201  | `UserResponseDto`（6 字段）                                   | VALIDATION_ERROR(400)、USERNAME_EXISTS/EMAIL_EXISTS(409)                                                               |
| GET /users/me      | 200  | `UserResponseDto`                                             | UNAUTHENTICATED(401)                                                                                                   |
| POST /users/me     | 200  | `UserResponseDto`                                             | VALIDATION_ERROR(400)、UNAUTHENTICATED(401)、EMAIL_EXISTS(409)                                                         |
| GET /users         | 200  | `UserListPageResponse{ items:[UserResponseDto], nextCursor }` | VALIDATION_ERROR(400)、UNAUTHENTICATED(401)、FORBIDDEN(403)                                                            |
| GET /users/detail  | 200  | `UserResponseDto`                                             | INVALID_ID(400)、UNAUTHENTICATED(401)、FORBIDDEN(403)、USER_NOT_FOUND(404)                                             |
| POST /users/admin  | 200  | `UserResponseDto`                                             | INVALID_ID/VALIDATION_ERROR(400)、UNAUTHENTICATED(401)、FORBIDDEN(403)、USER_NOT_FOUND(404)                            |
| POST /users/delete | 200  | `DeleteResultResponse{ id }`                                  | INVALID_ID/VALIDATION_ERROR(400)、UNAUTHENTICATED(401)、FORBIDDEN(403)、USER_NOT_FOUND(404)、LAST_ADMIN_PROTECTED(409) |

## 3. 前后对照（示例）

### 注册成功

```jsonc
// 前（201，顶层即用户字段）
{ "id":"...", "username":"alice", "email":"a@x.com", "isAdmin":false, "createdAt":"...", "updatedAt":"..." }

// 后（201）
{ "code":"SUCCESS", "data":{ "id":"...","username":"alice","email":"a@x.com","isAdmin":false,"createdAt":"...","updatedAt":"..." }, "message":"ok", "path":"/users", "time":"..." }
```

### 登录成功

```jsonc
// 后（200）
{ "code":"SUCCESS", "data":{ "token":"<64hex>", "expiresAt":"<ISO>", "user":{ ...6 字段 } }, "message":"ok", "path":"/auth/login", "time":"..." }
```

### 登出成功

```jsonc
// 后（200）
{
  "code": "SUCCESS",
  "data": { "success": true },
  "message": "ok",
  "path": "/auth/logout",
  "time": "..."
}
```

### 参数校验失败

```jsonc
// 前（400）
{ "code":"VALIDATION_ERROR", "message":["password must be longer..."], "statusCode":400 }

// 后（400）
{ "code":"VALIDATION_ERROR", "data":null, "message":["password must be longer..."], "path":"/users", "time":"..." }
```

### 未认证 / 业务冲突 / 500

```jsonc
// 401（auth.guard / roles.guard / auth.service）
{ "code":"UNAUTHENTICATED", "data":null, "message":"UNAUTHENTICATED", "path":"/users/me", "time":"..." }
// 409
{ "code":"EMAIL_EXISTS", "data":null, "message":"EMAIL_EXISTS", "path":"/users/me", "time":"..." }
// 500（不泄露内部）
{ "code":"INTERNAL_ERROR", "data":null, "message":"internal server error", "path":"/x", "time":"..." }
```

## 4. 豁免路径契约（逐字节保持现状）

| 路径              | 响应                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| GET /             | 200，body=`Hello World!`（Express 默认 `text/html; charset=utf-8`）                                                                              | —   |
| GET /health/live  | 200，`{ "status":"up" }`                                                                                                                         |
| GET /health/ready | 200 Terminus 原生：`{ "status":"ok", "info":{...}, "error":{}, "details":{...} }`；依赖故障 503：`{ "status":"error", ... }`（原样透传，无外壳） |

## 5. Swagger 文档契约

- 每个业务接口成功响应 schema 顶层 = 五字段外壳，`data` $ref 指向其数据模型。
- 每个错误响应 schema = `ErrorEnvelope`（`data` nullable/object、`message` oneOf string/array），无 `statusCode`。
- `/api-docs-json` 中旧含 `statusCode` 的 ErrorResponse 模型引用数为 0。

## 6. 不变项（非目标）

- HTTP 状态码、错误码字符串、鉴权判定、校验规则、`x-request-id`、访问日志字段、DB/缓存行为全部不变。
- `toUserResponse` 输出结构不变（仍 6 字段），仅被包进 `data`。
