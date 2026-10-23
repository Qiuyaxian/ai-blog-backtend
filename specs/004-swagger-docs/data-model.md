# Data Model：Swagger 接口文档接入（004）

**性质**：本功能**无持久化数据、无 MongoDB/Redis 变更**。本文档描述的是随代码构建的 OpenAPI 文档元数据模型与环境配置，不是业务实体。

## 1. 环境配置

| 键                | 位置                                          | 必填 | 取值                                                   | 缺省行为                                                 |
| ----------------- | --------------------------------------------- | ---- | ------------------------------------------------------ | -------------------------------------------------------- |
| `SWAGGER_ENABLED` | `.env.local` / `.env.uat` / `.env.production` | 否   | `true` / `false`（大小写不敏感，其他值启动 fail-fast） | 未配置时按 `NODE_ENV`：`production` → false，其余 → true |

- 读取路径：`ConfigService → isSwaggerEnabled(nodeEnv, override)` 纯函数，业务代码不直读 `process.env`（宪法原则 II）。
- 三套 env 文件本期显式写值（local/uat=true，production=false），保证运维清单可见。
- 不新增 MongoDB 连接、缓存键、索引或迁移；无 expand-contract 事项。

## 2. OpenAPI 文档元数据

### 2.1 文档级（DocumentBuilder）

| 元数据          | 取值                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| title           | `ai-blog-backtend API`                                                                     |
| version         | 服务版本（取 package.json `version`，构建时传入，不硬编码）                                |
| description     | 中文简介：本服务业务接口文档；token 获取方式说明（登录接口返回不透明令牌，Authorize 填入） |
| tags            | `auth`（认证）、`users`（用户）、`infra`（基础设施）三组                                   |
| security scheme | name `Bearer`；type `http`；scheme `bearer`；bearerFormat `Opaque`；in header              |
| 文档路径        | UI：`/api-docs`；文档源：`/api-docs-json`                                                  |

### 2.2 操作（Operation）元数据：9 个业务接口 + 3 个 infra

每个 operation 描述：分组 tag、HTTP 方法、路径、中文 summary、鉴权要求、请求模型/参数、成功响应、真实会发生的错误响应（详见 [contracts/api-contract.md](./contracts/api-contract.md)）。

鉴权三档（文档标注，不参与运行时）：

| 档位     | 文档标注                            | 真实运行时机制（既有，不改）      |
| -------- | ----------------------------------- | --------------------------------- |
| 公开     | 无 security                         | `@Public()` + 全局 AuthGuard 放行 |
| 登录用户 | `@ApiBearerAuth()`                  | 全局 AuthGuard 验 Bearer 会话     |
| 管理员   | `@ApiBearerAuth()` + 描述注明 + 403 | RolesGuard `@Roles('admin')`      |

### 2.3 Schema 模型清单（文档模型，非新集合）

**请求模型（与既有 DTO 1:1，仅加注解，不改字段与校验）**

| 模型            | 字段                      | 关键约束（与 class-validator 同源）                       |
| --------------- | ------------------------- | --------------------------------------------------------- |
| `LoginDto`      | identifier, password      | identifier 必填 string 2–254；password 必填 string 8–64   |
| `CreateUserDto` | username, email, password | username 2–32；email 邮箱 ≤254；password 8–64 且字母+数字 |
| `UpdateUserDto` | email?                    | 可选；邮箱 ≤254                                           |
| `SetAdminDto`   | id, isAdmin               | id MongoId；isAdmin boolean                               |
| `DeleteUserDto` | id                        | id MongoId                                                |
| `UserQueryDto`  | limit?, cursor?           | limit 可选整数 ≥1，缺省 20 封顶 50；cursor 可选 MongoId   |

**响应模型**

| 模型                                 | 字段                                                                                                | 用途                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `UserResponseDto`（既有，补注解）    | id:string, username:string, email:string, isAdmin:boolean, createdAt:date-time, updatedAt:date-time | 注册、本人资料、详情、提降权、登录内嵌用户 |
| `LoginResultResponse`（新建文档类）  | token:string, expiresAt:date-time, user:UserResponseDto                                             | POST /auth/login 200                       |
| `UserListPageResponse`（新建文档类） | items:UserResponseDto[], nextCursor:string\|null                                                    | GET /users 200                             |
| `LogoutResultResponse`（新建文档类） | success:true                                                                                        | POST /auth/logout 200                      |
| `DeleteResultResponse`（新建文档类） | id:string                                                                                           | POST /users/delete 200                     |
| `ErrorResponse`（新建文档类）        | code:string, message:string\|string[], statusCode:number                                            | 全部错误响应统一体                         |

> 响应文档类仅承载 OpenAPI schema（装饰器元数据），不改变任何 controller 的实际返回值；controller 返回类型已与这些结构一致，无需响应拦截器。

**敏感信息红线**：所有文档模型与 example 中禁止出现 password、usernameLower、deletedAt、`__v`、连接串、真实 token；example 一律占位值（如 `token: "opaque-token-example"`、`password: "Passw0rd!"`）。

## 3. 状态机 / 开关行为

```text
启动 bootstrap
  └─ setupSwagger(app, config)
       ├─ isSwaggerEnabled() === false（production）→ 不注册任何文档路由 → /api-docs* 404
       └─ true（local/uat 或显式覆盖）→ createDocument + setup('/api-docs')
            → /api-docs 返回 UI；/api-docs-json 返回 OpenAPI JSON
```

开关只在启动时读取一次；不支持运行时动态切换（无此需求，YAGNI）。

## 4. 跨模块/跨集合读取

无。本功能不访问任何业务集合，不触发 EVO-20261023001 的跨模块只读协作口要求。
