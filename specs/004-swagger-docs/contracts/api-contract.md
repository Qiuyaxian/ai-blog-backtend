# API 文档契约：004-swagger-docs

**性质**：本文件定义「Swagger 文档必须如何呈现既有接口」的契约，是文档注解与 E2E 断言的双向追溯依据。接口本身的请求/响应契约以 001 的 [user-api.md](../../001-user-module/contracts/user-api.md) 与 003 的 [auth-api.md](../../003-user-login/contracts/auth-api.md) 为唯一真相来源；本功能 **MUST NOT 改变任何接口行为**，只描述。

> ⚠️ **2026-10-26（005-unified-response，T030）**：错误体形状为 `{ success:false, code, message, data:null }`（无 `statusCode`），成功响应为四字段外壳（业务数据在 `data`）；所有业务成功响应统一 200。**外壳 `code` 为数字且恒等于 HTTP 状态码（成功 200，失败 400/401/403/404/409/500）**；本文错误码表中的字符串（`INVALID_CREDENTIALS` 等）为服务端内部异常键，对外 `code` 输出对应数字，登录三类不可区分语义仍由「同 401 + 同 message」保证。文档源真实契约以 005 的 [api-contract.md](../../005-unified-response/contracts/api-contract.md) 为准，本文历史描述不再逐条改写。

> ⚠️ **2026-10-26（005-unified-response，T031）**：CRUD `data` 五形态落地——`GET /users` 文档 data 为页码分页 `{total,list,page,pageTotal,index}`（入参 page/pageSize）；`GET /users/detail` data 为 `UserResponseDto|null`（不存在 200 + null，文档 404 仍全套注入）；`POST /users/delete` 与 `/auth/logout` data 为 `null`（`DeleteResultResponse` 模型已删）。详见 005 [api-contract.md](../../005-unified-response/contracts/api-contract.md)。

所有响应错误体统一为 `{ code: string, message: string | string[], statusCode: number }`（既有 `HttpExceptionFilter`）。

## 1. 文档暴露契约

| 场景                                             | GET /api-docs              | GET /api-docs-json  |
| ------------------------------------------------ | -------------------------- | ------------------- |
| local / uat（或 SWAGGER_ENABLED=true）           | 200，Swagger UI HTML       | 200，OpenAPI 3 JSON |
| production（NODE_ENV=production 且未显式开启）   | 404                        | 404                 |
| production + SWAGGER_ENABLED 非法值（如 `ture`） | 应用启动 fail-fast，不启动 | 同左                |

文档源 JSON 的机器可断言要求：

- `openapi` 主版本为 3.x；`info.title` 非空、`info.version` 非空。
- `paths` 必须包含下表全部 9 个业务路径（方法级）与 3 个 infra 路径。
- `components.securitySchemes.Bearer` 存在，scheme=bearer。
- 每个受保护 operation 的 `security` 含 `Bearer`；公开 operation 无 `security` 要求。

## 2. 业务接口呈现契约（9 个）

### auth 分组

#### POST /auth/login — 公开

- summary：用户名或邮箱登录，签发不透明访问令牌。
- security：无。
- body：`LoginDto`（identifier 必填 2–254；password 必填 8–64）。
- responses：
  - 200：`LoginResultResponse` `{ token, expiresAt(date-time), user: UserResponseDto }`
  - 400：`ErrorResponse`，code=`VALIDATION_ERROR`，message 为字段错误数组
  - 401：`ErrorResponse`，code=`INVALID_CREDENTIALS`（密码错/账号不存在/软删/锁定期对外统一）

#### POST /auth/logout — 登录用户

- security：Bearer。
- body：无。
- responses：
  - 200：`LogoutResultResponse` `{ success: true }`
  - 401：`ErrorResponse`（无令牌/伪造/过期/已登出）

### users 分组

#### POST /users — 公开（注册）

- security：无。
- body：`CreateUserDto`（username 2–32；email 合法邮箱 ≤254；password 8–64 且须同时含字母与数字）。
- responses：
  - 200：`UserResponseDto`（6 字段，无 password）
  - 400：`VALIDATION_ERROR`
  - 409：code=`USERNAME_EXISTS` 或 `EMAIL_EXISTS`

#### GET /users/me — 登录用户

- security：Bearer。无 query/body。
- responses：200 `UserResponseDto`；401。

#### POST /users/me — 登录用户

- security：Bearer。body：`UpdateUserDto`（email? 合法邮箱 ≤254）。
- responses：200 `UserResponseDto`；400 `VALIDATION_ERROR`；401；409 `EMAIL_EXISTS`。

#### GET /users — 管理员

- security：Bearer；description 注明需管理员角色。
- query：`UserQueryDto`（limit? 整数 ≥1 缺省 20 封顶 50；cursor? MongoId）。
- responses：
  - 200：`UserListPageResponse` `{ items: UserResponseDto[], nextCursor: string|null }`
  - 400 `VALIDATION_ERROR`；401；403（登录但非管理员）

#### GET /users/detail — 管理员

- security：Bearer（管理员）。query：`id`（MongoId 字符串）。
- responses：200 `UserResponseDto`；400 `INVALID_ID`；401；403；404 `USER_NOT_FOUND`。

#### POST /users/admin — 管理员

- security：Bearer（管理员）。body：`SetAdminDto`（id MongoId；isAdmin boolean）。
- responses：200 `UserResponseDto`；400（含 `INVALID_ID`/`VALIDATION_ERROR`）；401；403；404 `USER_NOT_FOUND`。

#### POST /users/delete — 管理员

- security：Bearer（管理员）。body：`DeleteUserDto`（id MongoId）。
- responses：
  - 200：`DeleteResultResponse` `{ id }`
  - 400（含 `INVALID_ID`/`VALIDATION_ERROR`）；401；403；404 `USER_NOT_FOUND`；409 `LAST_ADMIN_PROTECTED`

## 3. infra 分组（粗粒度，FR-016）

| 接口              | security | 文档深度                                          |
| ----------------- | -------- | ------------------------------------------------- |
| GET /             | 无       | 仅 summary，响应标 200 text/string，不建模        |
| GET /health/live  | 无       | summary 注明不触依赖；200 不细建 schema           |
| GET /health/ready | 无       | summary 注明 Mongo+Redis 检查；200/503 仅文字说明 |

## 4. 鉴权调试契约（Swagger UI Authorize）

1. 文档页提供一个 Authorize 入口，字段为 Bearer token 值（调用方无需手填 `Bearer ` 前缀，UI 自动拼接）。
2. 设置后发出的请求带 `Authorization: Bearer <token>`；这是唯一调试出示方式，文档不得出现 query/cookie 令牌字段。
3. E2E 真实性要求：经文档源无法验证运行时鉴权，因此调试链路以 supertest 模拟「UI 实际发出的请求形态」断言：
   - 无 Authorization 调 GET /users/me → 401；
   - 登录获取 token 后带 `Authorization: Bearer <token>` → 200；
   - 普通用户 token 调 GET /users → 403；
   - logout 后同 token 再调 → 401。
     该组断言与既有 001/003 E2E 行为一致，放在新 swagger E2E 套件中作为「文档调试无旁路」证据，不替代既有套件。

## 5. 注解约束一致性（防漂移）

| DTO 字段                          | 文档必须呈现的约束                                              |
| --------------------------------- | --------------------------------------------------------------- |
| LoginDto.identifier               | required, string, minLength 2, maxLength 254                    |
| LoginDto.password                 | required, string, minLength 8, maxLength 64                     |
| CreateUserDto.username            | required, 2–32                                                  |
| CreateUserDto.email               | required, email format, maxLength 254                           |
| CreateUserDto.password            | required, 8–64, pattern 字母+数字                               |
| UpdateUserDto.email               | optional, email, 254                                            |
| SetAdminDto.id / DeleteUserDto.id | required, MongoId（24 位十六进制）                              |
| SetAdminDto.isAdmin               | required, boolean                                               |
| UserQueryDto.limit                | optional, integer, minimum 1（description 注明缺省 20/封顶 50） |
| UserQueryDto.cursor               | optional, MongoId                                               |

E2E 至少对 `LoginDto.password` 的 minLength/maxLength 与 `CreateUserDto.password` 的 pattern 在文档源 JSON 中断言，作为漂移哨兵；其余字段靠评审清单核对。
