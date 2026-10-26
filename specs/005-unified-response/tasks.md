---
description: 'Task list for 005-unified-response'
---

# Tasks: 全局统一响应外壳（005-unified-response）

**Input**: Design documents from `specs/005-unified-response/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/api-contract.md、quickstart.md

**Tests**: 宪法原则 III 不可协商——所有生产逻辑任务 RED→GREEN→REFACTOR；纯文档/配置/重命名任务标 `[no-test]`。

**Organization**: Phase 1 Setup → Phase 2 错误外壳（filter，契约最硬）→ Phase 3 成功外壳（interceptor + 装配）→ Phase 4 Swagger 模型 → Phase 5 E2E 迁移 → Phase 6 Polish。错误侧先行，成功侧随后，E2E 在两者齐备后统一迁移（避免半成品阶段大面积红灯无法定位）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可并行（不同文件、无依赖）
- 每个任务含精确文件路径与验收标准

---

## Phase 1: Setup（共享前置）

**Purpose**: 分支与外壳常量/类型。

- [x] ✅ T001 从 `develop` 切出分支 `feat/005-unified-response`（无 develop 时从当前主干人工确认点切出，禁直接改 main/develop；远程操作需人工授权）。验收：`git branch --show-current` 为目标分支，工作树干净。`[no-test]`（实际：仓库无 develop，2026-10-26 从 004 收尾点 `da5cd9d` 切出 `feat/005-unified-response`）
- [x] ✅ T002 RED：新建 `src/common/response/response.constants.spec.ts`，为 `isEnvelopeExcludedPath(path)` 写用例：`'/'`→true、`'/health'`→true、`'/health/live'`→true、`'/health/ready'`→true、`''`→false、`'/users'`→false、`'/healthx'`→false、`'/health-2'`→false；并断言导出 `SUCCESS_CODE==='SUCCESS'`、`SUCCESS_MESSAGE==='ok'`。先运行确认因模块缺失失败（TS2307）。（✅ 2026-10-26：TS2307 失败确认，5 用例）
- [x] ✅ T003 GREEN→REFACTOR：新建 `src/common/response/response.constants.ts`：导出 `SUCCESS_CODE`、`SUCCESS_MESSAGE`、`interface ApiResponse<T>`、纯函数 `isEnvelopeExcludedPath`（research R3），加 JSDoc。无 `any`。验收：T002 全绿。（✅ 5/5 绿）

**Checkpoint**: 豁免规则可单测锁定，filter/interceptor 共用。

---

## Phase 2: 错误响应外壳（US2，先做错误侧）

**Purpose**: filter 错误体从 `{code,message,statusCode}` 改为 `{code,data:null,message,path,time}`，并对豁免路径透传。

**⚠️ CRITICAL**: 只改 filter 产出形状与测试，不改 `normalize` 的 status/code/message 判定逻辑（FR-006 错误码值不变）。

- [x] ✅ T004 RED：改写 `src/common/filters/http-exception.filter.spec.ts`（mockHost 按 path 构造；4 旧用例断言改五字段外壳；新增 ready 503 透传、`/` 透传 2 例）。先运行确认失败。（✅ 2026-10-26：6/6 先红确认）
- [x] ✅ T005 GREEN→REFACTOR：改 `src/common/filters/http-exception.filter.ts`：豁免路径 `passthrough` 原样 json（Terminus 503 原生体），非豁免 body 改 `{code,data:null,message,path,time}`；`normalize` 的 status/code/message 判定逻辑不动；删 `ErrorBody.statusCode`；500 仍只入日志。验收：T004 全绿 6/6。

**Checkpoint**: 错误外壳统一且探针失败体不被污染；业务 success 路径此时仍裸返回（预期，Phase 3 补）。

---

## Phase 3: 成功响应外壳（US1）

**Purpose**: 全局拦截器包裹 9 个业务接口成功返回；两装配点注册。

- [x] ✅ T006 RED：新建 `src/common/response/transform-response.interceptor.spec.ts`（mock context/handler：业务路径五字段且 data 引用保留、live/`/` 透传、异常不吞）。先确认模块缺失失败。（✅ 2026-10-26：TS2307 确认）
- [x] ✅ T007 GREEN→REFACTOR：新建 `src/common/response/transform-response.interceptor.ts`（`map` 包裹，豁免透传，不 catch/不日志/不读 query，JSDoc + ponytail 天花板注释）。验收：T006 4/4 绿。
- [x] ✅ T008 在 `src/main.ts` 注册 `new TransformResponseInterceptor()`（在 AccessLog 前），更新注释。验收：`pnpm build:local` 通过。（✅ build 成功）
- [x] ✅ T009 `test/helpers/e2e-app.ts` 同序注册；`loginHelper` 改取 `res.body.data.token`；更新双装配点注释。验收：单测全绿。（✅ 25 套件/189 全绿；E2E 待 Phase 5 迁移）

**Checkpoint**: 运行时成功/错误外壳齐备；E2E 待迁移。

---

## Phase 4: Swagger 外壳模型（US3 文档部分）

**Purpose**: 文档成功/错误模型呈现新外壳，旧 statusCode 模型移除。

- [x] ✅ T010 [P] RED（✅ 2026-10-26 文档源断言全过）：在 `test/swagger-docs.e2e-spec.ts` 文档源哨兵用例中改/加断言：① 改写现有「ErrorResponse 含 code/message/statusCode」用例（该文件约 L100）：模型名改为 `ErrorEnvelope`，断言含 `code/data/message/path/time`、`data` nullable、**不含** `statusCode`；② 登录 200 响应 schema 为五字段外壳（`properties` 含 `code/data/message/path/time`，`data.$ref` 指向登录结果模型）；③`components.schemas` 不存在名为 `ErrorResponse` 的旧模型。先确认失败（注解尚未改、旧模型仍在）。
- [x] ✅ T011 GREEN→REFACTOR（✅ 模型落地）：新建 `src/common/response/response-schemas.ts`：
  - 定义 `EnvelopeBase`（`@ApiProperty` 的 code/message/path/time，含示例）；
  - 5 个成功外壳 `LoginEnvelope/UserEnvelope/UserListPageEnvelope/LogoutEnvelope/DeleteEnvelope extends EnvelopeBase`，各自 `data` 用 `@ApiProperty({type:X})` 标注；
  - `ErrorEnvelope`：`data` `@ApiProperty({nullable:true, example:null, ...})`、`message` oneOf string/array、无 statusCode（research R5，以实际文档源渲染微调 type）；
  - 把 `LoginResultResponse/LogoutResultResponse/UserListPageResponse/DeleteResultResponse` 等 data 模型类从 `src/common/swagger/response-schemas.ts` 迁入（`UserResponseDto` 仍从 user 模块 import，不移动域 DTO）。
    验收：T010 文档源断言通过。
- [x] ✅ T012 删除 `src/common/swagger/response-schemas.ts`，更新 `src/modules/auth/auth.controller.ts` 与 `src/modules/user/user.controller.ts` 的 import 与成功 `@ApiResponse({type})`（换 5 个 Envelope 类），错误 `@ApiResponse({type:ErrorEnvelope})`；description 文案中「统一错误体 code/message/statusCode」改为五字段表述。不改任何运行时代码/守卫/HttpCode。验收：`pnpm build:local` + `pnpm lint` 通过；T010 绿。`[no-test]`（注解行为由 T010 E2E 覆盖，本任务为声明式迁移）

**Checkpoint**: 文档与真实契约一致。

---

## Phase 5: E2E 契约迁移（US1/US2/US3 端到端）

**Purpose**: 6 个业务 E2E 套件断言迁到新外壳；豁免路径套件保持不变并补探针不回归断言。逐套件改、逐套件绿（`pnpm test:e2e -- <file>` 或全量）。

- [x] ✅ T013 [P] `test/user-register.e2e-spec.ts`（✅ 2026-10-26 6/6 绿）：成功 `body.id/...`→`body.data.id` 等；注册脱敏断言针对 `data`；注册后登录取 `data.token/data.user`；新增一个顶层键集合断言（五字段且无多余键）；错误用例补 `data===null` 且无 `statusCode`。验收：该套件全绿。
- [x] ✅ T014 [P] `test/user-profile.e2e-spec.ts`（✅ 2026-10-26 6/6 绿）：成功读 `data.id/data.email/data.isAdmin`；错误 `code` 路径不变并补 `data:null`/无 `statusCode`；401 未登录用例不变（HTTP 状态不变）。验收：全绿。
- [x] ✅ T015 [P] `test/user-admin.e2e-spec.ts`（✅ 2026-10-26 6/6 绿）：列表 `data.items/data.nextCursor`、详情/提权/删除读 `data.*`；删除结果 `toEqual({id})` 改为针对 `data`；错误用例补外壳断言。验收：全绿。
- [x] ✅ T016 `test/auth-login.e2e-spec.ts`（✅ 2026-10-26 15/15 绿）：所有 `rememberSessionKey(res.body.token)`→`data.token`（经 helper 的登录已自动迁移，本文件内直接取 token 处逐一改）；`data.expiresAt/data.user`；logout 成功断言针对 `data`；**全等体**用例（未知账号 ≡ 错误密码、锁定第六次 ≡ 第一次）改为 `toMatchObject({code:'INVALID_CREDENTIALS',data:null,path:'/auth/login'})` + `expect(typeof body.time).toBe('string')`（research R7，禁止整体 toEqual）。验收：全绿。
- [x] ✅ T017 `test/swagger-docs.e2e-spec.ts`（✅ 11/11 绿，data.username 已迁移）：Bearer 调试段业务断言（`res.body.username` 等）迁到 `data`；production 401 `code` 断言不变；与 T010/T012 的文档源断言合并无冲突。验收：全绿。
- [x] ✅ T018 豁免回归（✅ 2026-10-26 3/3 绿，ready 已补无外壳键断言）：`test/app.e2e-spec.ts`（`GET /` 仍 `Hello World!`）、`test/redis-health.e2e-spec.ts`（live/ready 200 原生 Terminus 体）保持断言不变并确认通过；在 redis-health 或新用例中补一条 ready 响应**不含** `code/data/message` 外壳键的断言。验收：两套件绿。
- [x] ✅ T019 残留清理 grep 证据（✅ 2026-10-26 E2E 7 套件 47/47 绿；grep 仅剩「不含 statusCode」负断言/文档源哨兵/日志字段）（写入 PR 描述）：`grep -rn "res.body.statusCode\|body.token\|body.user\b" test/` 业务断言 0 命中（文档源/helper 除外）；`grep -rn "statusCode" src/common/filters/http-exception.filter.ts` 仅剩 HTTP status 变量；E2E 全量 `pnpm test:e2e` 退出 0（真实 mongod+redis，7 套件）。

**Checkpoint**: 端到端契约全绿；探针零回归。

---

## Phase 6: Polish（文档、门禁、复盘）

- [x] ✅ T020 `[no-test]` 新建 ADR-006（✅ 已建+登记索引，Pending）（`docs/architecture/adr/ADR-006-unified-response-envelope.md`）：统一外壳字段、错误体扁平化、豁免路径、HTTP 语义状态码保留、一次性破坏性切换（无外部消费方）与回滚；登记到架构 ADR 索引；初版状态 Pending。
- [x] ✅ T021 `[no-test]` 文档同步（✅ 001/003/004 契约加 005 指针、data-flows 登录段、coding-style §1.4 外壳条）：更新 001/003/004 的 contracts 中响应示例或加指针指向本功能 `contracts/api-contract.md`（不逐条重写历史，加「响应外壳见 005」声明即可，避免大 diff）；`docs/architecture/data-flows.md` 若有响应体示例则同步；`docs/development/coding-style.md` 新增「接口响应统一外壳、业务代码不手工构造、新接口自动获得外壳、错误码抛字符串」一条。
- [x] ✅ T022 全量门禁（✅ 2026-10-26：lint 0 退出；单测 25 套件 189/189；E2E 7 套件 47/47；build:local exit 0）（证据驱动）：`pnpm lint`、`pnpm test`（单测）、`pnpm test:e2e`（真实依赖）、`pnpm build:local` 均退出 0；记录套件/用例数与输出。
- [x] ✅ T023 手工冒烟（✅ 2026-10-26 quickstart §2 全 8 步通过：201/200×3/400/401/403/404/409、豁免三路径、文档源 6 Envelope；context.md 已更新）（quickstart §2 全 8 步，含 400/401/403/404/409、health/root 豁免、Swagger 文档外观），记录结果；更新 `docs/context.md`（进行中工作/会话记录/决策草稿指向 ADR-006）。`[no-test]`
- [x] ✅ T024 执行 `/evolve`（✅ EVO-20261026001 P1 applied：规则归并 test/arch/dev 三 agent + 机制索引；handoff complete 待编排方）
- [x] ✅ T025（用户追加，2026-10-26）抽取 Swagger 错误响应声明：`response-schemas.ts` 新增 `ApiErrorResponses(statuses[], overrides?)` 工厂 + `ERROR_DESCRIPTIONS` 默认描述表（未登记码 fail-fast）；auth/user 两 controller 9 个接口的逐个错误 `@ApiResponse` 全部替换为一行声明，成功 `@ApiResponse({type})` 保留（data 类型逐接口不同）。哨兵：swagger-docs E2E 新增「9 操作响应码集合固定 + 4xx 全部 $ref ErrorEnvelope」用例；工厂 3 单测（默认描述/覆盖/fail-fast）。验收：lint 0；单测 26 套件 192；E2E 7 套件 48；build 0。ADR-006 决策 8、coding-style §1.4 同步。 复盘（破坏性契约变更的评审/测试迁移教训），产出 EVO 记录并按机制归并；通过 verification-before-completion 后由编排方将 handoff 置 `complete`（执行方不自行置位）。
- [x] ✅ T026（用户追加，2026-10-26）守卫与鉴权错误文档绑定：新增 `src/modules/user/guards/auth.decorators.ts`，`@AuthOnly()` = `UseGuards(RolesGuard)` + `@ApiBearerAuth('Bearer')` + `ApiErrorResponses([401])`；`@AdminOnly()` = `@AuthOnly()` + `@Roles('admin')` + `ApiErrorResponses([403])`（TDD：先写 `auth.decorators.spec.ts` 2 用例断言 GUARDS/ROLES/API_RESPONSE/API_SECURITY 元数据）。user controller 6 个受保护接口与 auth logout 替换 `@UseGuards(RolesGuard)`/`@Roles`/`@ApiBearerAuth` 样板，接口 `ApiErrorResponses` 去掉守卫负责的 401/403，只留 400/404/409；login 为 `@Public`（401 是凭据错误、非守卫）不动。响应码集合不变（swagger E2E 哨兵仍绿）。验收：lint 0；单测 27 套件 194；E2E 7 套件 48；build:local 0。ADR-006 决策 9、coding-style §1.4 同步。
- [x] ✅ T027（用户追加，2026-10-26）外壳对齐 `@nestarc/safe-response`：字段改 4 字段 `{success,code,message,data}`（删 path/time，成功 success:true、失败 success:false；data 支持 null/[]/{}/对象，原样保留不替换）；错误码集中到 `response.constants.ts` 的 `ERROR_CODES`（code→ 中文文案单一配置点，过滤器据此出 message，未登记码回退原 message）；Swagger 成功响应免逐接口注解——启用 `@nestjs/swagger` CLI 插件（nest-cli.json，ts-jest E2E 经 test/ts-jest.transformers.js 对齐）从 controller 返回类型推断 data 模型，新增纯函数 `wrapSuccessEnvelope(document)`（7 单测：$ref/内联对象/数组/201/4xx 不动/豁免路径/幂等/空内容）在 createDocument 后统一包 allOf(SuccessEnvelope + data)，删除 5 个 Envelope 子类与 9 个成功 `@ApiResponse`；data 模型归域（auth/dto/login-result.dto.ts、user/dto/user-list-page.dto.ts、delete-result.dto.ts），logout 返回 null。验收：lint 0 warning；单测 28 套件 207；E2E 7 套件 48；build:local 0；3000 冒烟 register/409/login/me/logout/401 全为 4 字段。ADR-006 决策 10、coding-style §1.4 同步。
- [x] ✅ T028（用户追加，2026-10-26）状态码与错误响应进一步全局化，控制器零响应注解：① 新增纯函数 `src/common/response/success-status.ts` 的 `resolveSuccessStatus(method,path)`（GET 恒 200；POST 资源根 201；POST 子路径动作 200）+ 5 单测；`TransformResponseInterceptor` 成功 `tap` 里 `res.status()` 落地（拦截器新增 5 用例：GET 200/POST 根 201/5 个动作 200/豁免不改码），删除 9 个接口全部 `@HttpCode`。②`wrapSuccessEnvelope` 增两件事：按 `resolveSuccessStatus` 归一 2xx 文档键（消除无 @HttpCode 时插件对 POST 默认 201 的漂移）、给每个非豁免操作统一注入全套 `400/401/403/404/409`（$ref ErrorEnvelope、通用文案、幂等不覆盖、豁免不注入）+ 6 单测；ErrorEnvelope 模型随函数注册。③ 删除 `src/common/response/response-schemas.ts` 与其单测（`ApiErrorResponses` 工厂废弃），controller 删除全部 `@ApiErrorResponses`，`@AuthOnly/@AdminOnly` 收敛为守卫+Bearer+角色（其单测去掉 API_RESPONSE 断言）。验收：lint 0；单测 28 套件 232；E2E 7 套件 48（真实状态码不变）；swagger E2E 哨兵改为「成功码按路由约定 + 全套 4xx $ref」。ADR-006 决策 13（8 废弃、9 收敛）、005 契约 §5、coding-style §1.4 同步。文档错误枚举不逐接口收窄为用户明确接受的精度权衡。④ 错误配置单一来源：`response.constants.ts` 改 `ERROR_CATALOG`（码 →`{status,message,docLabel?}`），运行时 `ERROR_CODES`、Swagger 状态集合 `SWAGGER_ERROR_STATUSES` 与描述 `swaggerErrorDescription` 全部派生，删除 wrap-envelope 内第二份 `ERROR_DESCRIPTIONS`（500 不挂 docLabel 故不进文档）；新增 catalog 派生哨兵 5 单测。
- [x] ✅ T029（用户追加，2026-10-26）成功 HTTP 状态码统一 200：删除已退化为恒值的 `resolveSuccessStatus`/`success-status.ts(.spec)`，拦截器所有成功分支（含 `POST /users` 注册）均设置 `HttpStatus.OK`，Swagger 唯一 2xx 键统一归一为 200；错误码与错误状态不变（400/401/403/404/409，未知服务器异常 500）。TDD：先改 interceptor/wrap-envelope 单测与 5 个 E2E 套件注册期望为 200 并确认 RED，再改实现。验收：lint 0；单测 27 套件 222 项、E2E 7 套件 48 项、build:local 0；ADR-006 决策 14、005 spec/plan/contract、001/004 契约、coding-style、context 同步。

### Phase 7: T030 修订——外壳 code 改数字状态码（用户追加 2026-10-26）

**契约**：`ApiResponse.code:string→number`，恒等于 HTTP 状态码；成功 200，失败 400/401/403/404/409/500。服务异常（抛出点/异常类型/HTTP 状态行/message/鉴权校验）全保留；10 个字符串码降为内部异常键 + `ERROR_CATALOG` 键，不再出现在响应体。同状态细分靠 message。

- [x] ✅ T030-1 RED（✅ 2026-10-26 先红确认：constants/filter/wrap-envelope 3 套件失败）：改 `src/common/response/response.constants.spec.ts` 断言 `SUCCESS_CODE===200`（数字）、`ApiResponse.code` 数字；改 `http-exception.filter.spec.ts` 全部错误体断言 `code` 为数字状态（400/401/403/404/409/500），message 文案断言保留，豁免透传分支不变；改 `transform-response.interceptor.spec.ts` 成功体 `code===200`；改 `wrap-envelope.spec.ts` 两个 Envelope schema 的 `code` type 为 `number`、示例 200/409。运行确认 RED。
- [x] ✅ T030-2 GREEN（✅ 单测 27 套件 222 项全绿）：`response.constants.ts`：`SUCCESS_CODE` 改 `HttpStatus.OK`（200，number），`ApiResponse.code:number`；`transform-response.interceptor.ts` 成功体 `code:SUCCESS_CODE`；`http-exception.filter.ts` 非豁免 body `code` 输出 `normalize` 得到的数字 `status`（`normalize` 不再返回字符串 code，message 仍按内部键查 `ERROR_CODES`，抛出键/异常类型/`response.status()` 全不动）；`wrap-envelope.ts` Success/Error Envelope 的 `code` schema 改 `{type:'number', example:200/409}` 与描述。验收：T030-1 全绿，无 `any`。
- [x] ✅ T030-3 E2E 迁移（✅ E2E 7 套件 48 项全绿）：register/profile/admin/login/swagger-docs 把错误体字符串 code 断言改为 HTTP 状态数字 `body.code`（401/409/400/404），成功 code 改 200；重复用户名/邮箱用例改为同 409、按 message 文案区分；Swagger 文档源断言 Success/Error Envelope `code.type=number`；豁免路径套件不变。
- [x] ✅ T030-4 文档同步 `[no-test]`（✅）：005 spec/contract/data-model（T030 修订块）/tasks/quickstart、ADR-006 决策 15、001/003/004 契约外壳指针、`docs/development/coding-style.md` §1.4 外壳条；`docs/context.md` 会话记录。
- [x] ✅ T030-5 全量门禁（✅ 2026-10-26：lint 0；单测 27 套件 222；E2E 7 套件 48；build:local 0；src/test 字符串 code 外壳断言 grep 0 命中，仅余内部异常抛出点与 catalog 键）：`pnpm lint`、`pnpm test`、`pnpm test:e2e`（真实 mongod+redis）、`pnpm build:local` 均退出 0；`/evolve` 复盘数字码契约。

---

### Phase 8: T031 修订——CRUD `data` 五类形态锁定（用户追加 2026-10-26，规划层已改，代码待执行）

**契约**（spec FR-016/017/018、SC-008/009/010；contract §1 表/§2 接口表/§3 示例；data-model §6；ADR-006 决策 16；001 user-api §4/§5/§7；coding-style §1.4）：

1. 分页列表：`data={total,list,page,pageTotal,index}`（`index=(page-1)*pageSize+1` 从 1 起；`pageTotal=ceil(total/pageSize)`，total=0 时 0）；入参 `page`（缺省 1）+`pageSize`（缺省 20/封顶 50）替换 `cursor/limit`。
2. 删除：`data=null`（替换 `{id}`）。
3. 更新：`data=` 更新后完整对象（现状已满足）。
4. 创建：`data=` 新建对象（现状已满足）。
5. 只读单查：不存在（含软删）200 + `data:null`（不抛 404；非法 id 仍 400）；写操作 admin/delete 目标不存在仍 404。

> 执行纪律：严格 TDD（先 RED 再 GREEN）；先改 spec/contract/FR/ADR（本 Phase 前置，已完成），再改实现与全部下游断言/文档。动态/计算字段（`total/pageTotal/index`）断言按 EVO-20261026001：稳定字段 `toMatchObject`、计算字段断数值与公式、内容负断言保留安全语义。

- [x] ✅ T031-1 RED 分页契约（✅ 2026-10-26 前序会话已落）：改 `src/modules/user/user.service.spec.ts` 列表用例——`list({page:1,pageSize:20})` 返回 `{total,list,page,pageTotal,index}`（断言 index=(page-1)\*pageSize+1、pageTotal=ceil、空库 {0,[],1,0,1}）；改 `user-query.dto` 相关单测（`page/pageSize` 缺省/封顶/非正整数拒绝）。先运行确认失败。
- [x] ✅ T031-2 GREEN 分页实现（✅ 已落，全量门禁 T031-10 验证）：`UserQueryDto` 改 `page`（@IsInt @Min(1) 缺省 1）+`pageSize`（缺省 20、@Max(50) 截断/拒绝按现状风格）；`UserService.list` 改 `countDocuments({deletedAt:null})` + `skip((page-1)*pageSize).limit(pageSize).sort({_id:-1})`，返回 `PageResult`（`index=(page-1)*pageSize+1`、`pageTotal=total===0?0:ceil(total/pageSize)`）；`user-list-page.dto.ts` 改为 `PageResult<UserResponseDto>` class（`total/list/page/pageTotal/index` 五字段 @ApiProperty，类名按域命名如保留 `UserListPageResponse` 字段替换）；controller `@ApiQuery` 与 description 改 page/pageSize，删除 cursor。验收：T031-1 绿，无 `any`。
- [x] ✅ T031-3 RED 删除 null（✅ 已落）：改 `user.service.spec.ts` `softDelete` 断言返回 `null`（不再返回 `{id}`）；controller 返回类型改 `Promise<null>`；删除 `src/modules/user/dto/delete-result.dto.ts`（确认无其他引用，含 Swagger wrap）。先红。
- [x] ✅ T031-4 GREEN 删除 null（✅ 已落，delete-result.dto.ts 已删、无引用）：`softDelete` 成功返回 `null`（末管理员/不存在/非法 id 异常分支不变）；`user.controller.ts remove` 返回 `Promise<null>`，删 import。验收：单测绿、`pnpm build:local` 过、文档源无 DeleteResultResponse。
- [x] ✅ T031-5 RED 单查空结果（✅ 已落，取「只读方法 findByIdOrNull」方案）：改 `user.service.spec.ts`——只读路径 `findById`（或新增只读方法）对不存在/软删 id 返回 `null` 不抛；写操作 `setAdmin/softDelete` 目标不存在仍抛 USER_NOT_FOUND(404)。设计取舍（实现时二选一并在代码注释）：controller detail 调不抛错的只读方法（如 `findByIdOrNull`），写操作沿用抛错方法；或 `findById` 返回 null 由写操作调用方自行抛 404。先红。
- [x] ✅ T031-6 GREEN 单查空结果（✅ 已落）：按 T031-5 取舍实现；`GET /users/detail` controller 返回 `Promise<UserResponseDto | null>`（Swagger data nullable），非法 id 400 路径不变（CastError 归一仍在 filter）。验收：单测绿。
- [x] ✅ T031-7 E2E 迁移（✅ 2026-10-26 已落，T031-10 E2E 7 套件 50/50 绿）：`test/user-admin.e2e-spec.ts`——列表断言改 `data.total/list/page/pageTotal/index`（含第二页 index=pageSize+1、空结果页、越界页）；删除成功断言 `data===null`；detail 不存在/已软删断言 200 + `data:null`（原 404 用例改写），非法 id 仍 400；admin/delete 目标不存在仍 404。`test/swagger-docs.e2e-spec.ts` 文档源哨兵：列表 data schema 五字段、无 items/nextCursor；删除/单查 data nullable；无 DeleteResultResponse 模型。验收：该套件全绿。
- [x] ✅ T031-8 残留清理 grep 证据（✅ 2026-10-26：src/ test/ 仅剩负断言 `not.toHaveProperty('items'/'nextCursor')`、文档源哨兵 `not.toHaveProperty('DeleteResultResponse')` 与说明注释；业务代码/DTO 无 cursor/limit/items/nextCursor/DeleteResultResponse，004 契约头部已加 T031 声明、§3 删除行待历史保留）：`grep -rn "nextCursor\|\.cursor\b\|items\b\|DeleteResultResponse" src/ test/ specs/ docs/` 业务代码/测试 0 命中（历史 spec 修订记录中的文字保留，属历史事实不改写）；分页参数文档无 cursor/limit。
- [x] ✅ T031-9 文档同步 `[no-test]`（✅ 规划修订期已同步：005 spec/contract/data-model/quickstart、ADR-006 决策 16、001 user-api §4/§5/§7、001 design §5/§7、coding-style §1.4；004 契约头部 T031 声明本次补）：005 spec/contract/data-model/quickstart（本 Phase 已改 spec/contract/data-model；quickstart 补五形态示例与分页手测步骤）、ADR-006 决策 16、001 user-api §4（page/pageSize + 五字段）/§5（200 null）/§7（data:null）、001 design 若列分页方式则同步、`docs/architecture/data-flows.md` 响应示例、`docs/development/coding-style.md` §1.4 加「CRUD data 五形态」硬约束、context.md 会话记录。
- [x] ✅ T031-10 全量门禁（✅ 2026-10-26：lint 0 退出；单测 27 套件 231；E2E 7 套件 50（真实 mongod+redis，ai_blog_test）；build:local 0）：`pnpm lint`、`pnpm test`、`pnpm test:e2e`（真实 mongod+redis，库 ai_blog_test）、`pnpm build:local` 均退出 0；记录套件/用例数。随后 `/evolve` 复盘（EVO-20261026003，见下）。

---

## 依赖顺序（T027）

T027-a（外壳字段：constants 类型 + interceptor + filter 单测 RED→GREEN）
→ T027-b（错误码注册表：filter 改用集中配置，错误码值不变）
→ T027-c（Swagger：wrapSuccessEnvelope 纯函数单测 RED→GREEN → 插件启用 → setupSwagger 调用 → 删 Envelope 子类/成功注解 → E2E 哨兵迁移）
→ T027-d（4 业务 E2E 套件断言迁 4 字段）→ 全量门禁 → ADR-006 决策 10 + coding-style/context 同步

---

## 依赖顺序

```text
T001 → T002 → T003
T003 → T004 → T005（错误侧）
T003 → T006 → T007 → T008/T009（成功侧；T009 后 E2E 预期暂红）
T010 → T011 → T012（Swagger，可与 Phase 2/3 并行但文档源断言需 T011 模型）
T005 + T009 + T012 → T013..T018（E2E 迁移）→ T019
T019 → T020..T024
```

## 非目标（YAGNI，research R6/R8/R10）

- 不抽错误码常量对象（值不变重命名，独立重构处理）。
- 不改 Controller/Service/`toUserResponse`，不删冗余 `@HttpCode(201)`。
- 不做 API 版本双写、不引入 `APP_INTERCEPTOR/APP_FILTER` DI 改造、不支持流/文件下载封装。
