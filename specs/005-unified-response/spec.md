# 功能规格说明：全局统一响应外壳（Unified API Response Envelope）

**功能分支**：`005-unified-response`

**创建日期**：2026-10-26

**状态**：Draft

> **T027 修订（2026-10-26，用户追加，权威）**：外壳最终为**四字段** `{success,code,message,data}`（对齐 `@nestarc/safe-response`，去 `path`/`time`，成功 `success:true`、失败 `success:false`，data 支持 null/[]/{}）；错误文案集中 `ERROR_CODES`；Swagger 成功响应免逐接口注解（CLI 插件 + `wrapSuccessEnvelope`）。下文 US/FR 中所有「五字段 code/data/message/path/time」描述与 logout `data:{success:true}` 均以本条与 `contracts/api-contract.md`、ADR-006 决策 11/12 为准；历史规划文本保留不改写。
>
> **T031 修订（2026-10-26，用户追加，权威）——CRUD 五类操作的 `data` 形态锁定**：统一外壳的 `data` 业务载荷按操作类型固定为五种形态，适用于当前全部业务接口及后续新增模块：
>
> 1. **分页列表**：`data = { total, list, page, pageTotal, index }`。`total:number` 总条数；`list:T[]` 当前页数据；`page:number` 当前页码（从 1 起）；`pageTotal:number` 总页数（`ceil(total/pageSize)`，无数据时为 0）；`index:number` 本页首条数据的**全局序号，从 1 起算**，`index=(page-1)*pageSize+1`（首页 1，第 2 页=pageSize+1）。请求参数由游标改为页码：`page`（缺省 1）+ `pageSize`（缺省 20、封顶 50）。
> 2. **删除**：`data = null`（删除成功不回传 id/布尔，成功语义由顶层 `success:true` 承载）。
> 3. **更新**：`data =` 更新后的完整对象（脱敏形态）。
> 4. **新增**：`data =` 新建对象（脱敏形态）。
> 5. **单个查询（只读）**：`data =` 单条对象；资源不存在（含已软删）时返回 **HTTP 200 + `data:null`**，「查不到」是合法空结果而非错误。
>
> **404 语义随之收窄**：只读单个查询（`GET /users/detail`）不再抛 404，不存在即 200/null；写操作（`POST /users/admin`、`POST /users/delete`）目标不存在仍抛 404（非法 id 仍 400）。`GET /users` 列表由游标分页 `{items,nextCursor}` 改为上述页码分页结构；`POST /users/delete` 的 `data` 由 `{id}` 改为 `null`。本条修订改变现有用户模块实现与 001/005 契约，执行任务见 tasks.md Phase 8（T031）。
>
> **T030 修订（2026-10-26，用户追加，权威）**：统一外壳的 `code` 字段改为**数字业务码，取值恒等于本次响应的 HTTP 状态码**。成功 `code=200`（不再是字符串 `SUCCESS`）；失败 `code` 即 HTTP 错误状态（`400/401/403/404/409/500`）。服务异常本身全部保留——抛出位置、异常类型、HTTP 状态行、`message` 文案与鉴权/校验行为不变；原 10 个字符串码（`VALIDATION_ERROR` 等）降级为 Service/Guard 与 `ERROR_CATALOG` 的**内部异常键**，不再原样出现在响应外壳。同一状态码的多个细分原因（400/409）仅由 `message` 区分。外壳字段集仍为四字段 `{success,code,message,data}`，`code` 类型由 `string` 改为 `number`。本条取代 FR-002 中「`SUCCESS` 字符串」与 FR-006 中「外壳 code 承载字符串业务码、不得合并」的描述；字段集合与豁免规则仍以 `contracts/api-contract.md` 为准。
>
> **T029 修订（2026-10-26，用户追加，权威）**：所有业务接口只要成功，HTTP 状态行统一为 `200`，包括 `POST /users` 注册（不再返回 201）；错误状态码保持语义化（400/401/403/404/409），未知服务器异常仍由过滤器兜底为 500。成功体仍为四字段，`code` 固定 `SUCCESS`；错误体仍为四字段，`data:null`。
>
> **T028 修订（2026-10-26，用户追加，权威）**：在 T027 基础上进一步删除全部 `@HttpCode` 与 `@ApiErrorResponses`，控制器对响应**零方法注解**。错误响应由 `wrapSuccessEnvelope` 对每个业务操作统一注入全套 `400/401/403/404/409`（通用文案）。错误文档枚举放宽为全套（不再逐接口收窄），真实返回哪些错误码以 E2E 为准——此精度权衡经用户明确接受（ADR-006 决策 13、`contracts/api-contract.md` §5）。

**输入**：用户描述："请统一全局的 UnauthorizedException，使用统一的工具类，toUserResponse，如使用 code、data、message、path、time 等统一处理，还有 ApiResponse，所有接口统一化"

## 澄清记录

### 会话 2026-10-26

- Q: 成功响应外壳字段？ → A: `{ code, data, message, path, time }`；`code` 为业务码字符串，成功固定 `SUCCESS`，`message` 成功固定 `ok`，业务数据放 `data`。
- Q: 错误响应是否保留 HTTP 状态码字段与额外 error 字段？ → A: 不保留 `statusCode`、不新增 `error` 字段；错误体与成功体外壳一致并扁平化：`{ success:false, code, message, data:null }`。HTTP 状态码仍在响应行；T029 起业务成功统一 200（含创建），错误语义化返回 400/401/403/404/409/500。
- Q: 健康检查端点与 Swagger 文档如何处理？ → A: `/health/live`、`/health/ready` 不包裹，保持 Terminus/探针原生 JSON（监控与 K8s 探针无需感知外壳）；Swagger 文档中全部业务接口的成功/失败响应模型同步改为新外壳。
- Q: 根路径 `GET /`（纯文本欢迎语）是否包裹？ → A: 不包裹。它与 health 同属基础设施探活性质（infra 分组），返回 Express 默认 `text/html` 类型的纯文本；统一外壳只作用于 JSON 业务接口（auth、users 共 9 个）。
- Q: `toUserResponse` 是否改为通用响应工具？ → A: 不合并。`toUserResponse` 是 user 域的脱敏映射器（Mongoose 文档 → 6 字段公开视图），职责不变；统一外壳由新的横切工具承载，二者正交：拦截器把 `toUserResponse` 的产出放进 `data`。
- Q: 本期是否做 API 版本化或双写兼容？ → A: 本项目无已发布外部消费方（模板阶段，仅 local/uat），经人工确认采用一次性切换，不做 v1/v2 双外壳并存；破坏性变更在 ADR-006 登记，回滚 = 还原代码（≤5 分钟）。

## 用户场景与测试 _(强制)_

### 用户故事 1 - 所有业务接口返回结构一致的成功响应（优先级：P1）

前端、测试与外部调用方调用任一业务接口（auth、users 共 9 个）成功时，拿到结构完全一致的 JSON：固定五字段 `code`、`data`、`message`、`path`、`time`；真正的业务数据（用户视图、登录结果、分页列表、登出结果、删除结果）统一放在 `data` 内；调用方只需一套解析逻辑，不必为每个接口记忆不同的顶层形状。

**为何此优先级**：成功体统一是本功能的核心交付，没有它其余工作无意义。

**独立测试**：local 启动后注册一个用户、登录、查看本人资料、登出，逐一确认四个响应顶层都是相同五字段，业务数据在 `data` 内，`code` 均为 `SUCCESS`、`message` 均为 `ok`。

**验收场景**：

1. **假设** 调用 `POST /users` 注册成功，**当** 服务返回 200，**那么** 响应体为四字段 `{ success:true, code:'SUCCESS', message:'ok', data:{ id, username, email, isAdmin, createdAt, updatedAt } }`，用户字段不提升到顶层，且不含 password 等内部字段。
2. **假设** 调用 `POST /auth/login` 登录成功，**当** 服务返回 200，**那么** `data` 为 `{ token, expiresAt, user }`，顶层 `code/message/path/time` 与其他接口一致。
3. **假设** 调用 `GET /users`（管理员）成功，**当** 服务返回 200，**那么** `data` 为页码分页结构 `{ total, list:[...], page, pageTotal, index }`（T031；旧 `{items,nextCursor}` 游标形态废止）。
4. **假设** 调用 `POST /auth/logout` 成功，**当** 服务返回 200，**那么** `data` 为 `null`（T027 起登出无数据；T031 起删除接口同样返回 `null`）。
5. **假设** 任意成功响应，**当** 检查 `path` 与 `time`，**那么** `path` 等于本次请求路径（不含 query string），`time` 为合法 ISO 8601 时间字符串。
6. **假设** 注册与登录成功，**当** 比对 HTTP 状态行，**那么** 所有成功接口均为 200；错误仍按 4xx/5xx 返回。

---

### 用户故事 2 - 所有错误响应与成功体共用同一外壳（优先级：P1）

调用方在参数错误、未认证、权限不足、资源不存在、业务冲突、服务器错误时，拿到与成功体形状一致的 JSON：同样是 `code/data/message/path/time` 五字段，只是 `data` 恒为 `null`、`code` 为具体业务错误码（如 `VALIDATION_ERROR`、`UNAUTHENTICATED`、`INVALID_CREDENTIALS`、`FORBIDDEN`、`USER_NOT_FOUND`、`USERNAME_EXISTS`、`EMAIL_EXISTS`、`LAST_ADMIN_PROTECTED`、`INVALID_ID`、`INTERNAL_ERROR`）；旧的顶层 `statusCode` 字段移除。调用方可用同一套「看 code、取 message、读 path/time 排障」逻辑处理成败两类响应。

**为何此优先级**：错误体不统一则「统一响应」只完成一半，现有 `{ code, message, statusCode }` 与新成功体并存反而造成两种形状。

**独立测试**：对登录、注册、管理员接口分别制造错误（错误密码、缺字段、普通用户访问管理员接口、重复用户名），确认错误体五字段形状一致、`data:null`、无 `statusCode` 字段、无堆栈与内部路径。

**验收场景**：

1. **假设** 请求体校验失败（如密码长度不足），**当** 服务返回 400，**那么** 响应体为 `{ code:'VALIDATION_ERROR', data:null, message:<字段错误字符串数组>, path:<请求路径>, time:<ISO> }`。
2. **假设** 未带令牌访问 `GET /users/me`，**当** 全局 AuthGuard 拒绝，**那么** 返回 401 与 `{ code:'UNAUTHENTICATED', data:null, message, path, time }`；所有抛出 `UnauthorizedException` 的位置（AuthGuard、RolesGuard、AuthService）错误码维持各自现值，只统一外壳。
3. **假设** 普通用户访问管理员接口，**当** RolesGuard 拒绝，**那么** 返回 403 与 `code:'FORBIDDEN'` 的统一错误体。
4. **假设** 制造重复邮箱/用户名、删除最后一个管理员，**当** 服务分别返回 409，**那么** 错误体形状仍为统一外壳，业务 code 分别为 `EMAIL_EXISTS`/`USERNAME_EXISTS`、`LAST_ADMIN_PROTECTED`；**只读单查**不存在用户（`GET /users/detail`）按 T031 改为 200 + `data:null`（不再走本错误场景），写操作（admin/delete）目标不存在仍为 404 `USER_NOT_FOUND`。
5. **假设** 传入非法 ObjectId，**当** Mongoose CastError 被归一，**那么** 返回 400 与 `code:'INVALID_ID'` 的统一错误体。
6. **假设** 发生未预期服务器错误，**当** 过滤器兜底，**那么** 返回 500 与 `code:'INTERNAL_ERROR'`、`message:'internal server error'`，响应体不含堆栈、连接串、内部文件路径；详细错误只进服务端日志。
7. **假设** 检查任一错误响应，**那么** 顶层不存在 `statusCode` 字段、不存在 `error` 字段；HTTP 状态码只存在于响应行。

---

### 用户故事 3 - 探针与文档保持可用、文档与真实契约一致（优先级：P2）

运维与监控依赖的 `/`（纯文本）、`/health/live`、`/health/ready` 不被外壳影响：K8s/探针与监控系统继续按原格式解析，不必为统一外壳改造探针逻辑。同时 Swagger 在线文档中每个业务接口的 200 成功模型与各错误模型都呈现新外壳，前端可直接按文档解析。

**为何此优先级**：探针不回归是上线安全前提；文档同步防止新外壳造成契约漂移。列 P2 是因为依赖 US1/US2 先定型。

**独立测试**：请求 `/health/live` 得 `{ status:'up' }` 原样、`/health/ready` 得 Terminus 原结构、`GET /` 仍为 `Hello World!` 纯文本；打开 `/api-docs` 确认登录接口成功模型外层是五字段、`data` 内是 token/user。

**验收场景**：

1. **假设** 请求 `GET /health/live`，**当** 服务正常，**那么** 返回 200 与 `{ status:'up' }`，无 `code/data/message` 外壳。
2. **假设** 请求 `GET /health/ready`，**当** Mongo 与 Redis 正常，**那么** 返回 Terminus 原生结构（含 `status:'ok'` 与 `info/error` 等），不被包裹；依赖故障时仍为 Terminus 原生 503。
3. **假设** 请求 `GET /`，**当** 服务正常，**那么** 返回 200 与 Express 默认 Content-Type（`text/html; charset=utf-8`）的 `Hello World!` 纯文本。
4. **假设** 在 local 打开 `/api-docs`，**当** 查看任一业务接口，**那么** 成功响应模型顶层为统一四字段外壳且 `data` 指向该接口真实数据模型；错误响应模型为统一四字段外壳且 `data:null`；文档中不再出现旧的顶层 `statusCode` 错误模型。
5. **假设** Swagger 在 production 关闭（沿用 004 行为），**当** 访问 `/api-docs`，**那么** 仍为 404，本功能不改变该行为。

---

### 边界场景

- 统一外壳只作用于业务 JSON 接口；判定「不包裹」必须按路径前缀/路由特征显式排除 `/`、`/health`，不能依赖响应内容猜测（流式/字符串响应可能误判）。
- 抛出位置不同（守卫、管道、服务、过滤器兜底）的异常必须产出形状一致的错误体；全局过滤器是错误外壳唯一产出点，业务代码不手写外壳。
- `path` 取请求路径（Express `req.path`，不含 query string）；`time` 取过滤器/拦截器处理时刻的 ISO 8601 字符串（成功为响应封装时刻，错误为异常处理时刻），不要求二者时钟跨服务对齐。
- 成功 `code` 只有一个取值 `SUCCESS`；禁止各接口自定义成功码。业务错误码集合维持现状，不在本期新增/重命名（重命名属另一变更）。
- 304/重定向/文件下载等非 JSON 响应本期不存在；统一拦截器只处理正常 JSON 返回与经过滤器归一的错误，不为未出现的响应类型提前抽象（YAGNI）。
- 访问日志拦截器行为（requestId、`x-request-id`、耗时、不打 body）不变；新增的响应封装不得记录或泄露敏感字段，`data` 中的脱敏仍由 `toUserResponse` 等域映射器负责，统一外壳不做字段过滤。
- 既有 E2E 断言（约 60+ 处直接读 `res.body.<字段>` 与 `res.body.code`）与测试登录助手需同步迁移到 `data` 层；这是契约变更的必要部分，不允许通过保留旧字段「兼容测试」。

## 需求 _(强制)_

### 功能需求

- **FR-001**：系统 MUST 通过一个全局响应拦截器，把所有业务 JSON 接口（auth、users 共 9 个）的成功返回统一包裹为 `{ code, data, message, path, time }`；业务方法原始返回值 MUST 原样放入 `data`，不做字段增删。
- **FR-002**：成功外壳的 `code` MUST 恒为数字 `200`（等于 HTTP 成功状态），`message` MUST 恒为字符串 `ok`；二者 MUST 由统一工具产出常量，禁止散落在业务代码中硬编码。
- **FR-003**：成功外壳的 `path` MUST 为本次请求路径（不含 query string），`time` MUST 为响应封装时刻的 ISO 8601 字符串；两字段 MUST 由拦截器从请求上下文/系统时钟取得，业务 Controller/Service MUST NOT 自行提供。
- **FR-004**：统一封装 MUST 将所有业务成功响应的 HTTP 状态码设置为 200（包括创建资源；不再使用 201）；错误 HTTP 状态码保持 400/401/403/404/409/500 语义。
- **FR-005**：系统 MUST 把全局异常过滤器的错误体改为与成功体同形状的 `{ code, data, message, path, time }`，其中 `data` MUST 恒为 `null`；MUST NOT 再输出顶层 `statusCode` 字段，MUST NOT 新增 `error` 字段。
- **FR-006**（T030 修订）：错误外壳的 `code` MUST 为数字，且 MUST 等于本次响应的 HTTP 状态码（`400/401/403/404/409/500`）。原有 10 个字符串标识——`VALIDATION_ERROR`、`INVALID_ID`、`UNAUTHENTICATED`、`INVALID_CREDENTIALS`、`FORBIDDEN`、`USER_NOT_FOUND`、`USERNAME_EXISTS`、`EMAIL_EXISTS`、`LAST_ADMIN_PROTECTED`、`INTERNAL_ERROR`——MUST 继续作为 Service/Guard 抛出值与 `ERROR_CATALOG` 的内部异常键存在，其抛出位置、异常类型与 HTTP 状态映射 MUST NOT 改变；但这些字符串 MUST NOT 再原样出现在响应外壳的 `code` 中。同一 HTTP 状态的多个细分原因由 `message` 区分。
- **FR-007**：错误外壳的 `message` MUST 维持现有语义：参数校验失败为字段错误字符串数组，其余为字符串；`path`/`time` 规则与成功体一致（错误处理时刻）。
- **FR-008**：错误响应 MUST 继续遵守安全约束：500 不向客户端回传堆栈/连接串/内部路径，细节只进服务端结构化日志；统一化 MUST NOT 扩大错误信息暴露面。
- **FR-009**：系统 MUST 对 `GET /`、`/health/live`、`/health/ready` 排除统一封装：根路径保持纯文本 `Hello World!`；两个健康端点保持各自现有 JSON（`{status:'up'}` 与 Terminus 结果）与状态码（ready 失败 503）。排除规则 MUST 显式可测，MUST NOT 依赖响应内容类型猜测。
- **FR-010**：统一封装 MUST 以横切方式实现（全局拦截器 + 改造全局过滤器），Controller/Service 中 MUST NOT 出现手工构造外壳的代码；域映射器（如 `toUserResponse`）保持现状并继续负责脱敏，MUST NOT 被改成通用响应工具。
- **FR-011**：`src/main.ts` 与 `test/helpers/e2e-app.ts` 两个装配点 MUST 注册同一套全局拦截器与过滤器，禁止两处行为漂移。
- **FR-012**：Swagger 文档 MUST 同步：9 个业务接口的每个成功响应模型 MUST 呈现统一五字段外壳（`data` 引用该接口既有数据模型），错误响应模型 MUST 改为统一五字段（`data:null`）；文档中 MUST NOT 再引用含顶层 `statusCode` 的旧错误模型。
- **FR-013**：全部既有单元测试与 E2E MUST 迁移并通过：成功断言改读 `body.data`，错误断言读 `body.code` 并断言无 `statusCode`、`data===null`；测试登录助手 MUST 从 `data.token` 取令牌；MUST NOT 通过保留旧字段让旧断言通过。
- **FR-014**：本功能 MUST NOT 引入新的第三方运行时依赖；MUST NOT 变更数据库 Schema/索引、缓存键、鉴权判定与 `x-request-id`/访问日志行为。
- **FR-015**：统一外壳类型与常量（成功码 `200`、成功消息、外壳字段结构，`code:number`）MUST 以显式 TypeScript 类型/class 表达，禁止 `any`。
- **FR-016**（T031 修订）：分页列表接口的成功 `data` MUST 恰为 `{ total:number, list:T[], page:number, pageTotal:number, index:number }` 五字段：`total` 为符合条件的总条数（软删场景只计 `deletedAt:null`）；`list` 为当前页数据（条数 ≤ `pageSize`，越界页为 `[]`）；`page` 为当前页码（从 1 起，缺省 1）；`pageTotal = ceil(total/pageSize)`（`total===0` 时为 `0`）；`index=(page-1)*pageSize+1` 为本页首条数据的全局序号（从 1 起，越界页仍按公式给出序号值）。分页入参 MUST 为 `page`（正整数，缺省 1）与 `pageSize`（正整数，缺省 20、上限 50，超限截断）；MUST NOT 再使用 `cursor`/`limit`/`nextCursor` 游标形态。
- **FR-017**（T031 修订）：写操作成功 `data` 形态 MUST 固定——创建返回新建对象（脱敏视图）；更新返回更新后的完整对象（脱敏视图）；删除返回 `null`（不回传 id/布尔/受影响行数，成功语义由顶层 `success:true` 承载）。
- **FR-018**（T031 修订）：只读单个查询在资源不存在（含已软删）时 MUST 返回 HTTP `200` 与 `data:null`，MUST NOT 抛 404；非法 ID 仍为 400。写操作（更新/删除/动作）目标资源不存在时 MUST 仍抛 404。

### 关键实体 _(涉及数据时包含)_

无持久化实体。涉及的内存期响应结构：

- **统一响应外壳（ApiResponse Envelope）**：每个业务 JSON 响应的顶层结构。属性：`code:number`（成功 `200`，错误为对应 HTTP 状态数字）、`data:T|null`（成功为业务返回值，错误恒为 `null`）、`message:string|string[]`（成功 `'ok'`，校验错误为数组，其余错误为字符串）。
- **成功码常量（Success Code）**：唯一成功业务码 `200` 与成功消息 `ok`，由横切工具导出。
- **分页结果（PageResult，T031）**：分页列表 `data` 的固定结构 `{ total:number, list:T[], page:number, pageTotal:number, index:number }`，字段语义见 FR-016。
- **豁免路径（Excluded Routes）**：不套外壳的基础设施路由集合：`GET /`、`/health/live`、`/health/ready`。

## 成功标准 _(强制)_

### 可衡量结果

- **SC-001**：9 个业务接口成功响应 100% 为统一四字段外壳，业务数据 100% 位于 `data` 内，且 `code` 100% 为数字 `200`（E2E 逐接口断言）。
- **SC-002**：各失败场景下外壳 `code` 100% 等于其 HTTP 状态数字（400/401/403/404/409/500），且 0 个响应含顶层 `statusCode`、0 个响应外壳 `code` 为字符串；500 响应 0 处泄露堆栈/内部路径（单测 + E2E）。
- **SC-003**：`/`、`/health/live`、`/health/ready` 三个豁免路径响应与上线前逐字节一致（纯文本 / `{status:'up'}` / Terminus 结构），E2E 覆盖。
- **SC-004**：`pnpm lint`、`pnpm test`、`pnpm test:e2e` 退出码均为 0；迁移后测试断言全部针对新外壳，无残留 `body.statusCode` 与「成功字段在顶层」的旧断言（grep 0 命中）。
- **SC-005**：Swagger 文档源（`/api-docs-json`）中 9 个业务接口成功 schema 100% 含统一四字段外壳、错误 schema 100% 为 `data:null` 的统一外壳，旧错误模型引用数为 0。
- **SC-006**：新增第三方运行时依赖数为 0；数据库/缓存/鉴权相关代码改动文件数为 0。
- **SC-007**：手工冒烟（注册 200 → 登录 200 → 本人 200 → 登出 200，叠加 400/401/403/404/409/500 错误）100% 符合 FR-001 ～ FR-009。
- **SC-008**（T031）：`GET /users` 成功 `data` 恰为 `{total,list,page,pageTotal,index}` 五字段且类型正确；首页（pageSize=20）`index===1`、第二页 `index===21`、空结果 `total===0`/`list===[]`/`pageTotal===0`；响应与文档源中 0 处残留 `items`/`nextCursor`/`cursor`（E2E + grep）。
- **SC-009**（T031）：`POST /users/delete` 成功 HTTP 200 且 `data===null`；创建（`POST /users`）与更新（`POST /users/me`、`POST /users/admin`）成功 `data` 为对应完整对象（E2E 断言）。
- **SC-010**（T031）：`GET /users/detail?id=<不存在或已软删>` 返回 200 + `data:null`（0 个 404）；非法 id 仍 400；`POST /users/admin`、`POST /users/delete` 目标不存在仍 404（E2E 断言）。

## 假设

- 当前仅 auth、users 两类业务模块共 9 个业务 JSON 接口；新增模块在本功能后自动经全局拦截器获得统一外壳，无需逐接口接入。
- 项目无已发布的外部 API 消费方（初始化模板阶段），人工已确认接受一次性破坏性切换，不做版本双写；若未来出现外部消费方，API 版本化按宪法原则 V 另行立项。
- 成功 HTTP 状态码统一为 200；错误仍保留语义化 HTTP 状态码，不采用「HTTP 恒 200、成败只看 code」模式。
- `path`/`time` 仅用于调用方排障与日志关联，不承担幂等键/去重职责，故无需时钟单调或跨节点一致保证。
- 全局拦截器与过滤器的注册沿用现有 `main.ts` + `e2e-app.ts` 双装配点模式（与 002/003/004 一致）；不改造为 DI `APP_INTERCEPTOR/APP_FILTER` 属本期范围外的结构调整（YAGNI）。
- Swagger 泛型外壳通过显式响应模型类表达（`@nestjs/swagger` 无运行时泛型），具体形态在 plan/research 确定。
- 健康检查 Terminus 自身错误（503）不经业务外壳：其由 Terminus 中间件/控制器直接产出，豁免路径规则同样覆盖。

## 关联文档

- 架构决策：ADR-006（待建）——全局统一响应外壳与错误体归一（字段集、豁免路径、破坏性切换说明）
- 实现设计：统一响应外壳设计文档（待建，plan 阶段产出 research/contracts）
- 上游依赖：[ADR-002 用户模块](../../docs/architecture/adr/ADR-002-user-module.md)、[ADR-004 不透明令牌与会话](../../docs/architecture/adr/ADR-004-opaque-token-redis-session.md)、[ADR-005 Swagger 文档](../../docs/architecture/adr/ADR-005-swagger-api-docs.md)
- 关联功能：[001 用户模块规格](../001-user-module/spec.md)、[003 登录鉴权规格](../003-user-login/spec.md)、[004 Swagger 文档规格](../004-swagger-docs/spec.md)（被本功能变更响应契约，文档需同步）

> 关联约定：本规格只回答 WHAT/WHY，不含实现细节；ADR 记录关键取舍，plan/research/contracts 展开 HOW。FR-/SC- 编号双向追溯；规格变更时同步评审 ADR/contracts 是否失效。
