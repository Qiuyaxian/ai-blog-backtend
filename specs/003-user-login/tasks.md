---
description: 'Task list for 003-user-login'
---

# Tasks: 用户登录鉴权（User Login & Authentication）

**Input**: `specs/003-user-login/` 下 spec.md / plan.md / research.md / data-model.md / contracts/auth-api.md / quickstart.md

**Prerequisites**: plan.md、spec.md（必需）；research.md、data-model.md、contracts/、quickstart.md（已具备）

**Tests**: 宪法原则 III（Test-First）不可协商：除标注 `[no-test]` 的任务外，每个生产逻辑任务必须先写失败测试（RED）→ 最小实现（GREEN）→ 重构（REFACTOR）。单测 Mock Mongoose Model / CacheService / UserService，不连真实 Mongo/Redis；E2E 经 `test/helpers/e2e-app.ts` 自举，真实 mongod（库 `ai_blog_test`）+ redis，固定 `--runInBand`。

**Organization**: 按用户故事分组、按 spec 优先级排序。注意交付顺序为 **US1（登录 P1）→ US5（公开注册 P1）→ US2（鉴权 P2）→ US3（登出 P3）→ US4（防爆破 P3）**：US5 必须先于 US2 的全局 Guard 注册（否则默认拒绝会挡住注册）；US3/US4 是 AuthService/Controller 的纯增量，列后。

## 格式：`[ID] [P?] [Story?] 描述（含路径）`

- **[P]**：可并行（不同文件、不依赖未完成任务）
- **[Story]**：所属用户故事（US1–US5）；Setup/Foundational/Polish 不带 Story 标签
- `[no-test]`：纯配置/文档/IoC 装配任务，豁免 TDD（须在任务内说明可测行为由谁覆盖）
- 状态图标紧随 checkbox：⬜ 未开始 / ✅ 完成 / ❌ 失败 / 🚫 阻塞 / ⚠️ 遗留

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 环境配置项与 auth 模块安全常量。

> **执行前置（认领时完成，不编号、不占 TDD 任务）**：确认在 `develop` 最新基线上切出 `feature/003-user-login` 分支（dev-agent 规则：禁止直接改 main/develop）；handoff 已写 `claimed_by/claimed_at` 转 `executing` 后才动代码。

- [x] ✅ T001 [no-test] 在三套 env 同步新增认证配置项：`.env.local` 增 `AUTH_TOKEN_TTL_SECONDS=604800`；`.env.uat`、`.env.production` 同步键名（值由运维按环境定，缺省 604800；只放占位/非密钥值）；在 `docs/development/development.md` 环境变量说明处登记键名、默认值、含义（正整数秒）。纯配置，校验行为由 T006 单测覆盖。
- [x] ✅ T002 [P] [no-test] 新建 `src/modules/auth/auth.constants.ts`：逻辑键前缀 `AUTH_SESSION_PREFIX='auth:sess:'`、`AUTH_FAIL_PREFIX='auth:fail:'`、`AUTH_LOCK_PREFIX='auth:lock:'`；安全常量 `FAIL_THRESHOLD=5`、`LOCK_TTL_SECONDS=900`、`SESSION_TTL_DEFAULT=604800`（research R7：阈值走代码不 env 化）；常量文件无逻辑无需单测。

---

## Phase 2: Foundational（阻塞性前置）

**Purpose**: 计数原子能力、配置工厂、用户域只读协作口、会话类型与公开装饰器；所有 US 阶段的共用底座。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何 US 阶段。

- [x] ✅ T003 [P] RED：在 `src/common/cache/cache.service.spec.ts` 新增 `incrWithTtl` 用例——调用经一次 `multi()` 链 `incr(key)` + `expire(key, ttl)` + `exec()` 原子提交；返回自增后整数；空键抛 `TypeError`；`ttlSeconds` 非正整数抛 `RangeError`（与 `set` 同口径）；Mock multi/exec，不连真实 Redis。
- [x] ✅ T004 GREEN：`src/common/cache/cache.service.ts` 注入类型由 `Pick<Redis,'set'|'get'|'del'>` 扩展加 `'multi'`；新增 `incrWithTtl(key: string, ttlSeconds: number): Promise<number>`（复用 `requireKey` 与 TTL 校验），`multi().incr(key).expire(key,ttl).exec()`，返回结果中的计数；既有 set/get/del 与调用方零改动（plan 跨模块触碰 3）。
- [x] ✅ T005 [P] RED：新建 `src/modules/auth/auth.config.spec.ts`——给定 ConfigService 返回值时 `AUTH_TOKEN_TTL_SECONDS` 缺省回退 604800；正整数字符串正常解析；`0/负数/小数/非数字` 抛带键名的错误（fail-fast，research R7）。
- [x] ✅ T006 GREEN：新建 `src/modules/auth/auth.config.ts`：导出认证配置键名常量与读取函数/工厂（对齐 `src/common/cache/redis.config.ts` 风格，经 `ConfigService`，不直接读 `process.env`），TTL 正整数校验失败 fail-fast。
- [x] ✅ T007 [P] RED：在 `src/modules/user/user.service.spec.ts` 新增 `getAuthPrincipal` 用例——返回 `{ id, isAdmin }`；`deletedAt` 非空（软删）返回 null；`_id` 不存在返回 null；投影不含 password/usernameLower/deletedAt（断言查询选项含 `deletedAt:null` 与显式投影）；Model 查询 reject 时上抛（Guard 侧 fail-closed 依赖抛错而非吞错）。
- [x] ✅ T008 GREEN：`src/modules/user/user.service.ts` 新增只读方法 `getAuthPrincipal(id: string): Promise<{ id: string; isAdmin: boolean } | null>`（`findOne({_id:id, deletedAt:null})` + 显式投影 `_id isAdmin`，data-model §1）；`src/modules/user/user.module.ts` 增 `exports: [UserService]`（plan 跨模块触碰 1）；不改任何既有方法签名。
- [x] ✅ T009 [P] [no-test] 新建 `src/modules/auth/session.interface.ts`：`SessionPayload { sub: string }`（刻意不含角色，data-model §2.1）与 `AuthenticatedRequest`（沿用 001 `CurrentUser` 形状 `user?: { id: string; isAdmin: boolean }`）；新建 `src/modules/auth/decorators/public.decorator.ts`：`IS_PUBLIC_KEY` + `@Public()`（SetMetadata）。纯类型/装饰器声明无分支逻辑，无需单测。

**Checkpoint**: 计数原语、配置、用户协作口、会话类型齐备且各自单测全绿，US 可开始。

---

## Phase 3: User Story 1 - 用户登录并获得访问令牌（P1，MVP）🎯

**Goal**: 用户名或邮箱 + 密码登录成功签发不透明令牌（会话写 Redis，固定 7 天 TTL）；凭据错误/不存在/软删统一 401。

**Independent test**: 已注册普通用户分别以用户名、邮箱（含大小写/首尾空格差异）登录拿到 `token/expiresAt/user`（无 password）；错误密码、不存在标识、软删账号统一 401 `INVALID_CREDENTIALS`，不签发任何键。

- [x] ✅ T010 [P] [US1] RED：新建 `src/modules/auth/dto/login.dto.spec.ts`——`identifier` 缺失/trim 后空/短于 2/长于 254、`password` 缺失/短于 8/长于 64 均校验失败；合法边界值通过（whitelist + forbidNonWhitelisted 下多余字段被拒）。
- [x] ✅ T011 [US1] GREEN：新建 `src/modules/auth/dto/login.dto.ts`：`identifier: string`（`@Transform` trim、`@IsNotEmpty`、`@Length(2,254)`）、`password: string`（`@IsNotEmpty`、`@Length(8,64)`，登录路径不强制字符组合，契约 §1）。
- [x] ✅ T012 [P] [US1] RED：新建 `src/modules/auth/auth.service.spec.ts` 登录成功路径——用户名登录、邮箱登录（归一化 trim+lowercase，research R3 `$or: [{usernameLower},{email}]` + `deletedAt:null`，`.select('+password')`）成功：返回 64 字符 hex token、`expiresAt=now+TTL`（ISO）、user 复用 `toUserResponse`（无 password）；以 sha256(token) 为键 `cache.set` 写 `SessionPayload{sub}` TTL=配置值；成功时 `cache.del` 失败计数键（FR-013 清零，先写调用断言，US4 实现计数后仍成立）。
- [x] ✅ T013 [P] [US1] RED（同文件续用例）：错误密码、标识不存在、软删账号均抛 `UnauthorizedException('INVALID_CREDENTIALS')` 且不调用 `cache.set`；标识不存在分支对固定 dummy hash 执行一次 `bcrypt.compare`（断言 compare 被调用以均化时序，research R5），且不读写任何 fail/lock 键（FR-013 澄清）；Mock `cache.set` reject 时登录上抛 500 路径异常且不返回令牌（FR-015 签发侧 fail-closed，research R8）；bcrypt/Mongo 异常同样上抛不吞错；日志不含密码（断言 logger 参数）。
- [x] ✅ T014 [US1] GREEN：新建 `src/modules/auth/auth.service.ts`：`login(dto)`——归一化 → $or 定位（含 `+password`）→ 不存在走 dummy bcrypt → `bcrypt.compare` → 失败统一 401（**失败计数与锁定判定本阶段一律不实现**，以 `// TODO(US4/T032): 失败计数 incrWithTtl + lock 键判定` 标位，避免实现先于其 RED 用例 T031）→ 成功 DEL 计数键（键不存在时 del 幂等，行为已由 T012 断言）+ `randomBytes(32).toString('hex')` 生成令牌 + sha256 入键 + `cache.set`（失败自然上抛，由 T013 的 500 用例覆盖）+ 返回 `{ token, expiresAt, user: toUserResponse(doc) }`；构造注入 UserService 之外只注入 CacheService/ConfigService；新建 `src/modules/auth/auth.module.ts`（`imports: [UserModule]`，providers/exports AuthService；**本阶段不注册 APP_GUARD**，归 T022）。
- [x] ✅ T015 [P] [US1] RED：新建 `test/auth-login.e2e-spec.ts`（经 `createTestApp`）——注册普通用户后：用户名登录 200 且体含 `token`（64 hex）/`expiresAt`（= 当前时刻 +7 天，容差断言）/`user`（含 username/email/isAdmin/createdAt，无 password/deletedAt/usernameLower）；`' ALICE@EXAMPLE.COM '` 邮箱登录 200；错误密码、不存在标识 401 且 body `code=INVALID_CREDENTIALS`，与错误密码响应体形状一致（FR-001/002/005/006）。
- [x] ✅ T016 [US1] GREEN：新建 `src/modules/auth/auth.controller.ts`：`@Controller('auth')` + `@Public() @Post('login') @HttpCode(200)` 接收 `LoginDto`、调 `authService.login`、直接返回结果（Controller 无业务逻辑、不碰 @Req/@Res）；在 `auth.module.ts` 注册 controller；在 `src/app.module.ts` imports 注册 AuthModule。

**Checkpoint**: US1 独立可用——`POST /auth/login` 真实链路 200/401 行为符合契约；模块尚未挂全局 Guard，其余接口行为不变。

---

## Phase 4: User Story 5 - 访客注册公开入口（P1）

**Goal**: 默认拒绝鉴权上线后，`POST /users` 仍对未登录访客公开可用，行为与 001 完全一致；注册后可立即登录。

**Independent test**: 无任何令牌 `POST /users` 注册成功（201，响应与 001 一致），随后用新凭据登录 200；重复用户名/邮箱仍按 001 规则 409。本阶段先打 `@Public()`（此时全局 Guard 尚未注册，装饰器无副作用），为 T022 全局默认拒绝排雷（plan 风险 R1）。

- [x] ✅ T017 [P] [US5] RED：在既有 `test/user-register.e2e-spec.ts` 增补用例——不带任何令牌注册合法用户 201 后，随即 `POST /auth/login` 用新账号登录返回 200 与 token（US5 场景 3）；重复用户名/邮箱的拒绝行为维持原断言不变（FR-020）。
- [x] ✅ T018 [US5] GREEN：`src/modules/user/user.controller.ts` 的 `@Post()` 注册方法加 `@Public()`（import 自 auth 模块装饰器；仅加 1 个装饰器，不改注册逻辑/DTO/响应）。

**Checkpoint**: 注册链路在"即将默认拒绝"的代码形态下仍全绿，US2 可安全注册全局 Guard。

---

## Phase 5: User Story 2 - 持令牌访问受保护接口（P2）

**Goal**: 全局 `AuthGuard` 默认拒绝，Bearer 令牌 → Redis 会话 → Mongo 回查当前账号状态 → 注入 `{id,isAdmin}`；软删/降权即时生效；Redis/Mongo 不可核验时 fail-closed；删除 `x-test-user` 桩，全部 E2E 走真实登录。

**Independent test**: 有效令牌访问 `/users/me` 成功且身份正确；无头/坏 scheme/空 token/伪造/过期/已登出（登出在 US3 实现后补）→ 401；普通用户访问 admin 接口 403；登录后被软删 →401、被降权 →403；Mock Redis/Mongo 抛错 →401 不放行。

- [x] ✅ T019 [P] [US2] RED：新建 `src/modules/auth/auth.guard.spec.ts`——`@Public()` 路由直接放行（不触 CacheService）；无 Authorization 头/scheme 非 Bearer（大小写变体）/令牌段空 → 401 `UNAUTHENTICATED`；会话未命中（null，含过期/伪造）→ 401；CacheService 抛错 → 401（FR-015 fail-closed）；`getAuthPrincipal` 返回 null（软删/不存在）→ 401；`getAuthPrincipal` reject（Mongo 不可用）→ 401（FR-015 安全评审补充）；正常时注入 `request.user={id:sub,isAdmin:库中当前值}` 并返回 true（构造 mock ExecutionContext/Reflector）。
- [x] ✅ T020 [P] [US2] RED：在 `src/modules/auth/auth.service.spec.ts` 增补 `resolveSession(rawToken)` 用例——对入参做 sha256 后查 `auth:sess:<hash>`；未命中返回 null；命中返回 `SessionPayload`；CacheService 抛错原样上抛（交给 Guard fail-closed）。
- [x] ✅ T021 [US2] GREEN：`src/modules/auth/auth.service.ts` 增 `resolveSession(rawToken)`；新建 `src/modules/auth/auth.guard.ts`：Reflector 读 IS_PUBLIC → 提取 Bearer（scheme 大小写不敏感）→ `resolveSession`（异常/ null 均 401）→ `userService.getAuthPrincipal(sub)`（null/异常均 401，统一 `UNAUTHENTICATED`，错误不暴露内部细节）→ 注入 `request.user`；Guard 不记完整令牌（日志只记 requestId/原因）。
- [x] ✅ T022 [US2] GREEN（IoC 装配，[no-test]）：`src/modules/auth/auth.module.ts` 以 `{ provide: APP_GUARD, useClass: AuthGuard }` 全局注册；给 `POST /auth/login` 之外的公开点打标：`src/health/health.controller.ts` 的 `@Get('live')`、`@Get('ready')` 加 `@Public()`，`src/app.controller.ts` 的 `@Get()` 加 `@Public()`（注册路由已在 T018 打标）。装配正确性由 T024–T027 E2E 全量回归证明，故不单独单测。
- [x] ✅ T023 [US2] 改造 `test/helpers/e2e-app.ts`：**删除 `TestUserGuard` 类与其 `app.useGlobalGuards(...)` 调用**（FR-017；全局 AuthGuard 经 APP_GUARD 自动生效）；导出 `loginHelper(app, {identifier,password})`（POST /auth/login 返回 `{token,...}`）与 `authHeader(token)`（返回 `{ Authorization: 'Bearer '+token }`）；造数仍走公开 `POST /users`，管理员置位仍直连测试库。
- [x] ✅ T024 [P] [US2] 改写 `test/user-profile.e2e-spec.ts`：删除全部 `x-test-user` 头，改"注册 → 真实登录 →Bearer 令牌"访问 `/users/me`；原 5 处断言（含 401/403 语义）逐条保留，401 场景改用无头/坏令牌构造。
- [x] ✅ T025 [P] [US2] 改写 `test/user-admin.e2e-spec.ts`：`adminHeader/userHeader` 改为分别登录管理员/普通用户取真实令牌（管理员先注册再直连测试库置 isAdmin，沿用现有造数）；list/detail/admin/delete 全部断言不变。
- [x] ✅ T026 [P] [US2] 在 `test/auth-login.e2e-spec.ts` 增补鉴权场景：有效令牌 GET `/users/me` 200 且身份为本人；无头/坏令牌 401；普通令牌访问 `GET /users`（admin）403；登录后直连测试库软删目标用户 → 旧令牌 401；另一管理员登录后被直连库降权 → 旧令牌访问 admin 接口 403（FR-008/009/011；会话/锁定键只在 Redis，套件 afterEach 经注入的 `CacheService` 删除该用例生成的 `auth:sess:*` 逻辑键，配合清 users 集合；禁止 flushdb）。
- [x] ✅ T027 [P] [US2] 回归确认（不改代码，失败则回报缺陷）：`test/app.e2e-spec.ts` 的 `GET /` 仍 200、`test/redis-health.e2e-spec.ts` 的 `/health/live`、`/health/ready` 无令牌仍 200；`grep -rn "x-test-user\|TestUserGuard" test/ src/` 零命中（FR-017）。

**Checkpoint**: 全仓库无鉴权旁路；默认拒绝 + 白名单 + 真实登录 E2E 全绿；US1/US5 不回归。

---

## Phase 6: User Story 3 - 主动登出（P3）

**Goal**: 持令牌登出立即删除当前会话键，同令牌即刻 401；登出幂等、只影响当前会话。

**Independent test**: 登录 → 登出 200→ 同令牌访问 401；无令牌登出 401；已失效令牌再登出按 401 处理不 500；同账号两次登录的两个令牌互不影响。

- [ ] ⬜ T028 [P] [US3] RED：在 `src/modules/auth/auth.service.spec.ts` 增补 `logout(rawToken)`——以 sha256 查键 DEL（幂等，键不存在不抛）；断言只删当前令牌键，不调用其他键的 del；新建 `src/modules/auth/decorators/current-token.decorator.spec.ts` 或在 guard/控制器测试中断言装饰器从 Authorization 头取原始令牌（纯 param decorator，可用 mock ExecutionContext 验证）。
- [ ] ⬜ T029 [US3] GREEN：新建 `src/modules/auth/decorators/current-token.decorator.ts`（`@CurrentToken()` 自定义参数装饰器，从请求头取 Bearer 原始令牌——Controller 不直接依赖 @Req，分层规则）；`auth.service.ts` 增 `logout(rawToken)`（sha256→`cache.del`）；`auth.controller.ts` 增 `@Post('logout') @HttpCode(200)`（**不打 @Public**，经全局 AuthGuard 已认证），返回 `{ success: true }`，仅注入 `@CurrentToken() token`。
- [ ] ⬜ T030 [P] [US3] 在 `test/auth-login.e2e-spec.ts` 增补：登出 200 后同令牌 GET `/users/me` 401；无头登出 401；同账号登录两次得 token A/B，登出 A 后 B 仍 200、A 401（FR-012/018，US3 场景 1/3）。

**Checkpoint**: 即时吊销闭环成立，多会话独立。

---

## Phase 7: User Story 4 - 登录失败防爆破（P3）

**Goal**: 同账号连续失败 5 次锁 15 分钟；锁定期任何尝试（含正确密码）统一 401、仅服务端日志记 ACCOUNT_LOCKED，不计次不延长；成功清零；期满自动解除；按账号隔离；不存在标识永不计数。

**Independent test**: 单测伪造计数到 4→ 第 5 次置 lock 键；锁定期正确密码也 401 且响应体与密码错误字节级同构、logger 记录锁定原因、不触碰 fail 键；成功登录 DEL fail 键；E2E 连错 5 次后第 6 次正确密码仍 401，`redis-cli`/CacheService 可见 lock 键，不存在标识刷失败不产生任何键。

- [ ] ⬜ T031 [P] [US4] RED：在 `src/modules/auth/auth.service.spec.ts` 增补锁定用例——前 4 次失败仅 `incrWithTtl('auth:fail:<id>',900)`；计数第 5 次（mock 返回 5）以 `cache.set('auth:lock:<id>',1,900)` 置锁；锁键命中时：即使 bcrypt 通过也抛 `INVALID_CREDENTIALS`、**不**调用 incrWithTtl/del（不延长不清零）、以结构化日志记录锁定命中（断言 logger 收到真实原因码，且不含密码/令牌）；成功登录调用 `cache.del` fail 键；不存在标识全程不触碰 fail/lock 键（与 T013 呼应）；锁定 TTL 用常量 900（data-model §2）。
- [ ] ⬜ T032 [US4] GREEN：补全 `auth.service.ts login` 失败计数与锁定路径（替换 T014 的 TODO；T031 为其 RED，先红后绿）——定位账号后先查 lock 键（命中记安全日志，**仍执行一次 bcrypt 比对均化时序**，research R5，然后统一 401）；密码错误走 `incrWithTtl` 滑动刷新，计数 4→5 时 `set` lock 键；成功 DEL fail 键；锁定期分支不调用任何计数/锁定写操作（plan 风险 R3）。
- [ ] ⬜ T033 [P] [US4] 在 `test/auth-login.e2e-spec.ts` 增补：同一真实账号连错 5 次均 401，第 6 次正确密码仍 401 且响应体与前 5 次同构（不出现 LOCKED/423/剩余时间字样）；经注入的 `CacheService.get('auth:lock:<userId>')` 断言锁定键存在（键在 Redis，不在 Mongo；userId 由造数响应获得）；不存在标识连打 6 次后真实账号仍可正常登录且无 `auth:fail:*` 残留键；账号 A 锁定不影响账号 B 登录（FR-013/006；用例尾部经 CacheService 删该用例的 `auth:fail:*`、`auth:lock:*` 逻辑键，禁止 flushdb）。锁定期满解除由 T031 单测以短 TTL/时钟覆盖，E2E 不等待 15 分钟。

**Checkpoint**: 防爆破全链路工作且对外零枚举差异；quickstart §3 锁定冒烟脚本可原样跑通。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 文档归位、全量门禁与真实冒烟、流程收尾。

- [ ] ⬜ T034 [no-test] 文档同步（同 PR）：ADR-004 状态 Draft → Pending 并核对正文与落地一致（令牌形态、每请求回查、锁定统一 401）；`docs/context.md` 更新"进行中工作/会话记录"（含 x-test-user 桩已删、新增 auth 模块与 CacheService.incrWithTtl）；`docs/architecture/data-flows.md` 补登录链路（如该文件登记关键数据流）；契约 `specs/003-user-login/contracts/auth-api.md` 与最终响应字段核对一遍。
- [ ] ⬜ T035 全量验证（证据驱动，留存真实输出）：`pnpm lint`、`pnpm test`、`pnpm build` 退出码 0；本地起 redis + mongod 后 `pnpm test:e2e -- --runInBand` 全绿；按 `specs/003-user-login/quickstart.md` §3 跑手工 curl 冒烟（注册/用户名+邮箱登录/受保护访问/401/登出/锁定统一 401 + `redis-cli KEYS 'local:auth:*'`）；确认响应与日志无密码、登录成功体外无令牌、日志无完整令牌（SC-006）。
- [ ] ⬜ T036 [no-test] 流程收尾：执行 `/evolve` 产出复盘记录并按机制归并；由编排方将 `.specify/superpowers-handoff.json` 置 `complete`（执行方不得自行置位）；按 §6.7 Conventional Commits 小步提交，发 PR 请 arch-agent 审查（OCR：`ocr review -B ./specs/003-user-login/checklists/requirements.md`）。

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup（T001–T002）→ Foundational（T003–T009）→ US 阶段 → Polish。
- US 内部严格 RED→GREEN；US 阶段间顺序：**US1 → US5 → US2 → US3 → US4**。
  - US5（T018）必须早于 US2 的 T022（APP_GUARD 注册）：默认拒绝一旦生效，唯一豁免手段就是 `@Public()`（风险 R1）。
  - US2 依赖 US1 的真实登录（测试 helper 靠它取令牌）；US3/US4 是同一 Service/Controller 的增量，依赖 US2 的 Guard 与 helper。
- Polish 依赖全部 US 完成。

### Task 级关键依赖

- T004 → T032（incrWithTtl，US1 阶段不调用）；T006 → T014（TTL 配置）；T008 → T014/T021（getAuthPrincipal）；T009 → T016/T021/T022。
- T022（APP_GUARD）必须在 T023–T027 执行前一刻完成；T018 必须先于 T022。
- T023（helper 删桩）→ T024/T025（两套件改写，并行）；T026 与 T024/T025 文件不冲突可并行。
- 同一文件 `auth.service.spec.ts` 的 T012/T013/T020/T028/T031 标注 [P] 仅表示设计可并行起草；**实际串行合并**，后做者在同一 describe 内续用例。

### Parallel Opportunities

- Foundational：T003/T005/T007/T009 互不共文件，可并行；T004/T006/T008 分别收口。
- US1：T010（DTO 测试）与 T012/T013（Service 测试）并行起草；T015（E2E）与单测并行。
- US2：T019、T020 两个 RED 并行；T024/T025/T026/T027 在 T023 完成后并行（四个不同文件/只读确认）。
- US3/US4：测试任务与同故事其他故事文件无冲突，但 service 同文件需串行合并。

---

## Parallel Example: User Story 2

```bash
# T022 完成、T023（e2e-app 删桩+loginHelper）落地后并行：
Task: "改写 test/user-profile.e2e-spec.ts 走真实登录（T024）"
Task: "改写 test/user-admin.e2e-spec.ts 走真实登录（T025）"
Task: "auth-login.e2e-spec.ts 增补软删/降权/401/403 场景（T026）"
Task: "确认 / 与 /health/* 无令牌 200、grep 桩零命中（T027）"
```

---

## Implementation Strategy

### MVP First（US1 + US5）

1. Phase 1/2 完成后，US1 交付可用登录端点（此时无全局 Guard，不影响存量接口）。
2. US5 先行打标，保证注册公开性。
3. **STOP**：独立验证登录/注册两条 P1 链路。

### Incremental Delivery

1. US2 一次性完成"默认拒绝 + 桩删除 + 全量 E2E 换真实令牌"（不可拆分上线，避免半成品锁死接口）。
2. US3 增量登出（Service/Controller 各加一方法，零回归面）。
3. US4 补全失败计数与锁定路径（T014 仅留 TODO，T031 RED → T032 GREEN 一次到位）。
4. T035 全量门禁 + 真实冒烟取证后转人工评审。

### Notes

- 每个任务完成即勾选 ⬜→✅ 并小步提交；失败置 ❌、阻塞置 🚫 并在 handoff 写 reason。
- 不新增依赖（令牌/哈希用 Node `crypto`，bcrypt 已在 001 落地）；不改 Mongo Schema；不导出裸 Redis client。
- 缓存只经 CacheService；配置只经 ConfigService；Controller 不碰 @Req/@Res、不写业务逻辑。
- 禁止为适配实现弱化断言；测试与实现行为冲突时先判谁错（test-agent 规则）。
