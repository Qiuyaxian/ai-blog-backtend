# API Contract: 全局统一响应外壳（005-unified-response）

**Date**: 2026-10-26（T031 修订） | **Status**: Draft

9 个业务接口统一外壳；成功 HTTP 状态码统一 200。T027 起对齐 `@nestarc/safe-response`：四字段 `{success,code,message,data}`，无 `path`/`time`（请求关联走 `x-request-id` 访问日志）。**T030 起 `code` 为数字业务码，取值等于本次响应的 HTTP 状态码**：成功恒 `200`，失败为 `400/401/403/404/409/500`；服务异常本身（抛出位置、异常类型、HTTP 状态行、`message` 文案）全部保留，仅外壳 `code` 由字符串码改为数字状态码。

**T031 起锁定 CRUD 五类操作的 `data` 形态（适用当前及后续全部业务模块）**：

| 操作             | `data`                                                              | 不存在                                         |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| 分页列表         | `{ total, list, page, pageTotal, index }`（页码分页，字段语义见下） | HTTP 200 空页（`total:0,list:[],pageTotal:0`） |
| 单个查询（只读） | 单条对象 \| `null`                                                  | **HTTP 200 + `data:null`**（不抛 404）         |
| 创建             | 新建对象（脱敏视图）                                                | —                                              |
| 更新             | 更新后的完整对象（脱敏视图）                                        | 写操作目标不存在仍 404                         |
| 删除             | `null`                                                              | 写操作目标不存在仍 404                         |

- 列表字段：`total:number` 总条数；`list:T[]` 当前页；`page:number` 当前页（从 1）；`pageTotal:number` 总页数 `ceil(total/pageSize)`（无数据 0）；`index:number` 本页首条全局序号（从 1）`=(page-1)*pageSize+1`。
- 列表入参：`page`（缺省 1）、`pageSize`（缺省 20、封顶 50）；游标参数 `cursor/limit/nextCursor` 废止。
- 非法 ID 仍 400；只读单查 404 语义取消，写操作 404 保留。

## 1. 通用形状

成功（2xx，拦截器产出，`success` 恒 `true`，`code` 恒 `200`）：

```json
{ "success": true, "code": 200, "message": "ok", "data": <业务数据：对象/数组/null> }
```

失败（4xx/5xx，过滤器产出，`success` 恒 `false`、`data` 恒 `null`、`code` 等于 HTTP 状态码）：

```json
{
  "success": false,
  "code": 401,
  "message": "<面向客户端文案；参数校验失败时为字段错误字符串[]>",
  "data": null
}
```

顶层字段恒为且仅为 `success/code/message/data`；`code` 类型恒为数字；无 `statusCode`、无 `error`、无 `path`、无 `time`。`data` 原样支持 `null`/`[]`/`{}`/业务对象，不做替换。同一 HTTP 状态的多个细分原因（如 409 的用户名/邮箱/末管理员冲突、400 的校验失败/非法 ID）外壳 `code` 相同，仅由 `message` 区分。

错误配置单一来源：`src/common/response/response.constants.ts` 的 `ERROR_CATALOG`（每个内部异常键含 `status`/`message`/可选 `docLabel`）。Service/Guard 仍抛字符串键（如 `USERNAME_EXISTS`），过滤器据键查到 `status`，**外壳 `code` 直接输出该 `status` 数字**，`message` 取目录文案。运行时文案表 `ERROR_CODES` 与 Swagger 错误状态集合 `SWAGGER_ERROR_STATUSES`、描述函数 `swaggerErrorDescription` 均由它派生，禁止另存一份文案；未登记描述的状态 fail-fast。

## 2. 各业务接口契约（data 内容）

| 接口               | HTTP | `data` 类型                                                                                | 失败 `code`（数字）与语义（同状态靠 `message` 区分）                                |
| ------------------ | ---- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| POST /auth/login   | 200  | `LoginResultResponse{ token, expiresAt, user }`                                            | 400（参数校验）、401（凭证错误，含锁定）                                            |
| POST /auth/logout  | 200  | `null`（登出无数据，成功语义看顶层 `success`）                                             | 401（未登录/令牌无效）                                                              |
| POST /users        | 200  | `UserResponseDto`（6 字段）                                                                | 400（参数校验）、409（用户名/邮箱已存在）                                           |
| GET /users/me      | 200  | `UserResponseDto`                                                                          | 401（未登录/令牌无效）                                                              |
| POST /users/me     | 200  | `UserResponseDto`                                                                          | 400（参数校验）、401（未登录）、409（邮箱已存在）                                   |
| GET /users         | 200  | `PageResult<UserResponseDto>` = `{ total, list, page, pageTotal, index }`（T031 页码分页） | 400（参数校验）、401（未登录）、403（权限不足）                                     |
| GET /users/detail  | 200  | `UserResponseDto` 或 `null`（不存在/已软删时 200 + null，T031）                            | 400（非法 ID）、401（未登录）、403（权限不足）                                      |
| POST /users/admin  | 200  | `UserResponseDto`（更新后的完整对象）                                                      | 400（非法 ID/参数校验）、401、403、404（用户不存在）                                |
| POST /users/delete | 200  | `null`（T031；旧 `{id}` 形态废止）                                                         | 400（非法 ID/参数校验）、401、403、404（用户不存在）、409（最后一个管理员不可删除） |

## 3. 示例

### 注册成功（200）

```json
{
  "success": true,
  "code": 200,
  "message": "ok",
  "data": {
    "id": "...",
    "username": "alice",
    "email": "a@x.com",
    "isAdmin": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 登录成功（200）

```json
{ "success": true, "code": 200, "message": "ok", "data": { "token": "<64hex>", "expiresAt": "<ISO>", "user": { "...6 字段" } } }
```

### 登出 / 删除成功（200，data 为 null）

```json
{ "success": true, "code": 200, "message": "ok", "data": null }
```

### 分页列表成功（200，T031 页码分页）

```json
{
  "success": true,
  "code": 200,
  "message": "ok",
  "data": {
    "total": 31,
    "list": [{ "...UserResponseDto": "..." }],
    "page": 2,
    "pageTotal": 2,
    "index": 21
  }
}
```

### 只读单查不存在（200 + data:null，T031；不返回 404）

```json
{ "success": true, "code": 200, "message": "ok", "data": null }
```

### 参数校验失败（400，message 保留字段数组）

```json
{
  "success": false,
  "code": 400,
  "message": ["password must be longer..."],
  "data": null
}
```

### 未认证 / 业务冲突 / 非法 ID / 500

```jsonc
{ "success": false, "code": 401, "message": "未登录或令牌无效", "data": null }
{ "success": false, "code": 409, "message": "邮箱已存在", "data": null }
{ "success": false, "code": 400, "message": "无效的资源 ID", "data": null }
{ "success": false, "code": 500, "message": "服务器内部错误", "data": null }   // 500（不泄露内部）
```

## 4. 豁免路径契约（逐字节保持现状）

| 路径              | 响应                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /             | 200，body=`Hello World!`（Express 默认 `text/html; charset=utf-8`）                                                                              |
| GET /health/live  | 200，`{ "status":"up" }`                                                                                                                         |
| GET /health/ready | 200 Terminus 原生：`{ "status":"ok", "info":{...}, "error":{}, "details":{...} }`；依赖故障 503：`{ "status":"error", ... }`（原样透传，无外壳） |

## 5. Swagger 文档契约（T028：成功/错误响应与状态码全全局，控制器零响应注解）

- 成功响应 data 模型由 `@nestjs/swagger` CLI 插件按 controller 返回类型自动推断（要求返回类型为 class/内联对象/数组，不能是 interface/any）；文档生成后 `wrapSuccessEnvelope` 统一把 2xx schema 包成 `allOf: [$ref SuccessEnvelope, {properties:{data:<原 schema>}}]`，全文档共享一个 `SuccessEnvelope`（success/code/message，`code` 为数字、成功示例 200）。
- 成功状态码不写 `@HttpCode`，由全局拦截器统一设置为 200；Swagger 文档生成后将唯一 2xx 键归一到 200，包含插件对 POST 默认生成 201 的情况。
- 错误响应不写 `@ApiErrorResponses`：`wrapSuccessEnvelope` 给每个非豁免操作统一注入全套 `400/401/403/404/409`，schema 均 `$ref ErrorEnvelope`（`success:false`、`code` 数字等于该错误键状态码、`data` nullable、`message` oneOf string/array，通用文案），无 `statusCode`。**文档枚举不逐接口收窄**（某接口运行时未必返回全套，真实状态码以 E2E 断言为准；此为 T028 明确接受的文档精度权衡，ADR-006 决策 13）。
- `/api-docs-json` 不存在旧含 `statusCode` 的 ErrorResponse，也不存在逐 data 类型的 5 个 Envelope 子类。

## 6. 不变项（非目标）

- 成功 HTTP 状态码统一为 200（注册不再返回 201）；**服务异常的抛出位置、异常类型、HTTP 错误状态行（400/401/403/404/409/500）、鉴权判定、校验规则、`x-request-id`、访问日志字段、DB/缓存行为全部不变**。内部异常键（`VALIDATION_ERROR` 等 10 个）仍是 Service/Guard 与 `ERROR_CATALOG` 的稳定标识，只是不再原样出现在响应外壳——对外 `code` 统一为数字状态码。
- `toUserResponse` 输出结构不变（仍 6 字段），仅被包进 `data`。
