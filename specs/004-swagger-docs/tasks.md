---
description: 'Task list for 004-swagger-docs'
---

# Tasks: Swagger 接口文档接入（004-swagger-docs）

**Input**: Design documents from `specs/004-swagger-docs/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/api-contract.md、quickstart.md

**Tests**: 宪法原则 III 不可协商——所有生产逻辑任务 RED→GREEN→REFACTOR；纯文档/配置/重命名任务标 `[no-test]`。

**Organization**: 按 spec 用户故事分组（US1 P1 文档内容、US2 P2 Bearer 调试、US3 P1 生产关闭），US2 依赖 US1 的装配但独立可验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可并行（不同文件、无依赖）
- 每个任务含精确文件路径与验收标准

---

## Phase 1: Setup（共享前置）

**Purpose**: 依赖安装与分支

- [x] ✅ T001 从 `develop` 切出分支 `feat/004-swagger-docs`（禁直接改 main/develop；远程操作需人工授权）。验收：`git branch --show-current` 为目标分支。`[no-test]`（实际：仓库无 develop 分支，2026-10-24 从 003 收尾点 `3bc66a0` 切出 `feat/swagger_api_docs`）
- [x] ✅ T002 安装指定依赖 `pnpm add @nestjs/swagger@^7.4.2`（沙箱拦网络/store 权限时在沙箱外执行，禁止改 CI 或 `--no-verify`）。验收：package.json dependencies 仅新增 `@nestjs/swagger`，NestJS 仍为 9.x，无 `@fastify/static`，`swagger-ui-express` 作为其传递依赖出现；`pnpm install` 退出 0。`[no-test]`（依赖安装，非生产逻辑）（实测 2026-10-24：7.4.2 运行时依赖为 `swagger-ui-dist@5.17.14` 而非 swagger-ui-express——包内自带 express loader；@fastify/static 仅 devDependencies 未安装；锁文件 +6 包，无 Nest 框架升级）

---

## Phase 2: Foundational（阻塞性基建）

**Purpose**: 环境开关纯函数 + 文档装配函数；US1/US2/US3 全部依赖它。

**⚠️ CRITICAL**: 本阶段完成前不写任何 Controller/DTO 注解。

- [x] ✅ T003 [P] RED：新建 `src/common/swagger/swagger.spec.ts`，为 `isSwaggerEnabled(nodeEnv, override?)` 写 8 个用例（quickstart §2.1 表：local/uat/production/undefined 默认、显式 true/false 覆盖、大写 TRUE、非法值 `ture` 抛错）。先运行确认因模块不存在而失败。（✅ 2026-10-24：模块缺失 TS2307 失败确认）
- [x] ✅ T004 GREEN→REFACTOR：新建 `src/common/swagger/swagger.ts` 实现 `isSwaggerEnabled`（规则见 research R1：默认 `nodeEnv !== 'production'`；`SWAGGER_ENABLED` 显式值大小写不敏感覆盖；非法值 fail-fast）。导出配置键常量 `SWAGGER_ENABLED_KEY`。验收：T003 全绿。（✅ 8/8 绿）
- [x] ✅ T005 [P] 在同文件实现 `setupSwagger(app: INestApplication, config: ConfigService): void`：关闭时直接 return（R2，不 createDocument 不 setup）；开启时 `DocumentBuilder`（title/version 取 package.json version/description、tags auth/users/infra、`addBearerAuth` Opaque 方案）→ `SwaggerModule.createDocument` → `SwaggerModule.setup('api-docs', app, document)`（文档源默认即 `/api-docs-json`）。验收：纯装配无业务分支；不读 `process.env`，只经 ConfigService + 入参 nodeEnv。（✅ version 经 require package.json，tsconfig 未开 resolveJsonModule）
- [x] ✅ T006 `src/main.ts` 在 `listen` 前注入 `ConfigService`（`app.get(ConfigService)`）并调用 `setupSwagger`；加 ponytail 注释指明与 `test/helpers/e2e-app.ts` 为仅有的两个装配点，改动需同步（R4）。验收：`pnpm build:local` 通过；本地启动后访问 `/api-docs` 返回 UI 页面（文档源可加载，内容此时仅有 info/tags 骨架，业务操作在 US1 注解任务补齐）。（✅ build 0；3100 端口实测 UI 200 text/html 含 swagger-ui 标记、JSON 200、10 路径/3 tags/bearer scheme）
- [x] ✅ T007 `test/helpers/e2e-app.ts` 在 `app.init()` 前调用同一 `setupSwagger(app, app.get(ConfigService))`，更新该文件既有 ponytail 同步注释。验收：既有 E2E 套件零改动仍全绿（行为不变）。（✅ 6 suites / 36 tests 全绿）
- [x] ✅ T008 [P] `[no-test]` 三套 env 文件新增键：`.env.local`/`.env.uat` 写 `SWAGGER_ENABLED=true`，`.env.production` 写 `SWAGGER_ENABLED=false`（仅占位/本地值，禁止真实密钥）。同步运维手册 env 清单 `docs/operations/README.md`（新增一行：键、用途、三环境值）。（✅ 实际 env 清单权威表在 docs/development/development.md，已补行；operations/README 无 env 清单表）

**Checkpoint**: 装配基建就绪；开关可单测；真实入口与测试入口同源。

---

## Phase 3: User Story 1 - 完整在线接口文档（Priority: P1）🎯 MVP

**Goal**: `/api-docs` 在 local/uat 展示 9 个业务接口 + infra，分组、鉴权标注、请求/响应/错误模型完整且与真实契约一致。

**Independent Test**: quickstart §2.2 A 组断言全绿 + 浏览器冒烟看到全部接口。

### Tests for User Story 1（先写，先失败）

- [x] ✅ T009 RED：新建 `test/swagger-docs.e2e-spec.ts`（经 `createTestApp` 自举，--runInBand，真实本地 mongod+redis，库 `ai_blog_test`）。A1：`GET /api-docs` 200 且正文含 swagger-ui 标记；`GET /api-docs-json` 200。先确认失败（T005 装配已挂但注解未加时路径已存在——故本用例在 T007 后即通过，真正 RED 点放 T010/T011 内容断言）。
- [x] ✅ T010 RED（内容）：文档源 JSON 断言——`info.title/version` 非空；`paths` 含 9 个业务路径+方法与 3 个 infra 路径（清单见 contracts §1/§2/§3）；`components.securitySchemes.Bearer.scheme==='bearer'`；受保护 7 处 operation 的 `security` 含 Bearer、login/register 无 security。此时因无注解必须失败。
- [x] ✅ T011 RED（模型与防漂移哨兵）：文档源断言——`LoginDto.password` minLength=8/maxLength=64；`CreateUserDto.password.pattern` 非空且与 DTO 正则同义；`UserResponseDto` schema 属性集合恰为 6 个公开字段（不含 password/usernameLower/deletedAt）；`ErrorResponse` 含 code/message/statusCode。失败确认。

### Implementation for User Story 1

- [x] ✅ T012 [P] [US1] `src/modules/auth/dto/login.dto.ts` 与 `src/modules/user/dto/create-user.dto.ts`、`update-user.dto.ts`（可选字段用 `@ApiPropertyOptional`）、`set-admin.dto.ts`、`delete-user.dto.ts`、`user-query.dto.ts` 补 `@ApiProperty`：字段中文 description、required、minLength/maxLength/pattern/example、MongoId 用 24 位 hex 示例、limit 注明缺省 20 封顶 50。约束逐字对齐 class-validator（research R6 表）。验收：不改任何既有校验装饰器与字段。
- [x] ✅ T013 [P] [US1] 新建 `src/common/swagger/response-schemas.ts`：`LoginResultResponse`（token/expiresAt date-time/user \$ref）、`UserListPageResponse`（items 数组/nextCursor nullable）、`LogoutResultResponse`（success const true）、`DeleteResultResponse`（id）、`ErrorResponse`（code/message oneOf string|string[]/statusCode）；example 全部占位值，禁止真实凭据。
- [x] ✅ T014 [P] [US1] `src/modules/user/dto/user-response.dto.ts` 给 6 个既有字段补 `@ApiProperty`（id string、createdAt/updatedAt date-time）；不新增/不删字段，`toUserResponse` 不动。
- [x] ✅ T015 [US1] `src/modules/auth/auth.controller.ts`：`@ApiTags('auth')`；login 加 `@ApiOperation` 中文摘要、`@ApiBody`（由 DTO 自动）、200 `LoginResultResponse`、400/401 `ErrorResponse`（按 contracts §2 auth 表，不标永不返回的码）；logout 加 `@ApiBearerAuth()`、200 `LogoutResultResponse`、401。
- [x] ✅ T016 [US1] `src/modules/user/user.controller.ts`：`@ApiTags('users')`，7 个操作逐一加注解（contracts §2 users 表）：POST /users 公开无 security（201/400/409 双 code）；GET+POST /users/me Bearer（200/400/401/409）；GET /users、/users/detail、POST /users/admin、POST /users/delete 标 Bearer 且摘要注明管理员（200/400 INVALID_ID|VALIDATION_ERROR/401/403/404 USER_NOT_FOUND，delete 另加 409 LAST_ADMIN_PROTECTED；list 200 用 UserListPageResponse，delete 200 用 DeleteResultResponse）。
- [x] ✅ T017 [US1] `src/app.controller.ts` 与 `src/health/health.controller.ts`：`@ApiTags('infra')` + 简要 `@ApiOperation`，均无 security；health ready 文字注明 200/503 但不细建 terminus 模型（FR-016 粗粒度）。
- [x] ✅ T018 GREEN：跑 `pnpm test:e2e -- swagger-docs` 确认 T009–T011 全绿；REFACTOR 消除重复的错误响应声明（可抽 `apiErrorResponses` 局部辅助，仅限注解声明，不造业务抽象）。验收：9 路径/3 infra、安全标注、模型哨兵断言全过。

**Checkpoint**: US1 可独立演示——浏览器看到完整文档且内容断言通过。

---

## Phase 4: User Story 2 - 文档页 Bearer 在线调试（Priority: P2）

**Goal**: Authorize 填令牌后页面调用真实走全局 AuthGuard，四态身份结果与外部调用一致。

**Independent Test**: quickstart §2.2 A3 四态断言 + 手工 Authorize 冒烟。

### Tests for User Story 2（先写）

- [ ] ⬜ T019 RED：在 `test/swagger-docs.e2e-spec.ts` 追加四态用例（形态模拟 Swagger UI 发出的请求，contracts §4）：无 Authorization 调 GET /users/me→401；注册+登录取 token 后带 `Authorization: Bearer <token>`→200；普通用户 token 调 GET /users→403；调 logout 后原 token 再调 /users/me→401。注：运行时行为已由 003 保证，本组用例的 RED 价值在于随 US1 注解/装配落地后作为「调试链路无旁路」回归网——若 T015/T016 安全元数据或装配未生效即失败；先确认在当前进度下失败/或明确以文档源 security 断言（T010）为 RED，本任务在 T018 后可直接绿，tasks 执行时在 tasks.md 记录实际顺序证据。

### Implementation for User Story 2

- [ ] ⬜ T020 [US2] 核对并补齐 Bearer 方案细节：DocumentBuilder `addBearerAuth({ type:'http', scheme:'bearer', bearerFormat:'Opaque', in:'header', name:'Authorization' })`，受保护操作均挂 `@ApiBearerAuth()`（T015/T016 已加则只核对）；不添加任何 query/cookie 令牌入口（FR-009）。验收：文档源中受保护 operation security 引用名与 scheme 一致；无其他 token 参数。
- [ ] ⬜ T021 [US2] 手工冒烟（quickstart §3.1–3.4）并在 tasks.md 勾选处附真实结果摘要：登录 →Authorize→/users/me 200→ 普通用户 /users 403→logout 后 401。

**Checkpoint**: US1+US2 联调闭环可用。

---

## Phase 5: User Story 3 - production 文档关闭（Priority: P1，安全硬约束）

**Goal**: production 下 UI/文档源/静态资源全 404；业务行为零变化。

**Independent Test**: quickstart §2.2 B 组。

### Tests for User Story 3（先写）

- [ ] ⬜ T022 RED：同套件内新增独立 bootstrap 用例：临时置 `process.env.NODE_ENV='production'`、覆盖 MONGODB_URI/Redis 到本地测试资源，用与 main.ts 相同步骤创建应用并调用 `setupSwagger`；断言 GET /api-docs→404、GET /api-docs-json→404、swagger-ui 静态资源路径（如 `/api-docs/swagger-ui-bundle.js` 或 setup 实际挂载的资产前缀，执行时以未注册路径任选其一并在断言注释写明）→404；对照 POST /auth/login 仍走业务管线（不存在凭据 →401 INVALID_CREDENTIALS，而非 404）。**环境隔离**：`.env.production` 指向 `localhost/ai_blog`（非测试库且有 IPv6 风险），bootstrap 前必须显式覆盖 `process.env.MONGODB_URI=mongodb://127.0.0.1:27017/ai_blog_test`、Redis 相关键沿用 `test/setup-env.ts` 的本地值；ConfigModule 读取的是启动时的 `process.env`，故须在 `NestFactory.create` 之前完成覆盖。结束恢复 `NODE_ENV='local'` 并关闭 app。先确认在任何错误实现（如 production 仍 setup）下失败。

### Implementation for User Story 3

- [ ] ⬜ T023 [US3] 依据 T022 结果修正 `setupSwagger`/env 默认规则（T004/T005 已按 R1/R2 实现，预期仅验证不改码；若发现 setup 仍注册路由则修复直到 404）。验收：B 组全绿；production 启动日志无 swagger 路由注册、无文档构建开销。
- [ ] ⬜ T024 [US3] 安全核对：grep 注解/example 确认无真实密码、真实 token、连接串（FR-013）；文档模型不暴露 password 字段（T011 哨兵 + 人工 grep `example:` 复核）。验收：grep 结果仅占位值。

**Checkpoint**: 生产不暴露文档的硬承诺由自动化守住。

---

## Phase 6: Polish & Cross-Cutting

- [ ] ⬜ T025 `[no-test]` 建 ADR-005 `docs/architecture/adr/ADR-005-swagger-api-docs.md`（组件选型与 Nest9 兼容性证据、环境暴露策略、Bearer 调试无旁路、与契约漂移控制），先 Pending；在 `docs/architecture/README.md` ADR 索引与 `docs/index.md` 登记。
- [ ] ⬜ T026 `[no-test]` 更新 `docs/architecture/data-flows.md`（如其中有接口清单/工具章节，补一句文档入口 `/api-docs`，无则跳过并在任务备注说明）；更新 `AGENTS.md` §2.4 常用命令附近或开发指南加入「查看接口文档：local/uat 访问 /api-docs，prod 关闭」。
- [ ] ⬜ T027 全量门禁（verification-before-completion，证据贴本任务）：`pnpm lint && pnpm test && pnpm test:e2e && pnpm build:local`，退出码全 0；记录套件/用例数与新增数；核对 SC-001–SC-008。
- [ ] ⬜ T028 按 quickstart §3 完成本地手工冒烟（含 production 404），更新 `docs/context.md`（进行中工作/会话记录/决策草稿区加 ADR-005 指针）。
- [ ] ⬜ T029 执行 `/evolve`：产出或归并本次复盘（重点候选：注解约束与 class-validator 同源的评审项、main/e2e 双入口装配同步），规则归并权威文件后 EVO 置 applied。
- [ ] ⬜ T030 编排方收尾：handoff 置 `complete`、OCR 评审（`ocr review -B ./specs/004-swagger-docs/checklists/requirements.md`）、按 §6.6 发起 PR（执行方不自行置 complete/合并/推远程）。

---

## Dependencies & Execution Order

```text
T001 → T002 → T003(RED) → T004(GREEN) → T005 → T006/T007/T008
  → US1: T009 → T010/T011(RED) → T012/T013/T014[P] → T015 → T016 → T017 → T018(GREEN)
  → US2: T019 → T020 → T021
  → US3: T022(RED) → T023 → T024
  → Polish: T025 → T026 → T027 → T028 → T029 → T030
```

- T006/T007/T008 不同文件可并行；T012/T013/T014 不同文件可并行。
- T015 依赖 T013（响应模型）；T016 依赖 T013/T014；T018 依赖全部注解任务。
- US3 的 T022 依赖装配函数（T005）与真实登录行为（003 已交付），不依赖 US2 注解，但执行顺序排在 US1 后便于复用同一测试文件。

## Notes

- 所有测试先确认 RED 再写实现；注解类任务的 GREEN 证据是文档源 JSON E2E 断言（T010/T011），不是手点页面。
- 不得借本功能修改任何接口路径、响应字段、守卫逻辑；发现既有契约与文档不符时停下登记，不擅自改业务码。
- 新增直接生产依赖恰好 1 个（@nestjs/swagger）；任何额外包需回 spec/plan 说明理由。
- 提交遵循 Conventional Commits（subject 中文语义在前、英文不大写开头），小步提交；禁 `--no-verify`。
- handoff：003 当前仍 `executing`（待评审收尾）；本 feature 的 ready_for_execution 切换由编排方在 003 关闭后处理，执行方不得自行接管他人 handoff。
