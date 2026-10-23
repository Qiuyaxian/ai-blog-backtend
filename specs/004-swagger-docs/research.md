# Research：Swagger 接口文档接入（004）

**日期**：2026-10-24 **状态**：Confirmed（plan 阶段）

研究方法：npm registry 核实 peerDependencies（官方源）；@nestjs/swagger 7.x 公开 API 与本仓 NestJS 9.0.0 / Express 平台事实核对；对照现有 `main.ts`、`test/helpers/e2e-app.ts`、auth/user 模块守卫现状。

## R1 环境开关：默认规则与显式覆盖

- **Decision**：判定抽纯函数 `isSwaggerEnabled(nodeEnv: string | undefined, override?: string): boolean`。
  - 默认：`nodeEnv !== 'production'`（local/uat/未设置时开放，production 关闭）。
  - 显式覆盖：env `SWAGGER_ENABLED` 仅在值为 `'true' | 'false'` 时生效（大小写不敏感）；其他值 fail-fast 抛错（对齐既有 `getAuthTokenTtlSeconds` 的 fail-fast 风格，避免拼错的 `ture` 被静默当 false）。
  - 三个 env 文件显式写 `SWAGGER_ENABLED=true/true/false`，让运维清单可见。
- **Rationale**：默认规则 fail-safe 方向是「只有明确生产才关闭」，避免新环境（如测试/预演分支）意外无文档；生产关闭由 `NODE_ENV=production` 双保险（即使 env 键漏配也关闭）。纯函数不依赖 Nest 容器，单测零 mock。
- **Alternatives**：① 只认显式布尔 env、缺省关闭——被否，漏配会让 local/uat 文档消失且不易发现；② 单独维护允许环境白名单数组——被否，YAGNI，三环境下布尔规则足够。

## R2 production 下 404 的实现机制

- **Decision**：`setupSwagger()` 内判定关闭时**直接 return，不调用** `SwaggerModule.setup()`，也不调用 `createDocument`。
- **Rationale**：`SwaggerModule.setup(path, app, document, options)` 才会注册 UI 路由（`/path`、`/path-json` 及其 swagger-ui 静态资源）。不 setup 时这些路由全部不存在，Express 对未注册路径天然落入未知路由 → 404，与任意拼错路径行为一致，不泄露「文档存在但被禁」的差异。`createDocument` 也跳过，生产启动不产生文档构建开销。
- **Alternatives**：① setup 后用 Guard/中间件拦截文档路由——被否，路由与静态资源仍注册，响应形态（403 vs 404）暴露文档存在，且要维护资产路径黑名单；② 条件注册 UI 但保留 json——被否，FR-002 要求文档源同样不可访问。
- **测试含义**：production 404 用例必须在「未 setup」的真实应用上验证，而非只测纯函数；E2E 以独立 bootstrap 流程切换 `NODE_ENV`（见 tasks）。

## R3 Bearer 鉴权元数据与运行时鉴权的关系

- **Decision**：
  - `DocumentBuilder.addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'Opaque', in: 'header' })` 定义一个安全方案（默认引用名 `Bearer`）。
  - 受保护操作方法级标注 `@ApiBearerAuth()`；公开操作（`POST /auth/login`、`POST /users`）不标注（等价无安全要求）。
  - Controller 不做类级 `@ApiBearerAuth`，逐方法显式标注，保证「公开/登录/管理员」三档与真实守卫配置逐路由对齐，防止新增公开接口时被类级注解误标为需鉴权。
  - 管理员接口在 operation 描述中注明「需要管理员角色」（Swagger/OpenAPI 无独立角色概念，角色差异以文字 + 403 响应承载）。
- **Rationale**：Swagger 安全元数据只影响文档展示与 UI 注入 `Authorization` 请求头，不注册任何运行时守卫；运行时鉴权仍只由 AuthModule 的全局 `APP_GUARD`（AuthGuard + `@Public()` 元数据）与 RolesGuard 决定。因此「文档调试无旁路」天然成立——UI 发出的 HTTP 请求与外部请求过同一条管线。
- **Alternatives**：类级 `@ApiBearerAuth` + 公开方法 `@ApiNoAuth`——被否，默认值方向危险（新方法默认在文档里显示锁，且与全局守卫「默认拒绝」虽一致，但 login/register 漏标 `@ApiNoAuth` 即文档错误；方法级显式标注在评审中更显眼）。`@ApiNoAuth` 仅用于根路径/健康检查若被类级注解覆盖时，本期这些 infra 接口单独成组、不标注鉴权。

## R4 应用入口与 E2E 入口共用同一装配函数

- **Decision**：`src/common/swagger/swagger.ts` 导出 `setupSwagger(app: INestApplication, config: ConfigService): void`；`src/main.ts` 在 `listen` 前调用；`test/helpers/e2e-app.ts` 在 `app.init()` 前调用同一函数。
- **Rationale**：现有 e2e-app.ts 已用 ponytail 注释承认其与 main.ts 的 3 行全局 pipe/filter/interceptor 重复需手工同步；Swagger 装配加入同一重复面，必须同函数复用，否则 production-404 这类承诺在测试应用与真实应用上行为不同，E2E 失去意义。
- **Alternatives**：抽一个 `bootstrapGlobalEnhancers(app)` 把 pipe/filter/interceptor/swagger 全部收口——方向正确但超出本 feature 范围（会改动既有 3 处行为行），登记为后续重构候选，本期只保证 Swagger 单点。

## R5 依赖兼容性与安装清单

- **Decision**：`pnpm add @nestjs/swagger@^7.4.2`（生产 dependencies）。
- **核实证据**（`npm view ... --registry=https://registry.npmjs.org`）：
  - 7.4.2 peerDependencies：`@nestjs/common: ^9.0.0 || ^10.0.0`、`@nestjs/core: ^9.0.0 || ^10.0.0`、`reflect-metadata: ^0.1.12 || ^0.2.0`、`class-validator: *`、`class-transformer: *`、`@fastify/static: ^6 || ^7`（optional peer）。
  - 本仓：common/core 9.x、reflect-metadata 0.1.13、class-validator 0.14、class-transformer 0.5 → 全部满足。
  - 平台为 platform-express → `@fastify/static` 不装；`swagger-ui-express` 是 @nestjs/swagger 的正常依赖自动安装，不算新增直接依赖。
- **Alternatives**：降级 @nestjs/swagger 6.x（仅支持 Nest 9）——被否，需求明确指定 ^7.4.2，且 7.x 已兼容 9；升级 NestJS 10——被否，超出需求、放大回归面。
- **安装注意**：沙箱可能拦网络或 pnpm store 权限；失败时在沙箱外执行（对齐 context.md §8 bcrypt 经验），不得改 CI 或用 `--no-verify`。

## R6 DTO 约束与文档注解同源、防漂移

- **Decision**：每个 DTO 属性保持「class-validator 装饰器（运行时真值）+ @ApiProperty（文档）」上下相邻；`@ApiProperty` 中用 `required/minLength/maxLength/pattern/example/enum/description` 复述同一约束：
  - `LoginDto.identifier`：string、required、2–254、example `alice`（同时给邮箱示例说明）；`password`：8–64，example 占位 `Passw0rd!`。
  - `CreateUserDto`：username 2–32；email email/254；password 8–64 + pattern「字母+数字」。
  - `UpdateUserDto.email`：optional、email、254（`@ApiPropertyOptional`）。
  - `SetAdminDto`：id MongoId 字符串、isAdmin boolean。
  - `DeleteUserDto`：id MongoId。
  - `UserQueryDto`：limit 可选整数、min 1、缺省 20、封顶 50（description 注明）；cursor 可选 MongoId。
  - `UserResponseDto`：6 字段，`id` string、createdAt/updatedAt string(date-time)；**不新增 password 等字段**。
- **Rationale**：不引入额外插件（如自动从 validator 生成约束的库）——YAGNI，6 个 DTO 手写量小；防漂移靠两条：评审清单加「约束一致」核对项；E2E 断言文档源关键字段（如 login password minLength=8/maxLength=64）。
- **Alternatives**：`@nestjs/swagger` 的 `CliPlugin`（编译期自动推断 `?` 可选与部分装饰器）——不采用，需改 nest-cli.json 且隐式行为增加理解成本，显式注解更符合本仓显式风格。

## R7 统一错误响应模型与状态码标注范围

- **Decision**：在 `response-schemas.ts` 定义 `ErrorResponse`（`code: string`、`message: string | string[]`、`statusCode: number`）。每操作只标注**真实会发生**的错误：

  | 操作                          | 标注的错误响应                                                        |
  | ----------------------------- | --------------------------------------------------------------------- |
  | POST /auth/login              | 400 VALIDATION_ERROR、401 INVALID_CREDENTIALS（含锁定，对外不可区分） |
  | POST /auth/logout             | 401                                                                   |
  | POST /users（注册）           | 400、409 USERNAME_EXISTS / EMAIL_EXISTS                               |
  | GET /users/me、POST /users/me | 401、400（POST 校验）                                                 |
  | GET /users（列表）            | 401、403、400（查询参数）                                             |
  | GET /users/detail             | 401、403、400 INVALID_ID、404 USER_NOT_FOUND                          |
  | POST /users/admin             | 401、403、400、404、409（业务冲突若有）                               |
  | POST /users/delete            | 401、403、400、404、409 LAST_ADMIN_PROTECTED                          |

  成功响应同时标注（201 注册、200 其余；list 为分页对象）。

- **Rationale**：FR-007 明确要求「实际会发生」，标注永不返回的 500/422 等会制造错误契约；错误码文案以 `HttpExceptionFilter` 与 service 实际抛出为准（tasks 执行时逐个 grep 核实，不照抄本表）。
- **Alternatives**：全局 `@ApiResponse` 一次性给所有操作挂全套错误码——被否，产生大量假契约。

## R8 健康检查与根路径的呈现

- **Decision**：health（live/ready）与根 `GET /` 归 `infra` 分组，类/方法级 `@ApiTags('infra')` + 简要 `@ApiOperation`，不逐字段定义 terminus 响应模型（FR-016 允许粗粒度）；均标注为公开（无 `@ApiBearerAuth`）。
- **Rationale**：运维接口可见有利于联调健康检查；Terminus 响应结构稳定但逐字段注解价值低，YAGNI。
