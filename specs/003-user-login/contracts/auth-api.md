# 接口契约：登录鉴权 API（Auth API）

**日期**：2026-10-22 | **对应规格**：[spec.md](../spec.md) FR-001~021

所有 HTTP 接口沿用现有约定：无外层 envelope，成功直接返回数据；错误统一体 `{ code, message, statusCode }`（`HttpExceptionFilter`）；结构化访问日志（不记录 body、不记录令牌）。

## 1. POST /auth/login — 登录（公开）

**鉴权**：`@Public()`，无需令牌。

**Request Body**（`LoginDto`，全局 ValidationPipe：whitelist + forbidNonWhitelisted + transform）：

| 字段         | 类型   | 约束                                                                              |
| ------------ | ------ | --------------------------------------------------------------------------------- |
| `identifier` | string | 必填；trim 后非空；minLength 2；maxLength 254（覆盖用户名 32 / 邮箱 254）         |
| `password`   | string | 必填；长度 8–64（与注册强度区间一致；仅判非空与长度，登录路径不强制字符组合规则） |

**200 登录成功**：

```json
{
  "token": "9f8c…（64 字符 hex）",
  "expiresAt": "2026-10-29T14:00:00.000Z",
  "user": {
    "id": "653a…",
    "username": "alice",
    "email": "alice@example.com",
    "isAdmin": false,
    "createdAt": "2026-10-20T10:00:00.000Z",
    "updatedAt": "2026-10-20T10:00:00.000Z"
  }
}
```

- `expiresAt`：绝对时间（ISO 8601），= 签发时刻 + 7 天（FR-005）。
- `user` 复用 001 `UserResponseDto` 脱敏形状，MUST NOT 含 `password`/`deletedAt`/`usernameLower`。

**错误响应**：

| 状态码 | code                  | 触发条件                                                                                                   |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | 字段缺失/为空/超长/类型错误（message 为字段错误数组）                                                      |
| 401    | `INVALID_CREDENTIALS` | 标识不存在（含已软删）、密码错误、或账号处于锁定期；三类响应完全相同（FR-006，锁定命中仅在服务端日志记录） |
| 500    | `INTERNAL_ERROR`      | Mongo/Redis/bcrypt 非预期故障；登录时会话写入失败也返回 500，且 MUST NOT 返回令牌                          |

## 2. POST /auth/logout — 登出（已认证）

**鉴权**：必须携带有效 Bearer 令牌。

**Request**：无请求体要求。该路由不绑定 DTO，全局 ValidationPipe 不对其 body 做校验（客户端发送任何 body 均被忽略，不影响登出语义；鉴权只认 Authorization 头）。

**200**：

```json
{ "success": true }
```

语义：删除当前令牌对应会话键（DEL 幂等，FR-012）。只吊销当前会话，不影响该用户其他会话（FR-018）。

**错误响应**：401 `UNAUTHENTICATED`（无令牌/非法/过期/已登出/账号已软删/会话存储不可用）。

## 3. 受保护接口的鉴权约定（Bearer）

除 §4 白名单外，**全部**既有与新增接口默认需要令牌（FR-008）。

**Request Header**：

```text
Authorization: Bearer <token>
```

- 唯一出示方式；不接受 query 参数、Cookie（FR-008 澄清）。
- 头缺失、scheme 非 `Bearer`（大小写不敏感）、令牌段为空 → 401。

**Guard 处理顺序（AuthGuard → 既有 RolesGuard）**：

1. 路由带 `@Public()` → 直接放行。
2. 提取 Bearer 令牌；格式非法 → 401 `UNAUTHENTICATED`。
3. 查 `auth:sess:<sha256(token)>`：键不存在（过期/已登出/伪造）→ 401；Redis 异常 → 401（fail-closed，FR-015）。
4. 以会话 `sub` 回查 Mongo 当前账号：不存在/已软删 → 401；账号状态查询本身失败（依赖不可用）→ fail-closed，不放行（FR-015）；正常时得到当前 `isAdmin`。
5. 注入 `request.user = { id, isAdmin }`（沿用 001 `CurrentUser` 形状）。
6. 控制器级 `RolesGuard` 按既有规则判 `@Roles('admin')`：普通用户 → 403 `FORBIDDEN`（降权即时生效，FR-011）。

## 4. 公开路由白名单（@Public）

| 方法 | 路径            | 说明                       |
| ---- | --------------- | -------------------------- |
| POST | `/auth/login`   | 登录                       |
| POST | `/users`        | 注册（001 既有，保持公开） |
| GET  | `/health/live`  | 存活探针（不触依赖）       |
| GET  | `/health/ready` | 就绪探针                   |
| GET  | `/`             | 根欢迎路由                 |

其余既有接口认证要求不变：`GET/POST /users/me` 认证-only；`GET /users`、`GET /users/detail`、`POST /users/admin`、`POST /users/delete` 需 admin。

## 5. 错误码汇总（本期新增）

| code                  | 状态码 | 语义                                                                  |
| --------------------- | ------ | --------------------------------------------------------------------- |
| `INVALID_CREDENTIALS` | 401    | 登录标识不存在/软删、密码错误、或账号锁定期内（三者不可区分，FR-006） |
| `UNAUTHENTICATED`     | 401    | 复用 001：缺失/无效/过期/吊销令牌，会话存储或账号状态不可核验         |
| `FORBIDDEN`           | 403    | 复用 001：已认证但角色不足                                            |
| `VALIDATION_ERROR`    | 400    | 复用：输入校验失败                                                    |

锁定期不使用独立状态码或错误码（安全评审结论：423 会泄露账号存在并允许主动锁死他人账号）；锁定命中通过服务端结构化日志（可按 requestId 关联）记录真实原因。

## 6. 安全契约（验收点）

- 任何响应体与日志 MUST NOT 出现密码；除 `POST /auth/login` 成功体外 MUST NOT 出现令牌；日志 MUST NOT 出现完整令牌（FR-014，由"不记 body + 不记 Authorization 头"满足）。
- 登录成功/失败/登出在服务端有结构化日志可按 requestId 关联；锁定命中记真实原因但对客户端返回统一 401（复用访问日志 + AuthService 内安全事件日志，令牌与密码脱敏）。
- 对不存在标识的请求 MUST NOT 在 Redis 产生计数/锁定键（FR-013 澄清）。
