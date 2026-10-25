# Research: 全局统一响应外壳（005-unified-response）

**Date**: 2026-10-26 | **Status**: Confirmed（代码级核实，非记忆）

所有结论均在当前 `node_modules`（@nestjs/terminus 9.2.2、@nestjs/common 9、@nestjs/swagger 7.4.2）与本仓源码中核实。

## R1. 全局拦截器执行顺序与 AccessLog 共存

- `app.useGlobalInterceptors(new TransformResponseInterceptor(), new AccessLogInterceptor())`：Nest 按注册顺序包裹，先注册者在最外层（请求先入、响应后出）。响应流：Controller → AccessLog.tap（取 `res.statusCode` 记录）→ Transform.map（包裹 body）。
- AccessLog 的 `tap` 只读 `http.getResponse().statusCode` 并打日志，不改 body/status；Transform 的 `map` 只改 body，不动 status。二者无共享状态，顺序对 `x-request-id`、日志 `statusCode`、耗时均无影响。
- 结论：顺序不敏感；为清晰起见注册为 `new TransformResponseInterceptor(), new AccessLogInterceptor()`（包裹在最外层，语义=最终出参由它定型）。E2E 用既有 access-log 行为（`x-request-id` 头存在）回归即可，无需新增双拦截器单测。

## R2. 请求路径来源（不含 query）

- Express 请求对象：`req.path` 等价于 `parseurl(req).pathname`，**不含** query string；`req.url` 含 `?a=b`。
- 本仓 `AccessLogInterceptor` 已使用 `req.path`（access-log.interceptor.ts）。
- 结论：拦截器与过滤器统一取 `req.path`；`message`/`code` 不依赖原始 URL。

## R3. 豁免路径判定（拦截器 + 过滤器共用一个纯函数）

- 豁免集合：`GET /`、`/health/live`、`/health/ready`。
- 纯函数：`isEnvelopeExcludedPath(path) = path === '/' || path === '/health' || path.startsWith('/health/')`。
  - `/healthxxx` 不豁免（startsWith 带斜杠边界）；`/users` 不豁免；`/health/ready` 豁免。
- 成功侧：拦截器命中豁免直接 `return next.handle()`，原样透传（`/` 的纯文本、live 的 `{status:'up'}`、ready 200 的 Terminus JSON）。
- 错误侧：过滤器命中豁免时透传异常的原始 response body（见 R4）。
- 两处 import 同一函数，杜绝判定漂移。

## R4. Terminus readiness 503 确实经过全局过滤器（关键）

源码核实 `node_modules/@nestjs/terminus/dist/health-check/health-check.service.js`：

```js
if (result.status === 'error') {
  this.logger.error(...);
}
throw new common_1.ServiceUnavailableException(result);
```

- ready 失败时 Terminus **抛出** `ServiceUnavailableException(HealthCheckResult)`，走 Nest 异常管线 → 被全局 `HttpExceptionFilter` 捕获，并非自写响应。
- 当前过滤器对该异常的处理：`getResponse()` 为 HealthCheckResult 对象（无 `message` 字段），走到 `const code = response.code ?? 'ERROR'` → 当前 503 实际被改写为 `{ code:'ERROR', message:{...result}, statusCode:503 }`，**已经不是 Terminus 原生体**（既有偏差，redis-health E2E 只测 200，未覆盖失败体）。
- 本功能要求 ready 503 保持 Terminus 原生 JSON：
  - filter 在入口先取 `req.path`，命中豁免时：从异常取 status 与 raw response，`response.status(status).json(raw)` 透传，不加 code/data/time。
  - 实现：对 `HttpException` 用 `exception.getStatus()` + `exception.getResponse()` 原样写出；非 HttpException 的豁免路径错误（理论上 live 不触依赖、ready 只抛 HttpException）兜底按现状 500 但不套外壳（透传 `{message,statusCode}` 原始形态）。
- 测试：filter 单测新增「豁免路径 + ServiceUnavailableException(TerminusResult) → body 等于原 TerminusResult、status 503」用例。不新增真实停 Redis 的 E2E（脆弱、慢）；单测足以锁定契约。

## R5. Swagger 表达统一外壳（无运行时泛型）

- `@nestjs/swagger` 7.4.2 由 TS 装饰器元数据生成 schema，无法用一个泛型 class 自动派生 `data` 的不同类型。
- 选定方案 A（直白、零新抽象）：在 `src/common/response/response-schemas.ts` 为 5 类成功体各定义一个显式外壳 class，`data` 用 `@ApiProperty({ type: XxxResponse })`：
  - `LoginEnvelope.data: LoginResultResponse`
  - `UserEnvelope.data: UserResponseDto`（注册、本人、改邮箱、setAdmin 复用同一个）
  - `UserListPageEnvelope.data: UserListPageResponse`
  - `LogoutEnvelope.data: LogoutResultResponse`
  - `DeleteEnvelope.data: DeleteResultResponse`
  - 公共字段 `code/message/path/time` 用一个基类 class（带 `@ApiProperty`）+ `extends` 承载，避免 5 处重复声明。
- 错误模型 `ErrorEnvelope`：
  - `data`：`@ApiProperty({ nullable: true, example: null, type: Object })`（渲染为 object 且 nullable；研究任务执行时以实际 `/api-docs-json` 输出为准微调 `type`）。
  - `message`：沿用现 `oneOf string/string[]`。
  - 无 `statusCode`。
- 不做方案 B（自定义 `@ApiEnvelope(X)` 合并装饰器）：省约 20 行但引入自制 Swagger 抽象，YAGNI。
- data 模型类（`LoginResultResponse` 等）从旧 `src/common/swagger/response-schemas.ts` 搬到 `common/response/response-schemas.ts`；旧文件删除，2 个 controller 改 import（grep 仅 user/auth controller 引用）。

## R6. 业务代码零改动的边界

- Controller 仍 `return service.xxx()`（裸数据）；拦截器统一包裹。Controller/Service/`toUserResponse` 零改动。
- `toUserResponse`（user-response.dto.ts:49）是 Mongoose 文档 → 6 字段脱敏视图的**域映射器**，与 HTTP 外壳正交，不重命名、不泛化、不移动。
- 注册 `@HttpCode(201)` 冗余（POST 默认 201）但**不在本功能删除**（避免无关 diff；如需清理由独立重构处理）。
- 成功码/消息常量只在拦截器与 schema 引用，业务层不感知。

## R7. E2E 迁移面清点（grep 实测）

需改断言的 E2E 文件（6 套件 + 1 helper）：

| 文件                             | 成功侧改动                                                                                                                               | 错误侧改动                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `test/helpers/e2e-app.ts`        | `loginHelper` 返回 `res.body.data.token`                                                                                                 | —                                                                                                                              |
| `test/user-register.e2e-spec.ts` | `body.id/...`→`body.data.id`；登录 `data.token/data.user`                                                                                | `body.code` 路径不变（code 仍在顶层）；新增无 `statusCode`、`data:null` 断言                                                   |
| `test/auth-login.e2e-spec.ts`    | `data.token/data.expiresAt/data.user`；logout `toEqual({success:true})`→`toEqual({success:true})` 位于 data；锁定 401 全等体改法（见下） | `body.code` 不变；`unknown.body === wrongPassword.body` 全等比较改为比较规范化字段（path/time 不同，不能再 toEqual 整个 body） |
| `test/user-profile.e2e-spec.ts`  | `data.id/data.email/data.isAdmin` 等                                                                                                     | `body.code` 不变                                                                                                               |
| `test/user-admin.e2e-spec.ts`    | `data.id/data.items/data.nextCursor`；删除 `toEqual({id})`→`data`                                                                        | `body.code` 不变                                                                                                               |
| `test/swagger-docs.e2e-spec.ts`  | Bearer 调试段 `data.username`；文档源哨兵改为断言 envelope schema                                                                        | production 401 `body.code` 不变                                                                                                |
| `test/app.e2e-spec.ts`           | 不改（`/` 豁免，仍 `Hello World!`）                                                                                                      | —                                                                                                                              |
| `test/redis-health.e2e-spec.ts`  | 不改（health 豁免，200 原生）                                                                                                            | —                                                                                                                              |

注意点：

1. `auth-login.e2e-spec.ts` 现有「未知账号与错误密码响应全等」（`expect(unknown.body).toEqual(wrongPassword.body)`）与锁定计数第六次全等第一次：新外壳含 `time`（每次不同）与相同 `path`，全等必失败。改为 `toMatchObject({ code:'INVALID_CREDENTIALS', data:null, path })` 且断言 `typeof body.time === 'string'`。
2. filter 单测：全部 4 个用例的 `payload` 断言从 `{code,statusCode}` 改为 `{code,data:null,message,path,time}`；`mockHost` 的 request 桩当前只有 `{ body }`，需补 `path`。
3. service/guard 单测不断言响应外壳（它们只 throw/return），**无需改**；仅确认不引用过滤器字段。
4. 新增断言：每个成功用例顶层键集合 = `code,data,message,path,time`（`expect(Object.keys(body).sort())` 抽样而非每个用例，避免臃肿——在一个契约用例里锁定）。

## R8. 错误码常量化：本期不做

- 现状 10 个错误码字面量散落在 6 个生产文件（auth.guard、roles.guard、auth.service、user.service、filter）和约 20 处测试断言；filter 内另有 3 个框架级 code（`VALIDATION_ERROR/INVALID_ID/INTERNAL_ERROR`）。
- 抽 `BusinessErrorCode` 常量是值不变的引用重命名，防漂移收益真实，但：① 与「统一外壳」是两个独立关注点；② 触及 service/guard 扩大 diff 与评审面；③ 值不变测试无需改但生产 import 面变大。
- 决定（YAGNI + 最小 diff）：本期仅新增 `SUCCESS_CODE/SUCCESS_MESSAGE` 两个外壳常量；错误码常量化记为后续独立重构（可在 `/evolve` 或单独 feature）。analyze 时核对该决定与 FR-006「不重命名错误码」一致。

## R9. filter 取 path 的桩兼容

- 现有 `mockHost` 的 `getRequest()` 返回 `{ body }`，无 `path`。filter 新增 path 读取后，旧桩 `path` 为 `undefined`：豁免判定对 `undefined` 必须安全（纯函数入参按 string 处理，测试桩补 path 即可；生产路径上 req.path 恒存在）。
- 纯函数签名 `isEnvelopeExcludedPath(path: string)`，不接收 req，便于单测。

## R10. 不引入 DI 注册改造

- 现状 filter/interceptor/pipe 均在 `main.ts` 与 `e2e-app.ts` 用 `useGlobal*(new ...)` 双点手工注册（002/003/004 一致），并有 ponytail 注释说明约 3 行重复刻意保留。
- 本功能沿用该模式新增第三个 interceptor，不改为 `APP_INTERCEPTOR` provider（那是结构重构，超出需求，且会改变 e2e 装配路径）。
