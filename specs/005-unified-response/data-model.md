# Data Model: 全局统一响应外壳（005-unified-response）

**Date**: 2026-10-26 | **Status**: Draft

本功能**无持久化实体、无 MongoDB/Redis 变更**。仅定义内存期 HTTP 响应结构与一个纯函数。

## 1. 统一响应外壳 ApiResponse<T>

```ts
interface ApiResponse<T> {
  code: string; // 成功 'SUCCESS'；错误为业务错误码
  data: T | null; // 成功=Controller 返回值原样；错误恒 null
  message: string | string[]; // 成功 'ok'；校验错误为字符串数组；其余错误为字符串
  path: string; // 请求路径（req.path，不含 query）
  time: string; // ISO 8601；成功=封装时刻，错误=异常处理时刻
}
```

| 字段      | 成功取值                                                         | 错误取值                         | 产出位置        |
| --------- | ---------------------------------------------------------------- | -------------------------------- | --------------- |
| `code`    | `'SUCCESS'`（常量 `SUCCESS_CODE`）                               | 现有 10 个错误码之一             | 拦截器 / 过滤器 |
| `data`    | Controller/Service 原始返回值（对象、数组、`{success:true}` 等） | 恒 `null`                        | 拦截器 / 过滤器 |
| `message` | `'ok'`（常量 `SUCCESS_MESSAGE`）                                 | 字段错误数组（400 校验）或字符串 | 拦截器 / 过滤器 |
| `path`    | `req.path`                                                       | `req.path`                       | 拦截器 / 过滤器 |
| `time`    | `new Date().toISOString()`                                       | `new Date().toISOString()`       | 拦截器 / 过滤器 |

无新建集合、无索引、无字段迁移。`data` 的具体形态沿用既有各接口返回（见 contracts）。

## 2. 常量（src/common/response/response.constants.ts）

```ts
export const SUCCESS_CODE = 'SUCCESS';
export const SUCCESS_MESSAGE = 'ok';

export interface ApiResponse<T> {
  /* 见上 */
}

/** 统一外壳豁免路径：根探活与健康探针（含 Terminus 503） */
export function isEnvelopeExcludedPath(path: string): boolean;
// path === '/' || path === '/health' || path.startsWith('/health/')
```

## 3. 错误码（值不变，仅承载位置变化）

错误码**不新增、不重命名**，从「响应体 + 顶层 statusCode」迁移到「同外壳 code，无顶层 statusCode」：

| code                   | HTTP | 现状抛出点                                    | 本期变化 |
| ---------------------- | ---- | --------------------------------------------- | -------- |
| `VALIDATION_ERROR`     | 400  | ValidationPipe（filter 归一，message 为数组） | 换外壳   |
| `INVALID_ID`           | 400  | filter CastError 归一 + user.service          | 换外壳   |
| `UNAUTHENTICATED`      | 401  | auth.guard（5 处）、roles.guard               | 换外壳   |
| `INVALID_CREDENTIALS`  | 401  | auth.service（3 处）                          | 换外壳   |
| `FORBIDDEN`            | 403  | roles.guard                                   | 换外壳   |
| `USER_NOT_FOUND`       | 404  | user.service（5 处）                          | 换外壳   |
| `USERNAME_EXISTS`      | 409  | user.service（E11000 归一）                   | 换外壳   |
| `EMAIL_EXISTS`         | 409  | user.service                                  | 换外壳   |
| `LAST_ADMIN_PROTECTED` | 409  | user.service（2 处）                          | 换外壳   |
| `INTERNAL_ERROR`       | 500  | filter 兜底                                   | 换外壳   |

移除项：旧错误体顶层 `statusCode` 字段。filter 内部仍计算 HTTP status 用于 `response.status()`，但不写入 body。

## 4. 豁免路径（不套外壳）

| 路径                | 成功形态                                                    | 失败形态                                                                                |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /`             | 200 `Hello World!`（Express 默认 text/html）                | —                                                                                       |
| `GET /health/live`  | 200 `{ status:'up' }`                                       | 不触依赖，无失败路径                                                                    |
| `GET /health/ready` | 200 Terminus `HealthCheckResult`（`status:'ok'`, info/...） | 503 Terminus 原生 `HealthCheckResult`（`status:'error'`, error/...），filter 透传不包裹 |

## 5. Swagger 模型映射（描述性，无持久化）

| 接口                                 | 成功外壳类（data 类型）                          |
| ------------------------------------ | ------------------------------------------------ |
| POST /auth/login                     | `LoginEnvelope`（`LoginResultResponse`）         |
| POST /auth/logout                    | `LogoutEnvelope`（`LogoutResultResponse`）       |
| POST /users                          | `UserEnvelope`（`UserResponseDto`）              |
| GET/POST /users/me                   | `UserEnvelope`                                   |
| GET /users                           | `UserListPageEnvelope`（`UserListPageResponse`） |
| GET /users/detail、POST /users/admin | `UserEnvelope`                                   |
| POST /users/delete                   | `DeleteEnvelope`（`DeleteResultResponse`）       |
| 所有错误                             | `ErrorEnvelope`（`data:null`）                   |
