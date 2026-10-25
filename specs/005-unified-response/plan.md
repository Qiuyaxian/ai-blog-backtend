# Implementation Plan: 全局统一响应外壳（005-unified-response）

**Branch**: `005-unified-response` | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-unified-response/spec.md`

## Summary

给所有业务 JSON 接口（auth、users 共 9 个）加统一响应外壳 `{ code, data, message, path, time }`，错误体收敛为同形状（`data:null`，移除顶层 `statusCode`）：

1. 新增横切目录 `src/common/response/`：
   - `response.constants.ts`：`SUCCESS_CODE='SUCCESS'`、`SUCCESS_MESSAGE='ok'`、外壳类型 `ApiResponse<T>`、豁免路径判定纯函数 `isEnvelopeExcludedPath(path)`（豁免 `/` 精确匹配 + `/health` 前缀）。
   - `transform-response.interceptor.ts`：全局成功包裹拦截器，从 `req.path` 取路径、`new Date().toISOString()` 取时间；豁免路径直接透传。
   - `response-schemas.ts`（Swagger）：`SuccessEnvelope` 泛型基类（`data` 用 `@ApiProperty` 描述）+ 5 个具体成功模型类（Login/User/UserListPage/Logout/Delete）；`ErrorResponse` 改造为五字段外壳（`data:null`，删 `statusCode`），并从 `src/common/swagger/response-schemas.ts` 迁出/收敛。
2. 改造 `src/common/filters/http-exception.filter.ts`：错误体输出 `{ code, data:null, message, path, time }`；`path` 从 `request.url/path` 取（不含 query），`time` 为处理时刻；豁免路径（health）上的异常不套外壳（透传 Terminus 原生错误体），保证探针契约不变。
3. 两个装配点 `src/main.ts`、`test/helpers/e2e-app.ts` 注册新拦截器（顺序：TransformResponse 在外、AccessLog 在内或反之不影响 statusCode 与日志，plan 研究锁定）。
4. Swagger 注解迁移：9 个业务接口成功响应 `type` 换成具体 `*Envelope` 类；错误响应引用改造后的 `ErrorEnvelope`；`response-schemas.ts` 旧文件删除或改为 re-export（研究锁定，倾向删除并更新 import，2 个 controller 引用）。
5. 测试迁移：filter 单测改写；新增拦截器/常量纯函数单测；7 个 E2E 套件成功断言改读 `body.data.*`、错误断言读 `body.code` 且断言无 `statusCode`/`data:null`；`loginHelper` 改取 `data.token`；health/root E2E 断言原样不回归。
6. 文档：ADR-006、context.md、受影响 contracts（001/003/004）与开发文档同步；无第三方依赖、无 DB/缓存/鉴权改动。

## Technical Context

**Language/Version**: TypeScript 5.0.0 / Node 20

**Primary Dependencies**: NestJS 9.0.0（common/core/platform-express）、rxjs（既有，拦截器 `map`）、@nestjs/swagger 7.4.2（既有）。**不新增依赖**。

**Storage**: 无变更（MongoDB / Redis 不参与；无 Schema/索引/缓存键改动）

**Testing**: Jest 单测（源码同目录，mock 外部依赖）+ Jest/supertest E2E（自举应用，`--runInBand`，真实本地 mongod + redis，库 `ai_blog_test`）

**Target Platform**: Linux/macOS 服务端；local/uat/production 三环境行为一致（外壳不随环境变化）

**Performance Goals**: 每成功请求仅一次对象封装 + 一次 `Date.toISOString()`，P95 影响可忽略（<1ms）；不新增 I/O

**Constraints**:

- 成功体固定 `code:'SUCCESS'`、`message:'ok'`；错误体无顶层 `statusCode`/`error`
- `/`、`/health/live`、`/health/ready`（含 ready 503）不套外壳
- HTTP 语义状态码保留（注册 201，其余成功 200；400/401/403/404/409/500 不变）
- 零新依赖、零 DB/缓存/鉴权行为变更、不泄露堆栈/内部路径

**Scale/Scope**: 9 业务接口；2 个新源码文件 + 1 个新 schema 文件（约 3 新文件）、改 1 filter、2 装配点、2 controller 注解、6 个 E2E 套件 + 1 个 helper、1 个 filter 单测改写 + 2 个新单测

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 宪法原则                  | 结论                  | 依据                                                                                                                                                                                                                                                             |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. TypeScript-First       | ✅ 通过               | 外壳以显式 `ApiResponse<T>` 类型 + Swagger class 表达；常量显式类型；无 `any`（Swagger 泛型基类 data 若放宽必须 unknown 收窄 + 注释，研究锁定具体 class 方案规避）                                                                                               |
| II. 模块边界与分层        | ✅ 通过               | 外壳是横切能力，落 `src/common/response/`，与 cache/filters/interceptors 同级；Controller/Service 零改动（不改返回值、不手工构造外壳）；`toUserResponse` 仍是 user 域映射器；不跨模块直连 Schema、无循环依赖                                                     |
| III. Test-First           | ✅ 通过（非协商项）   | 纯函数（豁免路径判定）先 RED 单测；拦截器用 mock ExecutionContext/CallHandler 先 RED 后 GREEN；filter 改造先改单测断言（RED：新字段缺失/旧 statusCode 仍在）；E2E 先迁移断言到新外壳确认全红再实现；文档/ADR/env 无改动任务标 `[no-test]`                        |
| IV. 安全与合规默认开启    | ✅ 通过               | 错误体改造不扩大暴露面：500 仍只回 `internal server error`、堆栈仅入日志；`data` 脱敏继续由 `toUserResponse` 保证，外壳不触碰字段；不绕过 Guard/Pipe；AuthGuard/RolesGuard 抛出路径与 code 不变                                                                  |
| V. 可观测、可灰度、可回滚 | ⚠️→✅ 破坏性 API 变更 | 宪法原则 I/V 要求 API 向后兼容/版本化；本功能是模板阶段无外部消费方，人工澄清确认一次性切换，ADR-006 登记破坏性与影响面；回滚 = 还原拦截器注册与 filter（≤5 分钟）；访问日志 requestId/耗时不变；探针排除保证监控不回归；无 DB 变更故无 expand-contract 数据问题 |

依赖引入顺序检查：拦截器能力由平台内置（Nest Interceptor + rxjs，均已装）提供，无标准库缺口、无需新生态依赖。复杂方案不需要；无 Complexity Tracking 项。

## Project Structure

### Documentation (this feature)

```text
specs/005-unified-response/
├── spec.md
├── plan.md                 # 本文件
├── research.md             # 拦截器顺序/豁免机制/Swagger 泛型外壳/filter 取 path 调研
├── data-model.md           # 内存期外壳结构（无持久化实体）
├── quickstart.md           # 手工冒烟 + 自动化验证
├── contracts/
│   └── api-contract.md      # 9 业务接口外壳前后契约对照 + 错误外壳 + 豁免路径
├── checklists/
│   └── requirements.md     # spec 质量清单
└── tasks.md                # /speckit.tasks 产出
```

### Source Code (repository root)

```text
src/
├── main.ts                                   # 注册 TransformResponseInterceptor（改）
├── common/
│   ├── response/                             # 新增横切目录
│   │   ├── response.constants.ts             # SUCCESS_CODE/SUCCESS_MESSAGE/ApiResponse<T>/isEnvelopeExcludedPath
│   │   ├── response.constants.spec.ts        # 豁免路径纯函数单测
│   │   ├── transform-response.interceptor.ts # 成功包裹 + 豁免透传
│   │   ├── transform-response.interceptor.spec.ts
│   │   └── response-schemas.ts               # Swagger：5 个成功外壳 class + ErrorEnvelope（由 swagger/response-schemas 迁移收敛）
│   ├── filters/
│   │   ├── http-exception.filter.ts          # 改：五字段错误体 + path/time + 豁免透传
│   │   └── http-exception.filter.spec.ts     # 改：断言新外壳
│   └── swagger/
│       └── response-schemas.ts               # 删除或收敛为 re-export（研究锁定，倾向删除）
└── modules/
    ├── auth/auth.controller.ts               # 改注解：成功 type 换外壳类、错误引用换 ErrorEnvelope
    └── user/user.controller.ts               # 同上
```

## Phase 0 Research（产出 research.md）

1. Nest 9 全局拦截器与 `useGlobalInterceptors(new A(), new B())` 的执行顺序，确认 TransformResponse 与 AccessLog 共存时 statusCode/耗时/requestId 不受 `map` 影响；是否需要把响应封装改为 DI `APP_INTERCEPTOR`（结论倾向：沿用 `useGlobal*` 双装配点现状，不调整结构）。
2. 拦截器内取「不含 query 的请求路径」的稳定来源（Express `req.path` vs `req.url`），与 AccessLog 现有用法对齐。
3. 豁免策略：精确匹配 `/` + `/health` 前缀（覆盖 live/ready 及 Terminus 503）；filter 与 interceptor 共用同一纯函数，避免两处判定漂移。
4. Terminus readiness 失败（503）是否经过全局 ExceptionFilter、`@HealthCheck()` 如何写响应；据此确认 filter 的豁免透传实现（不二次包裹、不改其 body）。
5. Swagger 表达泛型外壳的方式：`@nestjs/swagger` 无运行时泛型；候选 A=每个 data 类型一个 `@ApiProperty({type:X})` 外壳 class（5 个，直白）；候选 B=自定义 `@ApiEnvelope(X)` 装饰器 + 装饰器合并（省代码但增抽象，YAGNI）。倾向 A。
6. 旧 `src/common/swagger/response-schemas.ts` 中 `LoginResultResponse` 等 data 类仍被外壳类引用；确认迁移后文件归属（data 模型与 envelope 同放 `common/response/response-schemas.ts`，删旧文件，更新 2 controller import）。
7. E2E 迁移面精确清点（grep `res.body`/`.body.` 逐套件），确认 helper `loginHelper` 改动后所有调用点自动受益；统计需改断言数。

## Phase 1 Design

### 组件设计

- **response.constants.ts**
  - `SUCCESS_CODE = 'SUCCESS'`、`SUCCESS_MESSAGE = 'ok'`
  - `interface ApiResponse<T> { code:string; data:T|null; message:string|string[]; path:string; time:string }`
  - `isEnvelopeExcludedPath(path:string): boolean`：`path === '/' || path === '/health' || path.startsWith('/health/')`（纯函数，单测边界：`/health`、`/health/live`、`/healthxxx` 不豁免、`/users` 不豁免、根 `/` 豁免）。
  - 错误码常量是否一并抽出（上一轮讨论提到的 `ErrorCode` 映射表）：spec FR-006 明确本期不重命名错误码，仅把现有散落字符串收敛为常量属「防漂移」附带收益。**决定**：抽 `BusinessErrorCode` 常量对象供 filter/service/guard 引用（纯重命名引用、值不变），在 tasks 单列并标注重命名性质，先 grep 全部字面量保证值不变；若评估改动面过大则降级为只在 filter 内引用常量、service 字面量不动（analyze 时据研究结论定）。
- **transform-response.interceptor.ts**
  - `intercept(ctx, next)`：取 `req.path`；若豁免则 `return next.handle()`；否则 `next.handle().pipe(map(data => ({code:SUCCESS_CODE, data, message:SUCCESS_MESSAGE, path, time:new Date().toISOString()})))`。
  - 不碰异常（异常仍进 filter），不打日志。
- **http-exception.filter.ts**
  - `normalize` 逻辑（CastError→INVALID_ID、校验数组 →VALIDATION_ERROR、业务 code 透传、未知 →INTERNAL_ERROR）与状态码判定**完全不变**；仅把最终 body 改为五字段：`{ code, data:null, message, path, time }`。
  - 豁免路径上的异常：直接透传原响应（Terminus 503 自带 JSON）；实现为 filter 内 `if (isEnvelopeExcludedPath(req.path)) { response.status(status).json(rawResponse) }`——研究需确认 Terminus 错误体来源，若其不经过该 filter 则本分支仅作保险并有单测。
- **response-schemas.ts（Swagger）**
  - `LoginEnvelope { code, data: LoginResultResponse, message, path, time }` 等 5 个；`ErrorEnvelope { code, data: null, message:string|string[], path, time }`。
  - `data` 为 `null` 的写法：`@ApiProperty({ nullable:true, example:null, type:() => Object })` 或 `type: 'object'` + nullable，研究确认 swagger 7.4.2 渲染。
- **装配**：`main.ts`/`e2e-app.ts` `app.useGlobalInterceptors(new TransformResponseInterceptor(), new AccessLogInterceptor())`（顺序据研究 R1）。

### 数据访问

无。纯 HTTP 横切层，不注入任何 Mongoose Model / Redis client。

### 风险与应对

| 风险                                        | 应对                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| E2E 断言迁移漏改导致假绿/假红               | 逐套件 grep 清点（research R7）；成功字段一律经 `body.data`；完成后 grep 残留 `.body.token` 等 |
| health 503 被 filter 二次包裹，探针契约回归 | research R4 先证伪/证实；filter 豁免分支 + E2E 断言 ready 失败路径（如可造）或单测模拟         |
| Swagger 外壳 `data:null`/泛型渲染不符       | 文档源 E2E 哨兵断言 envelope 字段存在（沿用 004 文档源测试方式）                               |
| 拦截器顺序影响 AccessLog statusCode         | research R1；单测两拦截器共存（或 E2E 验证 x-request-id/日志不变）                             |
| 错误码常量重命名引入拼写漂移                | 值不变的引用替换 + `pnpm test` 全量；或按研究结论降级范围；不与外壳逻辑混在同一提交            |
| 破坏性变更无版本双写，回滚需快速            | ADR-006 登记；单 PR、回滚即还原注册；无 DB 变更                                                |

### Expand-Contract / 兼容

无数据库变更。API 为一次性破坏性切换（澄清已确认无外部消费方）；不保留旧 `statusCode` 字段（FR-005 明确移除），故无 expand 双写期；回滚路径在 ADR-006。

## Phase 2 Tasks（概览，tasks.md 展开）

1. Setup：分支、常量/类型与豁免纯函数（RED 单测）。
2. 错误外壳：filter 单测先改红 → filter 五字段 + path/time + 豁免透传 → 绿。
3. 成功外壳：拦截器单测 RED → 实现 → 两装配点注册。
4. Swagger：外壳 class 迁移 + 2 controller 注解；文档源哨兵 E2E RED→GREEN。
5. E2E 迁移：helper + 6 套件断言；health/root 不回归。
6. Polish：ADR-006、context、contracts/开发文档、全量门禁、手工冒烟、`/evolve`。

## Verification

- `pnpm lint && pnpm test && pnpm test:e2e` 全绿（真实 mongod + redis）。
- 新增纯函数/拦截器单测、filter 单测覆盖五字段与豁免；E2E 覆盖 9 接口外壳、错误外壳、3 豁免路径。
- 手工冒烟见 quickstart.md（注册/登录/本人/登出 + 400/401/403/404/409 + health/root）。
- grep 证据：`grep -rn "statusCode" src/common/filters`（仅 HTTP 状态变量，非响应字段）、E2E 无顶层成功字段残留、文档源无旧 ErrorResponse。
