# Implementation Plan: Swagger 接口文档接入（004-swagger-docs）

**Branch**: `004-swagger-docs` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-swagger-docs/spec.md`

## Summary

在 NestJS 9 + Express 服务中接入 @nestjs/swagger ^7.4.2（已核实 peerDependencies 支持 `@nestjs/common/core ^9 || ^10`）：

1. 新增 `src/common/swagger/` 横切模块：纯函数 `isSwaggerEnabled(nodeEnv)`（仅 production 关闭）+ `setupSwagger(app, config)`（DocumentBuilder 元数据、Bearer 安全方案、`/api-docs` UI 与 `/api-docs-json` 文档源，仅在开关打开时挂载）。
2. `src/main.ts` 与 `test/helpers/e2e-app.ts` 调用同一个 `setupSwagger`，消除入口与测试环境漂移。
3. 给 9 个业务接口（auth 2 个、users 7 个）补 `@ApiTags/@ApiOperation/@ApiBearerAuth/@ApiResponse`；6 个 DTO 与公开响应模型补 `@ApiProperty`（含 class-validator 同源约束）；鉴权元数据沿用既有守卫/`@Public` 语义，公开接口显式 `@ApiNoAuth`。
4. 单测覆盖开关纯函数；新增 E2E 套件：local 下 UI/文档源 200 且含全部 9 路径与 bearer 方案、production 下两者 404、文档内 Bearer 调试走真实守卫。
5. 无数据库/缓存变更，无新业务依赖（除指定文档组件），零运行时业务行为变更。

## Technical Context

**Language/Version**: TypeScript 5.0.0 / Node 20

**Primary Dependencies**: NestJS 9.0.0（common/core/platform-express）、@nestjs/swagger ^7.4.2（新增，唯一直接生产依赖）、class-validator 0.14、class-transformer 0.5

**Storage**: 无变更（MongoDB / Redis 不参与本功能）

**Testing**: Jest 单测（源码同目录 `*.spec.ts`，全 mock 外部依赖）+ Jest/supertest E2E（`test/*.e2e-spec.ts`，自举应用，`--runInBand`，真实本地 mongod + redis，测试库 `ai_blog_test`）

**Target Platform**: Linux/macOS 服务端；local / uat / production 三环境按 `NODE_ENV` 加载 env

**Project Type**: web-service（NestJS 后端 API）

**Performance Goals**: 文档挂载仅启动期一次性构建 OpenAPI 文档；不介入业务请求管线，对既有接口 P95 零影响

**Constraints**: production 下文档 UI、文档源、静态资源全部不可访问（404）；零运行时业务行为变更；直接新增生产依赖恰好 1 个，不升级 NestJS，不引入 fastify 可选依赖

**Scale/Scope**: 9 个既有业务接口 + 6 个请求 DTO + 4 类响应模型（UserResponse / LoginResult / UserListPage / LogoutResult）+ 统一错误体；2 个新源码文件、1 个新单测、1 个新 E2E 套件

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 宪法原则                  | 结论                | 依据                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. TypeScript-First       | ✅ 通过             | 全部新增代码显式类型，禁 `any`；文档注解与 DTO 类型同源；新增响应模型为显式 class 而非裸对象                                                                                                                                                                         |
| II. 模块边界与分层        | ✅ 通过             | 文档装配属横切能力，落 `src/common/swagger/`，与 cache/filters/interceptors 同级；不新增业务模块、不跨模块直连 Schema；Controller 仍只做参数/调用/返回，注解为声明式元数据不是业务逻辑；配置只经 ConfigService                                                       |
| III. Test-First           | ✅ 通过（非协商项） | 新增生产逻辑：`isSwaggerEnabled` 纯函数先写 RED 单测；`setupSwagger` 行为经 E2E 先写失败用例（200/404/文档源路径清单/bearer 鉴权调试）；DTO 注解为声明式元数据，GREEN 验证为「文档源反映注解」的 E2E 断言，先红后绿；纯文档/配置任务（env 文件、docs）标 `[no-test]` |
| IV. 安全与合规默认开启    | ✅ 通过             | production 默认关闭文档（FR-011）；文档不提供鉴权旁路，调试请求走真实全局 AuthGuard；示例值全部占位，禁止真实密码/令牌；响应模型只含 6 个公开字段，password `select:false` 不进入文档模型；不新增绕过 Guard/Pipe 的路径                                              |
| V. 可观测、可灰度、可回滚 | ✅ 通过             | 无 DB/API 变更，无 expand-contract 需要；环境开关即灰度手段（local→uat 开放，production 关闭）；回滚 = 还原依赖与注解，≤ 5 分钟；文档装配异常不影响业务路由（仅在 listen 前执行，失败则启动失败而非运行期故障）                                                      |

依赖引入顺序检查：标准库/平台能力 → 已装依赖 → 成熟生态。Swagger UI 无标准库/平台内置方案；@nestjs/swagger 为 NestJS 官方生态组件、周下载量千万级、版本由需求指定且已核实与 NestJS 9 兼容；不引入 swagger-ui-express 之外的传递依赖（其由组件自身声明，pnpm 自动解析）。重大选型 → ADR-005。

无宪法违背项，Complexity Tracking 表不适用（保持空白）。

## Project Structure

### Documentation (this feature)

```text
specs/004-swagger-docs/
├── spec.md              # 功能规格（WHAT/WHY）
├── plan.md              # 本文件
├── research.md          # Phase 0：组件机制、环境开关、鉴权元数据调研结论
├── data-model.md        # Phase 1：文档元数据模型（无持久化实体）
├── quickstart.md        # Phase 1：人工冒烟与自动化验证指南
├── contracts/
│   └── api-contract.md  # 9 个接口在文档中必须呈现的操作/模型/鉴权契约
├── checklists/
│   └── requirements.md  # spec 质量清单（已通过）
└── tasks.md             # /speckit-tasks 产出（本命令不创建）
```

### Source Code (repository root)

```text
src/
├── main.ts                      # 调 setupSwagger(app, configService)，listen 前
├── common/
│   └── swagger/
│       ├── swagger.ts           # isSwaggerEnabled 纯函数 + buildSwaggerConfig + setupSwagger
│       ├── swagger.spec.ts      # 开关纯函数单测（local/uat/production/undefined/显式覆盖）
│       └── response-schemas.ts  # LoginResultResponse/UserListPageResponse/LogoutResultResponse
│                                # （UserResponseDto 已存在，仅补 @ApiProperty）
├── health/health.controller.ts  # @ApiTags('infra') 粗粒度标注（FR-016，不逐字段细注）
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts   # @ApiTags('auth')；login 公开无锁；logout bearer
│   │   └── dto/login.dto.ts     # @ApiProperty + 约束/example
│   └── user/
│       ├── user.controller.ts   # @ApiTags('users')；register 公开；me 登录；4 个 admin 接口 bearer+admin
│       └── dto/                 # 5 个 DTO + UserResponseDto 补 @ApiProperty
└── app.controller.ts            # @ApiTags('infra') 或 @ApiExcludeController（plan 决策：归入 infra 组）

test/
├── helpers/e2e-app.ts           # 与 main.ts 同样调 setupSwagger（消除漂移）
└── swagger-docs.e2e-spec.ts     # 新套件：200/文档源/404/bearer 调试真实守卫
```

**Structure Decision**: 单项目 web-service（沿用现状）。Swagger 装配是横切基础设施而非业务域，放 `src/common/swagger/`（对齐 `src/common/cache`、`filters`、`interceptors` 既有惯例）；不为文档新建业务模块。响应文档模型集中在 `response-schemas.ts` 单文件（4 个小 class），避免一模型一文件的样板；已存在的 `UserResponseDto` 原地补注解，不重复造模型。

### 环境配置

```text
.env.local       SWAGGER_ENABLED=true   # 显式声明，便于 E2E 与运维清单可见
.env.uat         SWAGGER_ENABLED=true
.env.production  SWAGGER_ENABLED=false
```

配置读取经 `ConfigService`；键缺省时回退 `NODE_ENV !== 'production'`（fail-safe：只有显式 production 才关闭，详见 research R1）。

## Phase 0 Research 摘要

详见 [research.md](./research.md)。关键结论：

- **R1 环境开关**：判定抽纯函数 `isSwaggerEnabled(nodeEnv, override?)`，默认规则 `NODE_ENV === 'production'` 关闭、其余开放；env `SWAGGER_ENABLED` 显式值优先。纯函数可单测，E2E 以 `process.env.NODE_ENV` 切换验证 404。
- **R2 生产 404 机制**：不调用 `SwaggerModule.setup()` 即不注册任何路由/静态资源，Express 对未注册路径天然 404；不需要守卫文档路由（避免半开页面泄露结构）。
- **R3 鉴权元数据**：DocumentBuilder `addBearerAuth()` 定义方案；`@ApiBearerAuth()` 标注受保护操作，`@ApiNoAuth`/省略安全标注公开操作（login/register）。运行时鉴权仍只由全局 AuthGuard + `@Public()` 决定，注解不改变行为。
- **R4 入口一致性**：main.ts 与 e2e-app.ts 必须调同一 `setupSwagger`；ponytail 注释标明两处调用需同步（与现有 pipe/filter/interceptor 重复同性质）。
- **R5 依赖与兼容性**：@nestjs/swagger 7.4.2 peer 为 `@nestjs/common/core ^9 || ^10`、`reflect-metadata ^0.1.12 || ^0.2.0`，本仓满足；`@fastify/static` 为 optional peer，Express 项目不安装；swagger-ui-express 为其正常依赖自动安装。
- **R6 DTO 约束同源**：`@ApiProperty` 的 `minLength/maxLength/pattern/example` 手工对齐 class-validator 装饰器，不引入自动反射额外插件；评审清单加「注解约束与校验规则一致」防漂移。
- **R7 错误模型**：复用 `HttpExceptionFilter` 统一错误体 `{code,message,statusCode}` 建一个 `ErrorResponse` schema，按操作实际发生情况引用 400/401/403/404/409，不标注接口从不返回的状态码。

## Phase 1 Design 摘要

- 数据模型：无持久化实体。文档元数据模型见 [data-model.md](./data-model.md)（OpenAPI 操作、DTO Schema、环境开关）。
- 契约：9 个业务接口的文档呈现契约见 [contracts/api-contract.md](./contracts/api-contract.md)，与 001/003 已交付契约一致，本功能只描述不修改。
- 验证：[quickstart.md](./quickstart.md) 给出 E2E 新套件、单测、手工冒烟三步。

## Complexity Tracking

无宪法违背，无需填写。
