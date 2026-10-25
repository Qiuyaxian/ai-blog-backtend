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
- [ ] ⬜ T002 RED：新建 `src/common/response/response.constants.spec.ts`，为 `isEnvelopeExcludedPath(path)` 写用例：`'/'`→true、`'/health'`→true、`'/health/live'`→true、`'/health/ready'`→true、`''`→false、`'/users'`→false、`'/healthx'`→false、`'/health-2'`→false、`'/health/live?x=1'`（带 query 不应出现在 req.path，单测仅锁纯函数前缀边界）；并断言导出 `SUCCESS_CODE==='SUCCESS'`、`SUCCESS_MESSAGE==='ok'`。先运行确认因模块缺失失败（TS2307）。
- [ ] ⬜ T003 GREEN→REFACTOR：新建 `src/common/response/response.constants.ts`：导出 `SUCCESS_CODE`、`SUCCESS_MESSAGE`、`interface ApiResponse<T> { code:string; data:T|null; message:string|string[]; path:string; time:string }`、纯函数 `isEnvelopeExcludedPath`（research R3：`path==='/'||path==='/health'||path.startsWith('/health/')`），加 JSDoc。无 `any`。验收：T002 全绿。

**Checkpoint**: 豁免规则可单测锁定，filter/interceptor 共用。

---

## Phase 2: 错误响应外壳（US2，先做错误侧）

**Purpose**: filter 错误体从 `{code,message,statusCode}` 改为 `{code,data:null,message,path,time}`，并对豁免路径透传。

**⚠️ CRITICAL**: 只改 filter 产出形状与测试，不改 `normalize` 的 status/code/message 判定逻辑（FR-006 错误码值不变）。

- [ ] ⬜ T004 RED：改写 `src/common/filters/http-exception.filter.spec.ts`：
  - `mockHost` 的 request 桩增加 `path`（如 `/users`）。
  - 现有 4 用例断言改为新外壳：`payload` `toMatchObject({ code, data:null, message, path:'/users', time:<expect.any(String)> })`，并断言 `time` 可被 `new Date(time)` 解析、`payload` 无 `statusCode` 键；HTTP status 仍分别为 409/400/400/500。
  - 新增用例：`path='/health/ready'` + `new ServiceUnavailableException(terminusResult)` → `res.statusCode===503` 且 `res.payload===terminusResult`（透传，无 code/data/time，research R4）。
  - 新增用例：`path='/'` 的任意 HttpException 透传原始 `getResponse()`。
    先运行确认失败（当前仍输出 statusCode、未透传）。
- [ ] ⬜ T005 GREEN→REFACTOR：改 `src/common/filters/http-exception.filter.ts`：
  - `catch` 中先取 `req.path`；`isEnvelopeExcludedPath(path)` 为真时：HttpException 用 `getStatus()` + `getResponse()` 原样 `json()`（Terminus 503 透传），非 HttpException 透传 Nest 默认 `{message,statusCode}` 形态且 status 500（不套外壳）。
  - 非豁免路径：`normalize` 逻辑不动，body 改为 `{ code, data:null, message, path, time:new Date().toISOString() }`；删除 `ErrorBody.statusCode`。
  - 500 仍只入日志不外泄。验收：T004 全绿；`tsc` 无错。

**Checkpoint**: 错误外壳统一且探针失败体不被污染；业务 success 路径此时仍裸返回（预期，Phase 3 补）。

---

## Phase 3: 成功响应外壳（US1）

**Purpose**: 全局拦截器包裹 9 个业务接口成功返回；两装配点注册。

- [ ] ⬜ T006 RED：新建 `src/common/response/transform-response.interceptor.spec.ts`，mock `ExecutionContext`（提供 `switchToHttp().getRequest().path`）与 `CallHandler`（`handle()` 返回 `of(payload)`）：
  - 业务路径 `/users`：返回体 `toEqual({ code:SUCCESS_CODE, data:payload, message:SUCCESS_MESSAGE, path:'/users', time:expect.any(String) })`，且原 payload 引用保留在 data；time 合法 ISO。
  - 豁免路径 `/health/live` 与 `'/'`：`tap/map` 结果 `toBe(payload)`（原样透传，不包外壳）。
  - 异常透传：`handle()` 返回 `throwError`，拦截器不吞错（error 传到下游）。
    先确认模块缺失失败。
- [ ] ⬜ T007 GREEN→REFACTOR：新建 `src/common/response/transform-response.interceptor.ts`（`@Injectable()`，`map` 实现，规则见 research R1/R2/R6）；豁免 `return next.handle()`；不 catch 错误、不打日志、不读 query。加 JSDoc 与 ponytail 注释（天花板=仅 JSON body 封装，不支持流/文件下载，升级路径=按 content-type/metadata 细化）。验收：T006 全绿。
- [ ] ⬜ T008 在 `src/main.ts` 注册：`app.useGlobalInterceptors(new TransformResponseInterceptor(), new AccessLogInterceptor())`（顺序 R1），更新文件注释。验收：`pnpm build:local` 通过；本地启动 `POST /auth/login` 肉眼确认五字段（快速 sanity，正式断言在 Phase 5）。
- [ ] ⬜ T009 在 `test/helpers/e2e-app.ts` 同序注册同一拦截器；`loginHelper` 改为 `return res.body.data.token as string`。更新该文件 ponytail 双装配点注释（filter/interceptor/pipe/swagger 四处需同步）。验收：编译通过；此时既有 E2E 预期大面积红灯（契约已变），红灯在 Phase 5 修复，不作为本任务完成阻塞的反例——但单测须全绿：`pnpm test` 退出 0。

**Checkpoint**: 运行时成功/错误外壳齐备；E2E 待迁移。

---

## Phase 4: Swagger 外壳模型（US3 文档部分）

**Purpose**: 文档成功/错误模型呈现新外壳，旧 statusCode 模型移除。

- [ ] ⬜ T010 [P] RED：在 `test/swagger-docs.e2e-spec.ts` 文档源哨兵用例中改/加断言：① 改写现有「ErrorResponse 含 code/message/statusCode」用例（该文件约 L100）：模型名改为 `ErrorEnvelope`，断言含 `code/data/message/path/time`、`data` nullable、**不含** `statusCode`；② 登录 200 响应 schema 为五字段外壳（`properties` 含 `code/data/message/path/time`，`data.$ref` 指向登录结果模型）；③`components.schemas` 不存在名为 `ErrorResponse` 的旧模型。先确认失败（注解尚未改、旧模型仍在）。
- [ ] ⬜ T011 GREEN→REFACTOR：新建 `src/common/response/response-schemas.ts`：
  - 定义 `EnvelopeBase`（`@ApiProperty` 的 code/message/path/time，含示例）；
  - 5 个成功外壳 `LoginEnvelope/UserEnvelope/UserListPageEnvelope/LogoutEnvelope/DeleteEnvelope extends EnvelopeBase`，各自 `data` 用 `@ApiProperty({type:X})` 标注；
  - `ErrorEnvelope`：`data` `@ApiProperty({nullable:true, example:null, ...})`、`message` oneOf string/array、无 statusCode（research R5，以实际文档源渲染微调 type）；
  - 把 `LoginResultResponse/LogoutResultResponse/UserListPageResponse/DeleteResultResponse` 等 data 模型类从 `src/common/swagger/response-schemas.ts` 迁入（`UserResponseDto` 仍从 user 模块 import，不移动域 DTO）。
    验收：T010 文档源断言通过。
- [ ] ⬜ T012 删除 `src/common/swagger/response-schemas.ts`，更新 `src/modules/auth/auth.controller.ts` 与 `src/modules/user/user.controller.ts` 的 import 与成功 `@ApiResponse({type})`（换 5 个 Envelope 类），错误 `@ApiResponse({type:ErrorEnvelope})`；description 文案中「统一错误体 code/message/statusCode」改为五字段表述。不改任何运行时代码/守卫/HttpCode。验收：`pnpm build:local` + `pnpm lint` 通过；T010 绿。`[no-test]`（注解行为由 T010 E2E 覆盖，本任务为声明式迁移）

**Checkpoint**: 文档与真实契约一致。

---

## Phase 5: E2E 契约迁移（US1/US2/US3 端到端）

**Purpose**: 6 个业务 E2E 套件断言迁到新外壳；豁免路径套件保持不变并补探针不回归断言。逐套件改、逐套件绿（`pnpm test:e2e -- <file>` 或全量）。

- [ ] ⬜ T013 [P] `test/user-register.e2e-spec.ts`：成功 `body.id/...`→`body.data.id` 等；注册脱敏断言针对 `data`；注册后登录取 `data.token/data.user`；新增一个顶层键集合断言（五字段且无多余键）；错误用例补 `data===null` 且无 `statusCode`。验收：该套件全绿。
- [ ] ⬜ T014 [P] `test/user-profile.e2e-spec.ts`：成功读 `data.id/data.email/data.isAdmin`；错误 `code` 路径不变并补 `data:null`/无 `statusCode`；401 未登录用例不变（HTTP 状态不变）。验收：全绿。
- [ ] ⬜ T015 [P] `test/user-admin.e2e-spec.ts`：列表 `data.items/data.nextCursor`、详情/提权/删除读 `data.*`；删除结果 `toEqual({id})` 改为针对 `data`；错误用例补外壳断言。验收：全绿。
- [ ] ⬜ T016 `test/auth-login.e2e-spec.ts`：所有 `rememberSessionKey(res.body.token)`→`data.token`（经 helper 的登录已自动迁移，本文件内直接取 token 处逐一改）；`data.expiresAt/data.user`；logout 成功断言针对 `data`；**全等体**用例（未知账号 ≡ 错误密码、锁定第六次 ≡ 第一次）改为 `toMatchObject({code:'INVALID_CREDENTIALS',data:null,path:'/auth/login'})` + `expect(typeof body.time).toBe('string')`（research R7，禁止整体 toEqual）。验收：全绿。
- [ ] ⬜ T017 `test/swagger-docs.e2e-spec.ts`：Bearer 调试段业务断言（`res.body.username` 等）迁到 `data`；production 401 `code` 断言不变；与 T010/T012 的文档源断言合并无冲突。验收：全绿。
- [ ] ⬜ T018 豁免回归：`test/app.e2e-spec.ts`（`GET /` 仍 `Hello World!`）、`test/redis-health.e2e-spec.ts`（live/ready 200 原生 Terminus 体）保持断言不变并确认通过；在 redis-health 或新用例中补一条 ready 响应**不含** `code/data/message` 外壳键的断言。验收：两套件绿。
- [ ] ⬜ T019 残留清理 grep 证据（写入 PR 描述）：`grep -rn "res.body.statusCode\|body.token\|body.user\b" test/` 业务断言 0 命中（文档源/helper 除外）；`grep -rn "statusCode" src/common/filters/http-exception.filter.ts` 仅剩 HTTP status 变量；E2E 全量 `pnpm test:e2e` 退出 0（真实 mongod+redis，7 套件）。

**Checkpoint**: 端到端契约全绿；探针零回归。

---

## Phase 6: Polish（文档、门禁、复盘）

- [ ] ⬜ T020 `[no-test]` 新建 ADR-006（`docs/architecture/adr/ADR-006-unified-response-envelope.md`）：统一外壳字段、错误体扁平化、豁免路径、HTTP 语义状态码保留、一次性破坏性切换（无外部消费方）与回滚；登记到架构 ADR 索引；初版状态 Pending。
- [ ] ⬜ T021 `[no-test]` 文档同步：更新 001/003/004 的 contracts 中响应示例或加指针指向本功能 `contracts/api-contract.md`（不逐条重写历史，加「响应外壳见 005」声明即可，避免大 diff）；`docs/architecture/data-flows.md` 若有响应体示例则同步；`docs/development/coding-style.md` 新增「接口响应统一外壳、业务代码不手工构造、新接口自动获得外壳、错误码抛字符串」一条。
- [ ] ⬜ T022 全量门禁（证据驱动）：`pnpm lint`、`pnpm test`（单测）、`pnpm test:e2e`（真实依赖）、`pnpm build:local` 均退出 0；记录套件/用例数与输出。
- [ ] ⬜ T023 手工冒烟（quickstart §2 全 8 步，含 400/401/403/404/409、health/root 豁免、Swagger 文档外观），记录结果；更新 `docs/context.md`（进行中工作/会话记录/决策草稿指向 ADR-006）。`[no-test]`
- [ ] ⬜ T024 执行 `/evolve` 复盘（破坏性契约变更的评审/测试迁移教训），产出 EVO 记录并按机制归并；通过 verification-before-completion 后由编排方将 handoff 置 `complete`（执行方不自行置位）。

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
