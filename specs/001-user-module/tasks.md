---
description: 'Task list for 001-user-module'
---

# Tasks: 用户模块（User Module）

**Input**: `specs/001-user-module/` 下 spec.md / plan.md / research.md / data-model.md / contracts/user-api.md / quickstart.md

**Prerequisites**: plan.md、spec.md（必需）；research.md、data-model.md、contracts/、quickstart.md（已具备）

**Tests**: 本项目宪法原则 III（Test-First）不可协商：除标注 `[no-test]` 的任务外，每个生产逻辑任务必须先写失败测试（RED）→ 最小实现（GREEN）→ 重构（REFACTOR）。

**Organization**: 按用户故事分组，US1 即可独立交付为 MVP。

## 格式：`[ID] [P?] [Story?] 描述（含路径）`

- **[P]**：可并行（不同文件、不依赖未完成任务）
- **[Story]**：所属用户故事（US1/US2/US3）；Setup/Foundational/Polish 不带 Story 标签
- `[no-test]`：纯配置/文档任务，豁免 TDD

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 依赖、模块骨架与全局校验管道。

- [x] ✅ T001 [no-test] 人工评审并安装依赖 `bcrypt`、`class-validator`、`class-transformer`（`pnpm add`，版本与 NestJS 9 基线兼容）；更新 `package.json` / `pnpm-lock.yaml`
- [x] ✅ T002 [no-test] 创建模块目录与空骨架文件：`src/modules/user/`（`user.module.ts`、`user.controller.ts`、`user.service.ts`、`dto/`、`schemas/`、`guards/`）
- [x] ✅ T003 [no-test] 在 `src/app.module.ts` 的 `imports` 注册 `UserModule`；确认 `src/main.ts` 存在全局 `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true })`，缺失则补上

---

## Phase 2: Foundational（阻塞性前置）

**Purpose**: 所有用户故事共用的 Schema、脱敏出参、角色/认证守卫、全局异常过滤器、访问日志拦截器与 E2E 测试桩。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何 US 阶段。

- [x] ✅ T004 [P] 先写失败测试：`src/modules/user/schemas/user.schema.spec.ts`——断言字段集、`usernameLower`/`email` 唯一索引、`isAdmin` 默认 false、`timestamps`；`password`/`usernameLower`/`deletedAt` 的 `select:false` 在 schema path 选项层断言（`schema.path('password').select === false`），不与 T006 的运行期脱敏测试重复
- [x] ✅ T005 [P] 实现 `src/modules/user/schemas/user.schema.ts`：`User` 类（username/usernameLower/email/password/isAdmin/deletedAt）、`UserDocument` 类型、`collection:'users'`、`timestamps:true`、两个唯一索引（GREEN）
- [x] ✅ T006 [P] 先写失败测试：`src/modules/user/dto/user-response.dto.spec.ts`——`toUserResponse` 只输出 `id,username,email,isAdmin,createdAt,updatedAt`，剔除 `password/usernameLower/deletedAt/__v`
- [x] ✅ T007 [P] 实现 `src/modules/user/dto/user-response.dto.ts`：`UserResponseDto` 与纯函数 `toUserResponse(doc)`（GREEN）
- [x] ✅ T008 [P] 先写失败测试：`src/modules/user/guards/roles.guard.spec.ts`——无 `request.user` → 401；有用户但 `isAdmin=false` 访问 `@Roles('admin')` → 403；管理员放行；路由无 `@Roles` 元数据（仅认证模式）时：无 user → 401、任意已登录用户（isAdmin true/false）放行
- [x] ✅ T009 [P] 实现 `src/modules/user/guards/current-user.interface.ts`（`CurrentUser { id:string; isAdmin:boolean }` 读取约定）与 `src/modules/user/guards/roles.guard.ts`（`RolesGuard` + `@Roles('admin')` 装饰器）（GREEN）；角色要求可选：reflector 取到空/undefined 元数据时只做"是否已登录"检查，同一 Guard 兼作 `/users/me` 的认证守卫，不另建 Guard 文件
- [x] ✅ T031 [P] 先写失败测试：`src/common/filters/http-exception.filter.spec.ts`——`ConflictException('USERNAME_EXISTS')` → 409 且 body 含 `code:'USERNAME_EXISTS'`、无 stack；ValidationPipe 产生的数组 message（BadRequest）→ 400 `code:'VALIDATION_ERROR'`；Mongoose `CastError` → 400 `code:'INVALID_ID'`；未知 `Error` → 500 且不回传 stack/内部路径
- [x] ✅ T032 [P] 实现 `src/common/filters/http-exception.filter.ts`（`@Catch()` 全局过滤器：HttpException 字符串响应作为业务 code，校验异常归一 `VALIDATION_ERROR`，`CastError` 映射 `INVALID_ID`；E11000 已在 Service 层转 409，过滤器不重复处理），并在 `src/main.ts` 用 `useGlobalFilters` 注册（GREEN）
- [x] ✅ T033 [P] 先写失败测试：`src/common/interceptors/access-log.interceptor.spec.ts`——每个请求结束输出一条结构化日志（JSON 含 requestId/method/path/statusCode/durationMs），成功与异常路径均输出；同一请求的日志条目带同一 `requestId`（入口生成，标准库 `crypto.randomUUID()`）；不打印请求体中的 `password`
- [x] ✅ T034 实现 `src/common/interceptors/access-log.interceptor.ts`（入口生成 `requestId` 并挂到 `request`/响应头，Nest 内置 `Logger`，不引新依赖；`ponytail:` 注明天花板：请求级 requestId 关联+访问日志+耗时，无跨服务 TraceContext 传播、无指标导出，升级路径为接入统一 Trace 与指标设施），在 `src/main.ts` 用 `useGlobalInterceptors` 注册（GREEN）
- [x] ✅ T035 [no-test] 测试基建：`test/helpers/e2e-app.ts`——导出 `createTestApp()`（自举 AppModule，注册与 `main.ts` 一致的全局 ValidationPipe/Filter/Interceptor）与测试桩全局 Guard：从请求头 `x-test-user`（JSON `{id,isAdmin}`）写入 `request.user`，无头则不写、交由 RolesGuard 判 401/403；`ponytail:` 注明全局装配与 main.ts 重复约 3 行、需手动保持同步，登录模块落地后删除该桩

---

## Phase 3: User Story 1 - 用户注册（P1，MVP）

**Story goal**: 访客以唯一用户名/邮箱 + 合规密码注册，得到默认非管理员账号。

**Independent test**: 合法输入注册成功（isAdmin=false、有 createdAt、密码为 bcrypt 哈希）；重复用户名/邮箱分别 409；非法输入 400 且不产生账号。

- [x] ✅ T010 [P] [US1] 先写失败测试：`src/modules/user/dto/create-user.dto.spec.ts`——用户名 2–32、邮箱形状、密码 8–64 且含字母与数字；传入 `isAdmin` 被白名单拒绝/剥离
- [x] ✅ T011 [P] [US1] 实现 `src/modules/user/dto/create-user.dto.ts`（`class-validator` 装饰器，**不含 isAdmin**）（GREEN）
- [x] ✅ T012 [US1] 先写失败测试：`src/modules/user/user.service.spec.ts`（create 部分）——成功落库 isAdmin=false、生成 usernameLower、密码经 bcrypt 哈希且 ≠ 明文、出参脱敏；重复 usernameLower → 409 `USERNAME_EXISTS`；重复 email → 409 `EMAIL_EXISTS`；大小写/空格归一后仍判重
- [x] ✅ T013 [US1] 在 `src/modules/user/user.service.ts` 实现 `create(dto)`：归一化、`bcrypt.hash(pwd,10)`、强制不写 isAdmin、插入并把 Mongoose `11000` 按 keyPattern 转 409（GREEN）；在 `user.module.ts` 用 `MongooseModule.forFeature` 注册 User
- [x] ✅ T014 [US1] 实现 `src/modules/user/user.controller.ts` 的 `POST /users`（公开，`@HttpCode(201)`，调 service，返回 `toUserResponse`）
- [x] ✅ T015 [US1] E2E：`test/user-register.e2e-spec.ts`——合法注册 201、重复用户名/邮箱 409、弱密码/非法邮箱 400、响应无密码字段（用 T035 的 `createTestApp()` 自举，无需 request.user）

---

## Phase 4: User Story 2 - 查看与维护个人资料（P2）

**Story goal**: 已登录用户查看本人资料、修改本人邮箱；密码永不返回。

**Independent test**: 已登录可查本人脱敏资料；改成合法且未占用邮箱成功；占用邮箱 409 且原值不变；未认证 401；body 带 isAdmin 被丢弃。

- [x] ✅ T016 [P] [US2] 先写失败测试：`src/modules/user/dto/update-user.dto.spec.ts`——email 可选（`@IsOptional`+`@IsEmail`）；多余字段（isAdmin）被剥离
- [x] ✅ T017 [P] [US2] 实现 `src/modules/user/dto/update-user.dto.ts`（GREEN）
- [x] ✅ T018 [US2] 先写失败测试（扩展 `user.service.spec.ts`）——`findById`：合法 id 返回脱敏用户、非法 ObjectId → 400、不存在/已软删 → 404；`updateEmail`：成功改邮箱、email 冲突 → 409 且不变更
- [x] ✅ T019 [US2] 在 `src/modules/user/user.service.ts` 实现 `findById(id)` 与 `updateEmail(userId,dto)`（查询带 `deletedAt:null`，捕获 email 唯一冲突）（GREEN）
- [x] ✅ T020 [US2] 在 `user.controller.ts` 实现 `GET /users/me` 与 `POST /users/me`（挂 `@UseGuards(RolesGuard)` 且不带 `@Roles()`——认证-only 模式，见 T009；从 `request.user` 取本人 id，不接收路径参数）
- [x] ✅ T021 [US2] E2E：`test/user-profile.e2e-spec.ts`——用 T035 桩（`x-test-user` 普通用户头）查看本人、成功改邮箱、占用 409、无头 401、带 isAdmin 无效

---

## Phase 5: User Story 3 - 管理员管理用户（P3）

**Story goal**: 管理员列用户、查单个用户、设置/取消管理员、软删除；受最后管理员约束。

**Independent test**: 管理员可列表/详情/设管理员/软删除；普通用户与未认证被拒；取消或删除唯一管理员 → 409；软删后不可见、详情 404、记录保留、同名不可再注册。

- [x] ✅ T022 [P] [US3] 先写失败测试：`src/modules/user/dto/set-admin.dto.spec.ts`、`src/modules/user/dto/delete-user.dto.spec.ts`、`src/modules/user/dto/user-query.dto.spec.ts`——`SetAdminDto {id,isAdmin}` 的 id 须为 MongoId、isAdmin 布尔；`DeleteUserDto {id}` 的 id 须为 MongoId；`UserQueryDto` 的 limit 封顶/缺省、cursor 可选（一个实现文件对应一个 spec）
- [x] ✅ T023 [P] [US3] 实现 `src/modules/user/dto/set-admin.dto.ts`、`src/modules/user/dto/delete-user.dto.ts`、`src/modules/user/dto/user-query.dto.ts`（GREEN）
- [x] ✅ T024 [US3] 先写失败测试（扩展 `user.service.spec.ts`）——`list`：仅返回 deletedAt:null、按 `_id` 游标倒序、limit 封顶 50、返回 `{items,nextCursor}` 且 items 脱敏；`setAdmin`：提权成功、降权唯一管理员 409 `LAST_ADMIN_PROTECTED`、目标不存在/已删 404；`softDelete`：置 deletedAt、删唯一管理员 409、删后 list 不可见/findById 404/记录仍在/同名再注册 409/重复删除 404
- [x] ✅ T025 [US3] 在 `src/modules/user/user.service.ts` 实现 `list(query)`、`setAdmin(dto)`、`softDelete(dto)`：管理员计数条件 `{isAdmin:true,deletedAt:null}`，所有读带 `deletedAt:null`（GREEN）
- [x] ✅ T026 [US3] 在 `user.controller.ts` 实现管理员接口（均 `@Roles('admin')` + RolesGuard）：`GET /users`、`GET /users/detail`、`POST /users/admin`、`POST /users/delete`（写参数走 body）
- [x] ✅ T027 [US3] E2E：`test/user-admin.e2e-spec.ts`——用 T035 桩分别发管理员/普通用户/无头态：管理员列表/详情/提权/降权/软删除全链路；普通用户 403、未认证 401；最后管理员保护；软删后各项断言

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 全量验证、文档与收尾。

- [x] ✅ T028 [no-test] 本地跑全量 `pnpm lint && pnpm test && pnpm test:e2e`，退出码 0；按 quickstart.md 核对关键用例
- [x] ✅ T029 [no-test] 更新 `docs/context.md`（会话记录/进行中工作），并把宪法 V 的延后项——指标导出与跨服务 TraceContext 传播——登记到 `context.md` 后续功能/草稿区（或建 issue），避免静默遗忘；如实现与设计有偏差，同步修订 `docs/architecture/design/user-module-design.md` 与 ADR-002（文档与代码同一 PR）
- [x] ✅ T030 [no-test] 跑 verification-before-completion；通过后由编排 Agent 将 `.specify/superpowers-handoff.json` 状态置为 `complete`

---

## 依赖关系（故事完成顺序）

```text
Phase 1 Setup ──▶ Phase 2 Foundational（T004–T009 + T031–T035）
                      │
                      ├─▶ Phase 3 US1（注册，MVP）T010–T015
                      │        │
                      │        ├─▶ Phase 4 US2（资料）T016–T021   [依赖 US1 的 create/schema]
                      │        │
                      │        └─▶ Phase 5 US3（管理）T022–T027   [依赖 US1 的用户存在；可与 US2 并行]
                      ▼
                 Phase 6 Polish T028–T030（必须最后）
```

- US2 与 US3 仅共同依赖 US1，彼此无依赖，可并行分派。
- T031–T035 属 Foundational（全局过滤器/日志拦截器/测试桩），全部 E2E（T015/T021/T027）依赖 T035；T020 依赖 T009 的认证-only 模式；T032/T034 都要改 `src/main.ts` 注册行，二者串行（T034 不标 [P]），且均在 T003 之后。
- 同阶段标注 [P] 的任务文件互不重叠，可并行；未标 [P] 的存在同文件先后（如 service 测试先于/伴随实现）。

## 并行示例

- Foundational：T004/T005（schema）、T006/T007（response dto）、T008/T009（guard）、T031/T032（filter）、T033/T034（interceptor）五组（同组内 RED→GREEN 串行）；T035 测试基建独立可并行。注意 T032 与 T034 均改 main.ts，注册动作串行。
- US1：T010/T011（DTO）与 T012 的测试准备可并行，但 T013 依赖 T011。
- US2 ↔ US3：在 US1 完成后作为两个独立子任务流并行。

## 实现策略

1. **MVP 优先**：先完成 Phase 1–3（US1 注册）即构成可独立演示、可部署的最小价值切片。
2. **严格 TDD**：每个生产逻辑任务先提交失败测试，再写最小实现；禁止先实现后补测试，禁止删测试求通过。
3. **增量交付**：US1 → US2 → US3，每个 Phase 结束保持 `pnpm lint && pnpm test` 绿。
4. **安全默认**：密码哈希、出参脱敏、Guard、DTO 白名单在对应阶段内闭环，不延后到 Polish。
5. 依赖安装（T001）需人工评审，不由 AI 自行变更 `package.json`。
