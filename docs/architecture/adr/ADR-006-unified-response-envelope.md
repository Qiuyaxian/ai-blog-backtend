# ADR-006：全局统一响应外壳（成功包裹 / 错误扁平化；成功 HTTP 200，错误状态码语义化）

## 状态

待确认（Pending）

> 状态枚举遵循 `AGENTS.md` §9。2026-10-26 随 005-unified-response 实现产出（Pending），待人工评审。

## 日期

2026-10-26

## 背景与约束

- 001–004 落地后，9 个业务接口的响应体形状不统一：成功时顶层直接是业务数据（如注册返回用户字段、登录返回 `{token,expiresAt,user}`）；失败时 `HttpExceptionFilter` 产出 `{code,message,statusCode}`。前端与测试需按接口分别记忆形状，错误体还携带与 HTTP 状态行重复的 `statusCode`。
- 规格 `specs/005-unified-response` 硬约束（T027 后对齐 `@nestarc/safe-response` 形态）：
  - 成功/失败统一**四字段**外壳 `{success,code,message,data}`，顶层恰为这 4 个键；成功 `success:true`，失败 `success:false` 且 `data` 恒为 `null`；无 path/time；
  - HTTP 语义状态码、业务错误码字符串、鉴权/校验/缓存/DB 行为全部不变（FR-006）；
  - data 原样支持 `null` / `[]` / `{}` / 任意业务对象，不做丢弃或替换；
  - 探活路径 `GET /` 与 `/health/*` 逐字节保持现状（Terminus 原生 JSON、503 失败体也不被包裹）；
  - Controller/Service/`toUserResponse` 零改动，业务代码不手工构造外壳；
  - Swagger 文档源呈现新外壳，旧含 `statusCode` 的 ErrorResponse 模型引用数为 0；
  - 不引入新依赖，不做 API 版本双写。

## 决策

1. **成功侧：全局 map 拦截器**。新建 `src/common/response/transform-response.interceptor.ts`，只做 `map(data => ({success:true,code:SUCCESS_CODE,message:SUCCESS_MESSAGE,data}))`；不 catch、不打日志、不读 query。data 原样保留（null/[]/{}/对象均不替换）。业务 Controller 仍 `return service.xxx()` 裸数据，自动获得外壳。
2. **错误侧：改既有过滤器产出形状**。`HttpExceptionFilter` 非豁免路径 body 为 `{success:false,code,message,data:null}`；`normalize` 的 status 判定逻辑一字不动（错误码值不变），删除 body 中的 `statusCode`（HTTP 状态行仍由 `response.status(status)` 写出）；500 详情仍只入日志不外泄。错误码文案统一从 `ERROR_CODES` 注册表取（见决策 11）。
3. **豁免由单一纯函数决定，两处共用**。`src/common/response/response.constants.ts` 导出 `isEnvelopeExcludedPath(path) = path==='/' || path==='/health' || path.startsWith('/health/')`（带斜杠边界，`/healthx` 不豁免）；拦截器命中豁免直接 `return next.handle()` 透传；过滤器命中豁免时对 `HttpException` 用 `getStatus()` + `getResponse()` **原样 `json(raw)`**——这同时修正了既有偏差（ready 503 的 Terminus 原生体此前被改写成 `{code:'ERROR',...}`，见 research R4）。
4. **注册点沿用手工双装配**：`src/main.ts` 与 `test/helpers/e2e-app.ts` 各自 `useGlobalInterceptors(new TransformResponseInterceptor(), new AccessLogInterceptor())`，拦截器在最外层（最终出参定型）；不改为 `APP_INTERCEPTOR/APP_FILTER` DI provider（R10，结构重构超出需求）。
5. **请求路径不再进入外壳**：T027 起外壳不含 `path`/`time`（对齐 `@nestarc/safe-response`）；请求级关联仍由 `AccessLogInterceptor` 的 `x-request-id` 结构化日志承载，排障不依赖响应体。
6. **【已被决策 13 取代，2026-10-26】错误响应经组合装饰器 `ApiErrorResponses(statuses[], overrides?)` 声明**（用户追加要求，2026-10-26）：~~每个接口逐一声明真实会返回的状态码~~。决策 13 起错误响应改由文档后处理全局注入，`ApiErrorResponses` 工厂已删除，本条保留为演进轨迹。
7. **【部分被决策 13 取代，2026-10-26】守卫与 Bearer 经组合装饰器绑定**：`@AuthOnly()`/`@AdminOnly()` 仍保留 `UseGuards(RolesGuard)` + `@ApiBearerAuth` + `@Roles('admin')` 的组合，但不再在装饰器里挂 401/403 错误文档（错误文档统一全局注入，见决策 13）。Swagger 文档在启动期由装饰器元数据静态生成、无法从守卫运行时抛错派生这一事实不变。
8. **一次性破坏性切换，不做版本双写**：当前无外部消费方（模板项目，前端联调中），无 `X-API-Version` 兼容层；错误码常量化等价值重构明确划出本期范围（R8）。
9. **错误配置集中到单一 `ERROR_CATALOG`，运行时文案与 Swagger 文档同源派生**（用户追加要求，2026-10-26，T027/T028）：`src/common/response/response.constants.ts` 的 `ERROR_CATALOG` 是唯一来源，每个业务码含 `status`（HTTP 状态）、`message`（客户端文案）、可选 `docLabel`（该状态的文档分类标签，每状态恰好挂一个，500 不挂故不进文档）。运行时 `ERROR_CODES: Record<code,message>`、Swagger 的 `SWAGGER_ERROR_STATUSES` 与 `swaggerErrorDescription(status)`（形如「标签（CODE1 / CODE2）」）全部从 catalog 派生，禁止第二份状态/文案表；未配置 docLabel 的状态查询 fail-fast。过滤器对字符串 code 的业务异常查派生出的 `ERROR_CODES`，未登记码回退异常原始 message；校验错误的字段数组 message 保留数组形态。Service/Guard 仍只抛稳定 code 字符串，HTTP 状态由异常类型决定、与 catalog 正交。
10. **Swagger 成功响应免逐接口注解**（用户追加要求，2026-10-26，T027，对标 `@nestarc/safe-response`）：
    - 启用 `@nestjs/swagger` 官方 CLI 插件（`nest-cli.json` 的 `compilerOptions.plugins`），从 controller 方法返回类型（解包 Promise/数组）自动生成成功响应 data 模型，控制器不再写成功 `@ApiResponse({type})`；E2E 经 ts-jest 编译无 nest-cli，`test/jest-e2e.json` 经 `test/ts-jest.transformers.js`（导出 name/version/factory）挂同一插件保证文档源一致。
    - 新增纯函数 `wrapSuccessEnvelope(document)`：`SwaggerModule.createDocument` 之后、`setup` 之前一处调用，把每个非豁免操作的 2xx `application/json` schema 改写为 `{ allOf: [$ref SuccessEnvelope, {type:object, properties:{data:<原schema>}}] }`；豁免路径与 4xx/5xx 原样；全文档共享一个 `SuccessEnvelope` 组件（success/code/message），幂等。原方案的 5 个逐 data 类型 Envelope 子类全部删除，data 模型类归各自域 dto（`auth/dto/login-result.dto.ts`、`user/dto/user-list-page.dto.ts`、`user/dto/delete-result.dto.ts`）。
    - 登录返回类型由 interface（插件无法为接口生成 schema）改为 class `LoginResultResponse`，与 service 的 `LoginResult` 结构同构兼容；登出无数据返回，controller 返回 `Promise<null>`，文档 data 为 nullable，原 `data:{success:true}` 的嵌套重复形态废弃（成功语义由顶层 success 承载）。
11. **状态码与错误响应全部全局化，控制器零响应注解**（用户追加要求，2026-10-26，T028）：在决策 12「成功响应免注解」基础上再去掉 `@HttpCode` 与 `@ApiErrorResponses`，控制器只留路由/守卫/`@ApiOperation`/`@ApiQuery`。
    - **成功状态码按路由约定推断**：新增纯函数 `resolveSuccessStatus(method, path)`（`src/common/response/success-status.ts`），规则=GET 恒 200；POST 资源根（路径仅一段，如 `/users`）为创建 201；POST 子路径动作（`/auth/login`、`/users/delete` 等）为 200。运行时由 `TransformResponseInterceptor` 在成功 `tap` 里 `res.status()` 落地，文档侧 `wrapSuccessEnvelope` 用同一函数把插件对无注解 POST 默认产出的 2xx 键归一（消除文档与运行时漂移）。约定约束：新增「创建」接口必须 POST 资源根，带子路径的 POST 一律视为动作。
    - **错误响应全局注入全套**：`wrapSuccessEnvelope` 给每个非豁免操作补齐 `400/401/403/404/409`，错误体统一 `$ref ErrorEnvelope`，描述用通用文案；`ErrorEnvelope` 模型随包裹函数注册进 components。已存在的错误码不覆盖（幂等）；豁免路径（`/`、`/health/*`）不注入。
    - **精度权衡（用户拍板接受）**：全套注入使每个接口文档都列出它运行时未必会返回的错误码（如 login 文档出现 403/404，注册接口出现 401/403/404），即决策 6/8 原本避免的「假契约」。换取的是控制器零样板、错误码集合一处维护；真实 HTTP 行为不变（运行时只返回真实抛出的状态码），仅文档枚举放宽。
    - 删除 `src/common/response/response-schemas.ts`（`ApiErrorResponses` 工厂与旧 `ErrorEnvelope` class）及其单测；`@AuthOnly/@AdminOnly` 收敛为守卫+Bearer+角色。
12. **成功 HTTP 状态码统一为 200**（用户追加要求，2026-10-26，T029）：所有业务成功响应均返回 200，包括 `POST /users` 创建用户，不再使用 201；运行时拦截器与 Swagger 2xx 键归一均直接使用 Nest `HttpStatus.OK`，T028 的 `resolveSuccessStatus` 因路由推断逻辑消失而删除。错误 HTTP 状态码继续语义化：400/401/403/404/409 表示对应客户端错误，500 仅作为未知服务器异常的兜底。此决策改变注册接口 HTTP 契约，但 body 的成功业务码仍固定为 `SUCCESS`。
13. **外壳 `code` 改为数字且恒等于 HTTP 状态码**（用户追加要求，2026-10-26，T030）：`ApiResponse.code` 类型 `string→number`，成功恒 `200`，失败为 `400/401/403/404/409/500`。服务异常本身全部保留——抛出位置、异常类型、HTTP 状态行、`message` 文案与鉴权/校验行为不变；原 10 个字符串标识（`VALIDATION_ERROR`、`INVALID_ID`、`UNAUTHENTICATED`、`INVALID_CREDENTIALS`、`FORBIDDEN`、`USER_NOT_FOUND`、`USERNAME_EXISTS`、`EMAIL_EXISTS`、`LAST_ADMIN_PROTECTED`、`INTERNAL_ERROR`）降级为 Service/Guard 抛出值与 `ERROR_CATALOG` 的**内部异常键**，不再原样出现在响应外壳。过滤器据键查到 `status` 后把该数字写入 `code`（`response.status()` 与 body `code` 同源恒等）。同一 HTTP 状态的多个细分原因（400 的校验/非法 ID；409 的用户名/邮箱/末管理员）仅由 `message` 区分；登录三类不可区分语义由「同 401 + 同 message」继续保证。
    - **理由**：调用方在状态行与 body 看到同一个数字，无需再维护「字符串码 ↔ HTTP 状态」第二张映射表；成功码也不再有与 200 并存的 `SUCCESS` 字面量。
    - **替代方案（已否）**：① 成功 200、错误仍字符串——两套值域，调用方仍需双分支；② 数字码 + 额外 `errorCode` 字段保留字符串——外壳变五字段，为模板阶段 YAGNI。`SUCCESS_CODE` 常量值随之改为 `HttpStatus.OK`。
14. **CRUD 五类操作的 `data` 形态锁定；游标分页改页码分页；只读单查不存在改 200/null；删除 data 改 null**（用户追加要求，2026-10-26，T031）：统一外壳只管顶层形状，本决策锁定 `data` 业务载荷的五种固定形态，适用于当前及后续所有业务模块：
    - **分页列表**：`data = { total:number, list:T[], page:number, pageTotal:number, index:number }`。入参 `page`（缺省 1）+`pageSize`（缺省 20、封顶 50）。`total` 为符合条件总条数（软删只计 `deletedAt:null`）；`pageTotal=ceil(total/pageSize)`，`total===0` 时为 0；`index=(page-1)*pageSize+1` 是本页首条全局序号（**从 1 起算**，用户拍板：首页 1、第 2 页=pageSize+1）；越界页 200 + 空 `list`。用户模块现有 `_id` 游标分页（`{items,nextCursor}` + `cursor/limit`）废止，改为 `countDocuments` + `skip/limit`。
    - **创建**：`data` = 新建对象（脱敏视图）；**更新**：`data` = 更新后的完整对象（脱敏视图）——现状即此，不改。
    - **删除**：`data = null`。原 `POST /users/delete` 返回 `{id}` 废止（成功语义由顶层 `success:true` 承载，不回传 id/布尔）。
    - **只读单个查询**：资源不存在（含已软删）返回 HTTP 200 + `data:null`，不再抛 404——「查不到」是合法空结果；非法 ID 仍 400。**写操作**（更新/删除/动作）目标不存在仍抛 404（不能对不存在的资源执行写动作）。
    - **理由**：调用方按操作类型即知 `data` 形状，无需逐接口记忆；前端表格分页组件普遍消费 `total/page/pageTotal`，`index` 支撑「序号 #21」连续编号；只读单查 null 化消除「用异常表达正常分支」。
    - **代价/替代（已否）**：① 保留游标分页——无限滚动友好但无法直接跳页、无总页数，与后台管理表格诉求不符；`skip` 深翻页性能在模板数据量下可接受，未来大表改游标时再立项；② `index` 从 0 起——与「第 N 条」人类编号差一，用户选从 1；③ 单查不存在保留 404——调用方须用错误分支处理空结果，与列表空页（200 空数组）语义不一致；④ 删除返回 `{id}`——与顶层 success 重复，且前端删除后本地已知 id。

## 考虑的替代方案

- **API 版本双写 / 过渡期双形状**：无外部消费方，expand-contract 式兼容只增复杂度与未删除代码。否决。
- **`APP_INTERCEPTOR` DI 注册**：可消双装配点重复，但会改变 e2e 自举路径、属结构重构；约 3 行重复已有 ponytail 注释刻意保留。否决（R10）。
- **Controller 手工 return 外壳对象**：9 处重复、业务层感知 HTTP 形状、易漏。否决，改为全局拦截器。
- **保留错误体 `statusCode`**：与 HTTP 状态行重复，且违背「顶层恰 5 键」契约。否决。
- **自定义泛型 `@ApiEnvelope(X)` 合并装饰器**：自制 Swagger 抽象、评审成本高于直白模型。T027 再评估后否决得更彻底——官方 CLI 插件 + 文档生成后统一包裹连逐接口装饰器都不需要，泛型抽象更无存在必要（R5）。
- **Swagger 运行时从 `design:returntype` 反射推断 data 类型**：无注解时 @nestjs/swagger 只产出空描述响应（已读 explorer 源码证实），且运行时反射无法解包 `Promise<T>`/数组泛型，接口/内联类型也拿不到。否决，改用官方 CLI 插件在编译期注入。
- **只在 nest build/start 链路用插件、E2E 不挂**：ts-jest 不经 nest-cli，文档源 E2E 会退化成无 data 模型，测试与生产不一致。否决，E2E 经 ts-jest transformer 挂同一插件。
- **探活也套外壳**：Terminus 监控/探针与 K8s 期望原生结构，ready 503 须原样；包裹即破坏探针契约。否决。
- **类级 @ApiResponse 全局挂全套错误码**：原以「假契约」否决；决策 13（T028）在用户明确接受精度权衡后改用文档后处理全局注入全套 4xx，换取控制器零样板——真实验证以 E2E 实际状态码为准，文档枚举仅作参考。
- **让 Swagger 从守卫运行时抛出的异常自动派生错误文档**：文档在启动期由装饰器元数据构建，守卫在请求期才执行，Swagger 无法观测其抛错。否决；改为组合装饰器把守卫与其错误文档静态绑定（`@AuthOnly`/`@AdminOnly`，决策 9）。

## 后果

### 正面

- 所有业务接口形状单一可预测：成功读 `data`、失败读 `code/message`，前端处理逻辑收敛。
- 业务代码零感知：新增接口自动获得外壳，无须逐接口约定。
- 顺带修正 ready 503 被过滤器改写的既有偏差，探活链路对监控恢复为 Terminus 原生契约；豁免纯函数两处共用，杜绝判定漂移。
- 文档源与真实契约一致，E2E 哨兵可机器核对外壳 schema 与旧模型零引用。
- 无 DB/缓存/Schema 变更、无新依赖；回滚 = 还原拦截器注册与过滤器 body 形状。

### 负面

- 破坏性契约变更：既有前端/脚本需把成功取数改为 `body.data`、错误体不再读 `statusCode`；T027 再把外壳收敛为四字段（去 path/time、加 success），错误码 message 从 code 字符串变为中文文案。本期一次性切换，无兼容窗口（无外部消费方前提下成立）。
- Swagger 成功响应零样板：新接口只需写对 controller 返回类型（data 模型用 class，不用 interface），插件推断 + 统一包裹自动产出文档；约束是返回类型必须可被插件解析（class / 内联对象 / 数组，不能是纯 interface 或 any）。
- T029 起所有成功响应统一 200（含创建接口）；调用方不需再按 201 区分创建。错误仍使用 400/401/403/404/409，未知服务器异常使用 500。
- 错误文档精度换样板（T028，用户拍板）：每个接口文档都列出全套 400/401/403/404/409，含运行时不会返回的码；接口级特化文案（如 409 的具体业务含义）不再展示。真实状态码以 E2E 为准，Swagger 错误枚举不反映逐接口差异。

### 中性

- 错误码字面量仍散落各 service/guard 抛出点（10 个），本期已把**文案**集中到 `ERROR_CODES`；code 常量本身的常量化留待独立重构（R8）。

## 回滚

≤5 分钟：从 `main.ts`/`e2e-app.ts` 移除拦截器注册，过滤器 body 还原 `{code,message,statusCode}`，删除 `src/common/response/`，移除 nest-cli.json 插件与 `wrapSuccessEnvelope` 调用，controller 注解还原。无数据迁移。

## 重新评估条件

- 出现真实外部消费方后再有外壳级变更 → 必须走版本化/双写，不能再一次性切换。
- controller 返回类型出现插件无法解析的形态（联合类型/泛型接口/第三方类）→ 在 `wrapSuccessEnvelope` 增加特例映射，而非回退到逐接口注解。
- 错误码开始跨服务共享 → 启动错误码常量化/错误码注册表重构（R8）。

## 相关文档

- 规格：[specs/005-unified-response/spec.md](../../specs/005-unified-response/spec.md)
- 研究：[research.md](../../specs/005-unified-response/research.md)（R1–R10）
- 契约：[api-contract.md](../../specs/005-unified-response/contracts/api-contract.md)
- 上游：[ADR-005 在线接口文档](./ADR-005-swagger-api-docs.md)（本文档替换其错误体形状描述）、[ADR-003 Redis 缓存基线](./ADR-003-redis-cache.md)（健康探针豁免动机）
- 宪法原则：`.specify/memory/constitution.md` I / II / III

## 更新记录

- 2026-10-26 @dev-agent + AI：初始版本（Pending），随 005-unified-response T020 产出；T001–T019 完成（单测全绿、E2E 7 套件 47 项全绿），待人工评审。
- 2026-10-26 @dev-agent + AI：T025 追加 `ApiErrorResponses` 工厂（决策 8）；T026 追加 `@AuthOnly`/`@AdminOnly` 守卫组合装饰器（决策 9），单测 27 套件 194、E2E 7 套件 48 全绿。
- 2026-10-26 @dev-agent + AI：T027 外壳对齐 `@nestarc/safe-response`——收敛为四字段 `{success,code,message,data}`（决策 1/2/5 改写，去 path/time）；错误码文案集中 `ERROR_CODES`（决策 11）；Swagger 成功响应免逐接口注解（CLI 插件 + `wrapSuccessEnvelope`，决策 12），删除 5 个 Envelope 子类与 9 个成功 `@ApiResponse`。lint 0、单测 28 套件 207、E2E 7 套件 48、build:local 0，3000 冒烟通过。
- 2026-10-26 @dev-agent + AI：T028 状态码与错误响应进一步全局化（决策 13）——删除全部 `@HttpCode`（运行时由拦截器按路由约定 `resolveSuccessStatus` 推断，POST 资源根 201 / 其余 200）与 `@ApiErrorResponses`（文档后处理统一注入全套 400/401/403/404/409），决策 8 废弃、9 收敛；删除 response-schemas。lint 0、单测 28 套件 227、E2E 7 套件 48 全绿。
- 2026-10-26 @dev-agent + AI：T029 成功状态码统一 200（决策 14）——注册不再返回 201；删除恒值 helper `resolveSuccessStatus`，运行时与 Swagger 归一直接使用 `HttpStatus.OK`；错误状态码保持 400/401/403/404/409，未知服务器异常 500。
- 2026-10-26 @dev-agent + AI：T030 外壳 `code` 改数字且恒等于 HTTP 状态码（决策 15）——`SUCCESS_CODE` 由 `'SUCCESS'` 改为 `HttpStatus.OK`(200)，过滤器对外 `code` 输出数字 status，10 个字符串码降为内部异常键；异常抛出位置/类型/HTTP 状态行/message 全保留。lint 0、单测 27 套件 222、E2E 7 套件 48、build:local 0。
- 2026-10-26 @dev-agent + AI：T031 锁定 CRUD `data` 五形态（决策 16，规划层修订，代码待 TDD 执行）——列表游标 `{items,nextCursor}` 改页码 `{total,list,page,pageTotal,index}`（index 从 1 起）、删除 `{id}` 改 `null`、只读单查不存在 404 改 200/null（写操作仍 404）；spec FR-016/017/018、SC-008/009/010、contract、data-model §6、tasks Phase 8、001 契约、coding-style §1.4 同步。纯文档修订，未改生产代码。
