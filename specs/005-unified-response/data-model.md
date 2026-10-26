# Data Model: 全局统一响应外壳（005-unified-response）

**Date**: 2026-10-26 | **Status**: Draft

本功能**无持久化实体、无 MongoDB/Redis 变更**。仅定义内存期 HTTP 响应结构与一个纯函数。

> **T027 修订（2026-10-26，权威）**：`ApiResponse<T>` 最终为四字段 `{success:boolean; code:string; message:string|string[]; data:T|null}`，无下文的 `path`/`time`；Swagger 模型改为 `SuccessEnvelope`（success/code/message）+ `wrapSuccessEnvelope` 动态 data，不再有 5 个 Envelope 子类。以下结构树为五字段历史设计，字段集合以 `contracts/api-contract.md` §1 为准。
>
> **T030 修订（2026-10-26，权威）**：`ApiResponse<T>['code']` 类型由 `string` 改为 `number`，取值恒等于本次响应 HTTP 状态码：成功 `200`，失败 `400/401/403/404/409/500`。第 3 节表中的 10 个字符串码降级为内部异常键（Service/Guard 抛出值 + `ERROR_CATALOG` 键），过滤器据键查 `status` 后把数字写进外壳 `code`，字符串不再出现在响应体。`SUCCESS_CODE` 常量值由 `'SUCCESS'` 改为 `200`（建议直接复用 Nest `HttpStatus.OK`）。异常抛出位置/类型/HTTP 状态行不变。
>
> **T031 修订（2026-10-26，权威）——CRUD `data` 形态**：列表 `data` 由游标 `{items,nextCursor}` 改为页码分页 `PageResult`；删除 `data` 由 `{id}` 改为 `null`；只读单查不存在由 404 改为 200/`null`；创建/更新 `data` 不变（完整脱敏对象）。详见 §6。

## 6. CRUD `data` 形态约定（T031 权威，无持久化变更）

适用于全部业务模块的成功 `data` 载荷；外壳四字段不变。

| 操作             | HTTP                           | `data` 形态                                | 不存在时                                                   |
| ---------------- | ------------------------------ | ------------------------------------------ | ---------------------------------------------------------- |
| 分页列表         | GET（query `page`/`pageSize`） | `PageResult<T>`（下）                      | 空页：`{total:0,list:[],page,pageTotal:0,index}`，HTTP 200 |
| 单个查询（只读） | GET                            | 单条对象（如 `UserResponseDto`） \| `null` | HTTP 200 + `data:null`（不抛 404）                         |
| 创建             | POST 资源根                    | 新建对象（脱敏视图）                       | —                                                          |
| 更新             | POST 动作                      | 更新后的完整对象（脱敏视图）               | 目标不存在仍抛 404                                         |
| 删除             | POST 动作                      | `null`                                     | 目标不存在仍抛 404                                         |

```ts
/** 页码分页结果（T031）；所有分页列表接口的 data 必须为此结构 */
class PageResult<T> {
  total: number; // 符合条件的总条数（软删场景只计 deletedAt:null）
  list: T[]; // 当前页数据；越界页为 []
  page: number; // 当前页码，从 1 起（缺省 1）
  pageTotal: number; // 总页数 = Math.ceil(total / pageSize)；total===0 时为 0
  index: number; // 本页首条全局序号（从 1 起）= (page - 1) * pageSize + 1
}
```

分页入参：`page`（正整数，缺省 1）、`pageSize`（正整数，缺省 20、上限 50，超限截断）。替换用户模块现有 `UserQueryDto.limit/cursor` 与 service 的 `_id` 游标查询；Mongo 取数用 `skip((page-1)*pageSize).limit(pageSize)`，`total` 用 `countDocuments`（同一过滤条件）。

用户模块映射：`UserListPageResponse{items,nextCursor}` → `PageResult<UserResponseDto>`（类改名/替换，Swagger CLI 插件要求保留 class）；`DeleteResultResponse{id}` 删除（controller `remove` 返回 `Promise<null>`）；`GET /users/detail` 的 service 调用不再因 null 抛 `USER_NOT_FOUND`（`findById` 的抛错调用点需区分只读与写操作，写操作 admin/delete 保持 404）。

## 1. 统一响应外壳 ApiResponse<T>（T030 权威形状）

```ts
interface ApiResponse<T> {
  success: boolean; // 成功 true；错误 false
  code: number; // 成功 200；错误=对应 HTTP 状态码 400/401/403/404/409/500
  message: string | string[]; // 成功 'ok'；校验错误为字符串数组；其余错误为字符串
  data: T | null; // 成功=Controller 返回值原样（含 null/[]/{}）；错误恒 null
}
```

| 字段      | 成功取值                                               | 错误取值                                  | 产出位置        |
| --------- | ------------------------------------------------------ | ----------------------------------------- | --------------- |
| `success` | `true`                                                 | `false`                                   | 拦截器 / 过滤器 |
| `code`    | `200`（常量 `SUCCESS_CODE`）                           | 数字 HTTP 状态（400/401/403/404/409/500） | 拦截器 / 过滤器 |
| `message` | `'ok'`（常量 `SUCCESS_MESSAGE`）                       | 字段错误数组（400 校验）或目录文案字符串  | 拦截器 / 过滤器 |
| `data`    | Controller/Service 原始返回值（对象、数组、`null` 等） | 恒 `null`                                 | 拦截器 / 过滤器 |

无新建集合、无索引、无字段迁移。`data` 的具体形态沿用既有各接口返回（见 contracts）。

## 2. 常量（src/common/response/response.constants.ts）

```ts
export const SUCCESS_CODE = 200; // 数字业务码=HTTP 成功状态（建议取 HttpStatus.OK）
export const SUCCESS_MESSAGE = 'ok';

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string | string[];
  data: T | null;
}

/** 统一外壳豁免路径：根探活与健康探针（含 Terminus 503） */
export function isEnvelopeExcludedPath(path: string): boolean;
// path === '/' || path === '/health' || path.startsWith('/health/')
```

## 3. 内部异常键（抛出值不变；对外 code 改输出数字状态）

Service/Guard 抛出值与异常类型**不新增、不重命名、不改抛出点**；变化仅在过滤器：查到键对应 `status` 后，外壳 `code` 输出该数字而非字符串键：

| 内部异常键             | HTTP（=对外 code） | 现状抛出点                                    | 本期变化                       |
| ---------------------- | ------------------ | --------------------------------------------- | ------------------------------ |
| `VALIDATION_ERROR`     | 400                | ValidationPipe（filter 归一，message 为数组） | 外壳 code 由字符串改为数字 400 |
| `INVALID_ID`           | 400                | filter CastError 归一 + user.service          | 外壳 code 400                  |
| `UNAUTHENTICATED`      | 401                | auth.guard（5 处）、roles.guard               | 外壳 code 401                  |
| `INVALID_CREDENTIALS`  | 401                | auth.service（3 处）                          | 外壳 code 401                  |
| `FORBIDDEN`            | 403                | roles.guard                                   | 外壳 code 403                  |
| `USER_NOT_FOUND`       | 404                | user.service（5 处）                          | 外壳 code 404                  |
| `USERNAME_EXISTS`      | 409                | user.service（E11000 归一）                   | 外壳 code 409                  |
| `EMAIL_EXISTS`         | 409                | user.service                                  | 外壳 code 409                  |
| `LAST_ADMIN_PROTECTED` | 409                | user.service（2 处）                          | 外壳 code 409                  |
| `INTERNAL_ERROR`       | 500                | filter 兜底                                   | 外壳 code 500                  |

移除项：旧错误体顶层 `statusCode` 字段。filter 内部计算的 HTTP status 既用于 `response.status()`，也作为外壳 `code` 的唯一来源（二者恒等）。同状态细分原因仅 `message` 不同。

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
