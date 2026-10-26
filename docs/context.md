# 项目上下文

> 跨会话动态项目记忆，抵抗 AI 上下文丢失。每次重要会话结束前更新。
> 稳定规则不在此复制：硬性规则见 [../AGENTS.md](../AGENTS.md)，编码规范见 [development/coding-style.md](./development/coding-style.md)，架构决策见 [architecture/adr/](./architecture/README.md#adr-索引)，文档入口见 [index.md](./index.md)。
> 最后更新：2026-10-26 22:10（@dev + AI，005 Phase 8 / T031 代码执行完成：CRUD `data` 五形态落地——页码分页 `{total,list,page,pageTotal,index}`、删除/只读空结果 null、只读 detail 不存在 200+null；全量门禁 lint 0 / 单测 27 套件 231 / E2E 7 套件 50 / build 0；EVO-20261026003 applied；待编排方置 handoff complete + PR）

## 1. 当前状态

- 当前阶段：用户模块（`specs/001-user-module`）已 Confirmed；Redis 缓存基础设施（`specs/002-redis-integration`）已 Confirmed、handoff complete；用户登录鉴权（`specs/003-user-login`）T001–T036 全部完成、handoff complete；Swagger 接口文档（`specs/004-swagger-docs`）T001–T030 全部完成，handoff `complete`；全局统一响应外壳（`specs/005-unified-response`）T001–T031 全部完成（T031 CRUD data 五形态；handoff 仍 `executing`，执行方不自行置 complete），剩编排方置 complete + PR
- 主干健康：本会话实测 `pnpm lint` 退出 0（零 warning）、`pnpm test` 27 suites / 231 tests 通过、`pnpm test:e2e` 7 suites / 50 tests 通过（真实本地 mongod + redis，测试库 `ai_blog_test`）、`pnpm build:local` 退出 0；所有业务成功响应（含注册）统一 HTTP 200，外壳 `code` 为数字且与状态行一致
- 阻塞项：无
- 风险：
  - E2E 依赖本地 redis-server 在运行；沙箱内 loopback 被拦时需在沙箱外执行 `pnpm test:e2e`。
  - 访问日志只有请求级 requestId 关联，无跨服务 TraceContext 传播、无指标导出（宪法原则 V 延后项，见 §4 待决）。
  - 本地 mongod 为单节点非副本集，事务/change streams 不可验证（设计 §5.6）。
  - E2E 固定 `--runInBand`（package.json）：多个 AppModule 并行 bootstrap 会把本地 Mongo 连接打满；CI 若换测试容器可再评估并行。

## 2. 进行中工作

### 全局统一响应外壳 005（T001–T031 全部完成，handoff executing 待编排方置 complete；待 PR）

- 依据：[spec](../specs/005-unified-response/spec.md)、[plan](../specs/005-unified-response/plan.md)、[tasks](../specs/005-unified-response/tasks.md)、research/contracts/quickstart、[ADR-006](./architecture/adr/ADR-006-unified-response-envelope.md)（Pending，决策 15）
- 范围（T030 后最终形态）：成功体全局 map 拦截器包**四字段** `{success:true,code:200,message:'ok',data}`；错误过滤器产出 `{success:false,code,message,data:null}`，**外壳 `code` 为数字且恒等于本次响应 HTTP 状态码**（成功 200，失败 400/401/403/404/409/500），同状态细分原因只靠 `message` 区分；服务异常的抛出位置、异常类型、HTTP 状态行、鉴权/校验行为全部保留，原 10 个字符串码（`VALIDATION_ERROR`/`UNAUTHENTICATED` 等）降级为 Service/Guard 抛出值与 `ERROR_CATALOG` 的内部异常键，不再出现在响应体（错误配置单一来源：内部键 →`{status,message,docLabel?}`，运行时 `ERROR_CODES` 与 Swagger 状态集合/描述均派生）；`GET /` 与 `/health/*` 豁免（`isEnvelopeExcludedPath` 拦截器/过滤器/wrap 三处共用）；data 原样支持 null/[]/{}/对象。**控制器对响应零方法注解**：成功 data 由 swagger CLI 插件按返回类型推断（nest-cli.json + E2E test/ts-jest.transformers.js 双链路），`wrapSuccessEnvelope` createDocument 后 allOf 包 SuccessEnvelope（code schema number）；错误响应由 wrap 统一注入全套 400/401/403/404/409（$ref ErrorEnvelope、通用文案），文档枚举不逐接口收窄（用户明确接受的精度权衡，真实码以 E2E 为准）。
- 状态：T001–T030 全部勾选；分支 `feat/005-unified-response`（从 004 收尾点 da5cd9d 切出）；改动尚未提交（工作树）
- 验证（T030 最终）：lint 0；单测 27 套件 222 项（constants `SUCCESS_CODE===200`、filter 错误体数字 code、wrap 两 Envelope code:number）；E2E 7 套件 48 项（错误 code=HTTP 数字、重复用户名/邮箱同 409 靠 message 区分）；build:local 0；src/test 字符串 code 外壳断言 grep 0 命中（仅内部抛出点/catalog 键保留）。
- T030 文件：`response.constants.ts(.spec)`（`SUCCESS_CODE=HttpStatus.OK`、`ApiResponse.code:number`）、`http-exception.filter.ts(.spec)`（normalize 不再返回字符串 code、body code=数字 status）、`transform-response.interceptor.spec.ts`、`src/common/swagger/wrap-envelope.ts(.spec)`（两 Envelope code 改 number，示例 200/409）、5 个业务 E2E 套件数字断言；同步 005 spec/contract/data-model/tasks/quickstart、ADR-006 决策 15、001/003/004 契约指针、coding-style §1.4。
- 约定约束：业务成功统一 HTTP 200；客户端错误保持 400/401/403/404/409；500 仅用于未知服务器异常。
- T031（2026-10-26 用户追加，**代码已全部落地，2026-10-26 22:10 Phase 8 完成**）：锁定 CRUD `data` 五形态（ADR-006 决策 16）——① 分页列表 `{total,list,page,pageTotal,index}`，入参 `page`（缺省 1）/`pageSize`（缺省 20 封顶 50），`index=(page-1)*pageSize+1` 从 1 起，`pageTotal=ceil(total/pageSize)`（total=0 时 0），游标 `{items,nextCursor}`+`cursor/limit` 废止；② 删除 `data=null`（替换 `{id}`，delete-result.dto.ts 已删）；③ 创建/更新 `data=` 完整对象（现状满足）；④ 只读单查不存在（含软删）200+`data:null`（新增 `findByIdOrNull`，不抛 404，非法 id 仍 400），写操作 setAdmin/softDelete 目标不存在仍 404。验证：lint 0；单测 27 套件 231；E2E 7 套件 50（第二页 index=21、越界页空 list、软删 detail 200+null、重复删除 404）；build:local 0；grep 业务残留 0（仅负断言/文档源哨兵）。/evolve 产出 EVO-20261026003（CRUD data 形态与分页范式须在首个列表接口前锁定），已归并 arch-agent 清单 + 机制索引 applied。
- 坑：① 运行时无 @ApiResponse 时 swagger explorer 只产空描述（读源码证实），免注解必须走 CLI 插件，interface 无法生成 schema，故 login 返回类型为 class LoginResultResponse；② ts-jest transformer 须导出 name/version/factory；③ 无 @HttpCode 时插件对 POST 默认文档化 201，故 wrap 必须把唯一 2xx 键统一归一到 200，否则文档与运行时漂移；④ 沙箱 kill 3000 冒烟进程被拒，历史 PID 40881 需沙箱外 kill -9
- 文档：ADR-006 决策 14（成功统一 200，错误状态码语义化）；005 契约 §5、spec/plan T029 修订、tasks T029、coding-style §1.4 同步
- 剩余：`/evolve`；verification-before-completion 后由编排方置 handoff complete；提交/PR 需人工授权

### Swagger 接口文档接入 004（已收尾，handoff complete；PR 待人工授权）

- 依据：[spec](../specs/004-swagger-docs/spec.md)、[plan](../specs/004-swagger-docs/plan.md)、[tasks](../specs/004-swagger-docs/tasks.md)、research/data-model/contracts/quickstart、[ADR-005](./architecture/adr/ADR-005-swagger-api-docs.md)（Pending）
- 状态：T001–T030 全部完成（严格 TDD），分支 `feat/swagger_api_docs`（仓库无 develop，从 003 收尾点 3bc66a0 切出）；提交 bbda6cf/7227f67/e27c9e6/3b045fa/eceab92/f50ae32 + 评审修正 fc66bdd；handoff `complete`；远程分支/PR 待人工授权
- OCR 收尾评审（委托模式，范围 3bc66a0..HEAD，18 可评审文件全覆盖）：唯一发现——swagger 登出四态用例在 logout 后冗余手动 `cache.del`（logout 端点自身已删 session，会掩盖登出失效回归），已移除连带 CacheService/createHash/sessionKey 无用声明（fc66bdd）
- 已交付：`src/common/swagger/swagger.ts`（`isSwaggerEnabled` 纯函数 8 用例 + `setupSwagger` 关闭分支不 createDocument/不 setup）；main.ts 与 test/helpers/e2e-app.ts 共用唯一装配函数；6 个用户 DTO + LoginDto 全量 @ApiProperty（约束对齐 class-validator）；auth/user/infra 控制器注解（9 业务操作 + 3 infra，错误码只标真实会发生）；`response-schemas.ts`（Login/UserListPage/Logout/Delete/Error）；env `SWAGGER_ENABLED` 三环境值 + development.md env 清单/文档入口；ADR-005
- 验证：lint 0；单测 23 套件 178 项（新增 swagger 10 项）；E2E 7 套件 46 项（swagger-docs 套件 10 项：文档源路径/security/模型哨兵、四态 Bearer 调试、production 全 404 + 业务管线 401）；3100 local 冒烟与 3101 production 冒烟（NODE_ENV=production + env 覆盖本地测试资源）均通过
- 关键坑（已在测试注释/ADR 记录）：① production 404 E2E 须 `jest.isolateModules` 隔离 AppModule 的 envFilePath 闭包（setup-env 已把 NODE_ENV 锁 local）；② `@nestjs/config` 不覆盖 process.env 已有键，.env.local 的 SWAGGER_ENABLED=true 会残留，production 块须显式覆盖 false；③ @nestjs/swagger 7.4.2 express 运行时自带 swagger-ui-dist（非 swagger-ui-express）
- 新增直接生产依赖恰好 1 个（@nestjs/swagger 7.4.2，锁文件 +6 包）；零接口行为/DB/缓存变更

### 用户登录鉴权 003（已收尾，handoff complete）

- 依据：[spec](../specs/003-user-login/spec.md)、[plan](../specs/003-user-login/plan.md)、[tasks](../specs/003-user-login/tasks.md)、research/data-model/contracts/quickstart、[ADR-004](./architecture/adr/ADR-004-opaque-token-redis-session.md)（Pending）
- 范围：用户名或邮箱+密码登录、Bearer 不透明令牌 + Redis 会话（7 天）、全局 AuthGuard 每请求回查账号（软删/降权即时生效）、登出即时吊销、失败 5 次锁 15 分钟（锁定期对外统一 401 不回 423，真实原因只入日志；不存在标识不计数）；x-test-user 测试桩已删
- 状态：T001–T035 完成（严格 TDD），US1→US5→US2→US3→US4 顺序交付，6 个小步提交（41c39b7/e6f080b/14c8360/6bfda58/7328e01 + 文档 e19a0c9）；T036 `/evolve` 已产出 EVO-20261023001（applied，规则归并 4 文件）；handoff 仍 `executing`
- 已交付：`src/modules/auth/`（AuthService/AuthController/AuthGuard、LoginDto、auth.config/constants、@Public/@CurrentToken、session 类型）；UserService 只读协作口 `getAuthPrincipal` + `findLoginCredential`（执行时发现 tasks 漏列登录 $or 查询口，已补 TDD 用例）；CacheService.incrWithTtl（multi INCR+EXPIRE 原子）；AuthModule APP_GUARD 全局注册；health/root/register/login 4 处公开点；e2e-app 导出 `loginHelper/authHeader`；env `AUTH_TOKEN_TTL_SECONDS`
- 规划偏差（执行中补，待 arch 复核）：tasks T008 只规划 `getAuthPrincipal`，登录 $or 定位无跨模块协作口；为不违反「跨模块只调 export Service」，在 UserService 增补 `findLoginCredential`（返回 `{id,passwordHash,user}`）并补单测
- 无新第三方依赖（Node crypto + 既有 bcrypt，不引 passport/jwt）；无 Mongo Schema 变更
- 剩余：T036 收尾——由编排方 arch-agent 将 handoff 置 `complete`、OCR 评审并发 PR（执行方不自行置位）

### Harness 多 Agent 协作层（文档/配置，无生产代码）

- 依据：[Harness 手册](./harness/README.md)、[AGENTS.md §7.4](../AGENTS.md)、[EVO-20261022001](../.specify/memory/evolution/EVO-20261022001-接入harness多角色与进化机制.md)
- 状态：已落地待人工评审（分支 `feat/harness_agents_sdd`，未提交）；`agents/` 四角色（arch/dev/test/devops，纯后端无前端角色）、`commands.md`、`workflows/development-workflow.md`、进化机制 + 模板 + 首条 EVO、`.cursor/rules/harness-agents.mdc`、AGENTS.md §4.1 启动流程与 §7.4、docs/harness 手册
- 关键决策：不照搬 harness-sdd 模板——Mongoose 替换 TypeORM 假设、禁止 `/speckit.implement`、规则归并到既有 docs 权威源而非新建重复规范
- 剩余：人工评审；评审通过后决定是否提交/开 PR

### Redis 缓存基础设施 002（统一缓存服务 / 健康检查 / 异常可诊断）

- 依据：[spec](../specs/002-redis-integration/spec.md)、[plan](../specs/002-redis-integration/plan.md)、[tasks](../specs/002-redis-integration/tasks.md)、[集成设计](./architecture/design/redis-integration-design.md)、[ADR-003](./architecture/adr/ADR-003-redis-cache.md)
- 状态：T001–T021 全部完成（TDD），全量门禁绿，handoff 为 `complete`；OCR 评审通过（4 条意见已修复），ADR-003/集成设计/功能规格均为 Confirmed；已提交 `cbdad4a` 并推送分支 `feat/user_redis_init`
- 已交付：ioredis 单例全局模块（不导出 client）、`buildRedisOptions`（lazyConnect/离线队列关闭/线性退避重连/keyPrefix）、`CacheService`（强制正整数 TTL、JSON 往返、未命中 null、del 幂等、键非空守卫）、自定义 `RedisHealthIndicator` 并入 `/health/ready`（5s 节流、live 不触 Redis）、启动 ping fail-fast、error 日志脱敏、Redis 健康 E2E
- 剩余：开 PR 走合并评审；后续缓存业务接入

### 用户模块 001（注册 / 本人资料 / 管理员管理）

- 依据：[spec](../specs/001-user-module/spec.md)、[plan](../specs/001-user-module/plan.md)、[tasks](../specs/001-user-module/tasks.md)、[用户模块设计](./architecture/design/user-module-design.md)、[ADR-002](./architecture/adr/ADR-002-user-module.md)
- 状态：代码与测试全部完成（US1–US3 + Foundational），handoff 为 `complete`；代码评审通过，ADR-002、用户模块设计文档与功能规格均为 Confirmed
- 已交付：Schema（usernameLower/email 唯一、select:false、软删）、全局异常过滤器、访问日志拦截器、注册/本人/管理员 7 个接口、RolesGuard（认证-only + 管理员）、E2E 测试基建
- 剩余：无；后续认证模块落地时删除 `x-test-user` 测试桩（见风险与延后项）

## 3. 近期完成（滚动窗口，只留最近 5 项）

- 2026-10-26 全局统一响应外壳 005 执行收尾（T013–T023，@dev-agent + AI）：4 个业务 E2E 套件断言迁 `data`（user-register/user-profile/user-admin/auth-login），全等体比较因 `time` 逐请求不同改 `toMatchObject({code,data:null,path})` + typeof time；豁免路径补 ready 无外壳键断言；ADR-006（Pending）；001/003/004 contracts 加 005 指针、data-flows 登录段、coding-style §1.4；全量门禁 lint 0 / 单测 25 套件 189 / E2E 7 套件 47 / build 0；3000 端口 8 步手工冒烟全过。
- 2026-10-23 用户登录鉴权 003 全量 TDD 实现（T001–T033）：不透明令牌 + Redis 服务端会话（sha256 入键、7 天 TTL）、全局 AuthGuard 默认拒绝 + 每请求回查 Mongo（软删/降权即时生效）、登出即时吊销、失败 5 次锁 15 分钟统一 401；删除 x-test-user 桩全部 E2E 走真实登录；新增 CacheService.incrWithTtl、UserService.getAuthPrincipal/findLoginCredential；lint 0、单测 21 套件 168 项、E2E 6 套件 36 项全绿；ADR-004 Draft→Pending；5 个小步提交（41c39b7…7328e01），handoff 仍 executing 待 PR。
- 2026-10-15 Redis 缓存基础设施全量 TDD 实现并评审通过：T001–T021；ioredis 单例模块（client 不导出）、强制 TTL 的 CacheService（含键非空守卫）、自定义健康指示器并入 /health/ready、启动 ping fail-fast、error 日志脱敏；新增 E2E `test/redis-health.e2e-spec.ts` 与 `test/setup-env.ts`（修复 E2E 未加载 .env.local）；真实 Redis 验证断线命令即败、重启后同实例自动重连、日志无密码；OCR 评审 4 条意见修复（退避文档对齐线性 times\*100）；lint 0、单测 17 套件 103 项、E2E 5 套件 20 项全绿；ADR-003、设计与 spec 转 Confirmed；提交 `cbdad4a` 推送 `feat/user_redis_init`。
- 2026-10-14 用户模块全量实现并通过代码评审：T001–T035 按 TDD 落地；70 单测 + 18 E2E 全绿；全局过滤器/拦截器注册 main.ts；旧 app.e2e 补 NODE_ENV/MONGODB_URI；`test:e2e` 固定 --runInBand --forceExit；ADR-002、设计与 spec 转 Confirmed。
- 2026-10-13 移除 posts 示例域：设计文档未要求任何业务集合，posts 为 AI 自选示例（YAGNI）；删除 src/posts 与 test/smoke 冒烟，接入收敛为 forRootAsync 连接 + health + shutdown hooks。
- 2026-10-12 MongoDB 基础接入：forRootAsync 连接（池/超时/w:majority/生产 autoIndex 关）；health 模块 liveness/readiness 分离 + 5s 节流；shutdown hooks。

## 4. 阻塞与待决

- 无阻塞。
- 延后项（宪法原则 V，需建后续功能/issue，勿静默遗忘）：
  1. 指标导出（Metrics）：本期只有结构化访问日志与 requestId，无 RED/速率/延迟指标。
  2. 跨服务 TraceContext 传播：`x-request-id` 仅进程内关联，无下游透传与统一 Trace 设施。
  <!-- 分支名 20260921_cursor_mcp 虽不符合 §6.5 命名规范，人工确认保留，不改名。 -->

## 5. 关键决策（只放指针，正文在 ADR）

| 编号                                                 | 决策                                                                          | 状态      | 日期                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- | --------- | -------------------------------------- |
| [ADR-001](./architecture/adr/ADR-001-mongodb.md)     | 采用 MongoDB 作为核心数据存储                                                 | Confirmed | 2026-10-12                             |
| [ADR-002](./architecture/adr/ADR-002-user-module.md) | 用户集合 + isAdmin 布尔角色 + 软删基线                                        | Confirmed | 2026-10-13（2026-10-14 评审确认）      |
| [ADR-003](./architecture/adr/ADR-003-redis-cache.md) | Redis 作为统一缓存层及接入基线（ioredis 单例、强制 TTL、fail-fast、健康检查） | Confirmed | 2026-10-14（2026-10-15 实现+评审确认） |

## 6. 关键决策草稿（AI 追加，人工确认后移入 §5 并建 ADR）

- 2026-10-26 全局统一响应外壳：成功体全局 map 拦截器包裹、错误体扁平化删 statusCode（HTTP 状态码保留）、探活路径豁免单一纯函数共用、一次性破坏性切换（无外部消费方）；T027 收敛为四字段 `{success,code,message,data}`（对齐 @nestarc/safe-response，去 path/time）、错误文案集中 ERROR_CODES、Swagger 成功响应经 CLI 插件 + wrapSuccessEnvelope 免逐接口注解。已建 ADR-006（Pending，决策 11/12），T001–T027 完成待评审确认。

- 2026-10-22 接入 Harness 多角色协作层：四角色（arch/dev/test/devops）+ `/role`、`/evolve` 两个角色层指令 + 进化记录机制。是否作为长期治理基线待人工确认；确认后可考虑补 ADR-004（文档治理/开发流程类）。详见 EVO-20261022001。

- 2026-10-22 登录鉴权令牌选型：不透明随机令牌 + Redis 服务端会话（sha256 入键、7 天 TTL、登出即时吊销）+ 每请求 Mongo 回查账号实现软删/降权即时生效；不引入 JWT/passport 新依赖。已建 ADR-004（Draft），实现评审通过后确认。

- 2026-10-25 Swagger 在线接口文档：@nestjs/swagger 7.4.2 唯一新增直接依赖；`/api-docs` local/uat 开放、production UI/文档源/静态资源全 404（不 setup 即不注册路由）；双入口共用 `setupSwagger`；Bearer Authorize 走真实全局 AuthGuard 无旁路；注解不改变任何运行时行为。已建 ADR-005（Pending），实现 T001–T029 完成待评审确认。

## 7. 已知问题

问题与缺陷的跟踪入口统一为 [issues/README.md](./issues/README.md)；本节不复制清单，只放跨会话必须立刻知道的前 3 条。

1. 暂无（issues/README.md 当前无记录）。

## 8. 环境备忘

- 运行时：Node 20（`.nvmrc`）+ pnpm 9；默认 `NODE_ENV=local`。
- env：按 `NODE_ENV` 自动加载 `.env.local/.uat/.production`，无需复制成 `.env`；三个 env 文件按 AGENTS.md §7 允许提交。
- 本地依赖：Redis 4.0.11（`/usr/local/redis-4.0.11`，`redis-server`）、MongoDB 7（端口 27017，`--bind_ip=127.0.0.1` 仅 IPv4）。
- 连接串用 `mongodb://127.0.0.1:27017/...`，不用 `localhost`：Node 18+ 优先解析 IPv6 `::1` 而 mongod 只绑 IPv4，会偶发 ECONNREFUSED。
- 启动：`pnpm run start:local`；全量检查：`pnpm lint && pnpm test`。
- 技术栈版本以 [AGENTS.md §2](../AGENTS.md) 与 [overview.md 技术栈表](./architecture/overview.md) 为准，本节不复制。
- bcrypt 原生构建：pnpm ≥10 默认拦依赖 install 脚本，白名单在 `pnpm-workspace.yaml`（`allowBuilds: bcrypt:true`，pnpm 9 读 package.json 的 `pnpm.onlyBuiltDependencies`）。遇 `bcrypt_lib.node` 找不到 / `ERR_PNPM_IGNORED_BUILDS`：占位串改 `true` 后 `pnpm rebuild bcrypt`；沙箱内重装报 `.pnpm Operation not permitted` 时改在沙箱外执行。详见 [development.md §8.1](./development/development.md#81-bcrypt-原生绑定缺失--构建脚本被忽略)。

## 9. 会话记录（只追加；超过 30 条压缩为季度摘要，归档到 issues/ 或独立归档文件）

### 2026-10-27 修复 Swagger 错误示例全显 409（@dev-agent + AI）

- 现象：Swagger UI 中每个接口的 400/401/403/404 错误响应示例体 `code` 都显示 409。
- 根因：所有错误状态码响应 `$ref` 同一个 `ErrorEnvelope` 模型，而模型 `properties.code.example` 写死 409；Swagger UI 按共享模型示例渲染，响应键本身（400/401/403/404/409）正确。
- 修复（TDD）：`src/common/swagger/wrap-envelope.ts` 删除 ErrorEnvelope.code 的 `example:409`；`injectErrors` 给每个状态码响应的 media 挂响应级 `example:{success:false,code:<该状态码>,message,data:null}`（OpenAPI media.example 覆盖模型示例）。`ResponseLike` media 类型加 `example?`。
- 测试：wrap-envelope.spec 改 2 例（模型 code 无 example；每状态码 example.code 等于自身）；swagger-docs E2E 哨兵同步。验证：单测 28 套件 233、E2E 7 套件 50、lint 0、build:local 0；真实起服务取 /api-docs-json 复核 400..409 示例 code 各自正确。
- 同期：将 AuthService 私有 `logLockHit` 提取为全局 `src/common/logger/security-log.ts` 的 `logLoginLockHit`（+2 单测），auth.service 改调用；用户决定随 005 同一 commit，不单独提交。

### 2026-10-26 005 Phase 8 / T031 代码执行完成（@dev-agent + AI）

- 触发：用户「执行 Phase 8」。核查发现实现与测试已由前序会话落地（分页 DTO/service/list-page 模型、`softDelete→null`、`findByIdOrNull`、delete-result.dto.ts 已删、user-admin/swagger E2E 已迁、规划期文档已同步），本次补齐收尾：004 契约头部 T031 声明、tasks T031-1..10 勾选、全量门禁取证、/evolve、context 更新。
- 验证（真实输出）：`pnpm lint` 退出 0；`pnpm test` 27 套件 231 项全绿；`pnpm test:e2e` 7 套件 50 项全绿（真实 mongod 27017 + redis 6379，ai_blog_test）；`pnpm build:local` 退出 0。
- grep 取证（T031-8）：src/ test/ 无游标/items/DeleteResultResponse 业务残留，仅剩 `not.toHaveProperty('items'/'nextCursor')` 负断言、swagger 文档源哨兵 `not.toHaveProperty('DeleteResultResponse')` 与说明注释；user 模块无 cursor/limit 入参。
- /evolve：产出 EVO-20261026003（CRUD data 五形态与分页范式须在首个列表接口落地前锁定；只读空结果 200/null 与写操作 404 分离），已归并 `agents/arch-agent/AGENTS.md` tasks 评审清单，evolution-mechanism 索引登记 applied。
- 后续：handoff 执行方不自行置 complete，由编排方（arch-agent）verification-before-completion 后置 complete；提交/PR 需人工授权。

### 2026-10-26 005 追加 T031 规划修订：CRUD data 五形态（@dev-agent + AI，纯规划层）

- 触发：用户要求「统一增删差改」并写进规范——列表 `data:{total,list,page,pageTotal,index}`、删除 `data:null`、更新返回更新后数据、新增返回新数据、单查返回对象或 null。
- 澄清 4 项（AskQuestion）：`index`=本页首条全局序号从 1 起（`(page-1)*pageSize+1`，首页 1、第 2 页=pageSize+1）；只读单查不存在改 200+`data:null`（404 只留给写操作目标不存在，非法 id 仍 400）；分页入参 `page`（缺省 1）+`pageSize`（缺省 20、封顶 50）替换 cursor/limit；范围 spec-only（代码后续按 tasks TDD）。
- 结论（ADR-006 决策 16）：列表游标分页 `{items,nextCursor}` 改页码分页 `PageResult`（`pageTotal=ceil(total/pageSize)`，空库 0）；删除 `DeleteResultResponse{id}` 废止改 null；创建/更新现状即完整对象不改。属 executing 中第三次契约修订，按 EVO-20261026002 先改规划层再执行。
- 改动（纯文档，未写生产代码）：005 spec（T031 权威修订块、FR-016/017/018、SC-008/009/010、PageResult 实体、US1 场景 3/4 与 US2 场景 4）、contracts/api-contract（头部五形态表、§2 三接口行、§3 列表/单查 null 示例）、data-model §6（PageResult class + Mongo skip/count 取数 + 用户模块映射）、tasks.md Phase 8（T031-1..T031-10 共 10 个任务，全部 ⬜，含 RED/GREEN/E2E/grep/文档/门禁与 /evolve）、quickstart（断言点+冒烟第 9 步）、ADR-006 决策 16 与更新记录、001 user-api（§4 分页、§5 单查 200/null、§7 删除 null、404 码表限定写操作）、001 quickstart/data-model、用户模块设计 §5 Service 表与 §7（游标段划线保留+页码段权威）、coding-style §1.4 新增「CRUD 响应 data 五形态」硬约束与更新记录、data-flows 登录段（顺带修正 T030 残留 code:'SUCCESS'/'INVALID_CREDENTIALS' 为数字外壳）。
- 验证：纯 Markdown 规范改动，按规约 `[no-test]` 豁免；无 lint/test/build 运行、无代码改动。
- 后续：dev-agent 认领执行 tasks Phase 8（T031-1..10，严格 TDD：分页 RED→GREEN、删除 null、只读 null 化、user-admin/swagger E2E 迁移、grep 残留、全量门禁），完成后 /evolve（候选教训：CRUD data 形态与分页风格是横切契约，应在首个列表接口落地前锁定——游标 → 页码已是本 feature 第三次契约返工）；handoff 仍 executing。

### 2026-10-26 005 追加 T030：外壳 code 改数字且恒等于 HTTP 状态码（@dev-agent + AI）

- 触发：用户指出前版未达要求——「服务的异常保留，但服务正常期间接口成功 200，TransformResponseInterceptor 里的 code 作为业务码需要返回对应的 200、401、500 等」。经一次澄清，拍板 `code` 全面数字=HTTP 状态（同状态细分码合并，仅靠 message 区分）。
- 结论：`ApiResponse.code` 由 `string` 改 `number`，成功恒 200、失败即 400/401/403/404/409/500；服务异常链路（抛出位置、异常类型、HTTP 状态行、message、鉴权/校验）一字不动；10 个字符串码降为 Service/Guard 抛出值与 `ERROR_CATALOG` 的内部异常键，不再进响应体。先改 spec/contract/data-model/tasks（T030 修订块 + FR-002/FR-006/SC/Swagger）再 TDD。
- 改动：`response.constants.ts`（`SUCCESS_CODE=HttpStatus.OK`、`code:number`）、`http-exception.filter.ts`（normalize 去掉字符串 code 返回，body `code=status`，message 仍按内部键查 `ERROR_CODES`）、`wrap-envelope.ts`（Success/Error Envelope code schema number，示例 200/409）；单测 4 个、业务 E2E 5 套件断言改数字（重复用户名/邮箱由 distinct code 改为同 409 + message 区分）；005 spec/contract/data-model/tasks/quickstart、ADR-006 决策 15、001/003/004 契约指针、coding-style §1.4 同步。
- 验证（证据驱动）：RED 先确认 constants/filter/wrap-envelope 3 套件失败；GREEN 后 lint 0、单测 27 套件 222、E2E 7 套件 48、build:local 0；`src/`、`test/` 字符串 code 外壳断言 grep 0 命中（仅内部抛出点 `throw new XxxException('CODE')` 与 catalog 键保留）。
- 坑：改 filter 单测时 `expect(...).toEqual(` 漏一个右括号导致 TS1135/TS1128，tsc 定位修复；无运行时逻辑问题。
- 性质：executing 中用户二次追加契约变更（推翻 FR-006 字符串码），已落 tasks Phase 7 / ADR-006 决策 15 留痕；handoff 仍 executing；待 /evolve（候选：业务码值域选择须在 spec 早期定死，字符串码 ↔ 数字码在未交付 feature 内已是第二次返工）与人工授权提交/PR。

### 2026-10-26 005 追加 T027：外壳四字段 + 错误文案集中 + Swagger 免逐接口注解（@dev-agent + AI）

- 触发：用户要求「自己写响应拦截器构建 {success,code,message,data}，功能对标 @nestarc/safe-response，不需要每个 API 写 ApiResponse；data 支持 null/[]/{}，错误码统一配置，支持 Swagger」。
- 结论：既有 005 外壳为五字段 `{code,data,message,path,time}` + 逐接口 Envelope 子类/`@ApiResponse`；T027 在同一未交付 feature 内一次性收敛：外壳改四字段（去 path/time 加 success），错误码文案集中 `ERROR_CODES`，Swagger 成功响应免注解走「官方 CLI 插件推断返回类型 + 文档生成后 wrapSuccessEnvelope 统一包裹」。
- 改动：① `response.constants.ts` ApiResponse 四字段 + `ERROR_CODES`（10 码，哨兵单测锁全量集合）；② interceptor/filter 产 success、去 path/time，filter 文案查表（VALIDATION_ERROR 保留字段数组，未登记码回退原 message）；③ 新 `src/common/swagger/wrap-envelope.ts` 纯函数（allOf 包裹 2xx、豁免/4xx 不动、幂等，7 单测），setupSwagger createDocument 后调用；④ nest-cli.json 启用 `@nestjs/swagger` 插件，test/ts-jest.transformers.js（name/version/factory）+ jest-e2e.json 让 E2E 编译链路挂同一插件；⑤ 删 EnvelopeBase/5 成功子类与 9 个成功 @ApiResponse，data 模型归域 dto（login-result/user-list-page/delete-result），user.service list/softDelete 返回类型换 class，login controller 返回 class 替代 interface（插件不为 interface 生成 schema），logout 返回 null（原 data:{success:true} 与顶层 success 重复，废弃）；⑥ ErrorEnvelope 加 success:false。
- 验证（证据驱动）：lint 0 warning；单测 28 套件 207（新增 wrap 7/错误码表 2/data 空值 3/未登记码 1）；E2E 7 套件 48（swagger 12 项：登录 200 allOf=SuccessEnvelope+LoginResultResponse、ErrorEnvelope 四字段、旧 5 Envelope/ErrorResponse 不存在、9 操作码集合与 4xx $ref 不变；业务 4 套件全等/键集合断言迁四字段，锁定期全等体恢复整体 toEqual——无 time 后不再需要 toMatchObject 退化）；tsc 0；build:local 0；3000 实 HTTP 冒烟 register201/409 文案中文/login/me/logout(data:null)/401。冒烟数据已清（1 条 smoke\_\*）。
- 坑：① 无 @ApiResponse 时 swagger explorer 源码证实只产出空描述响应，运行时 design:returntype 反射不能解包 Promise/数组、拿不到 interface，免注解只能走编译期插件；② ts-jest transformer 条目是 require 自定义模块（导出 name/version/factory(compiler,options)），不是 [path,options] 元组，factory 内 `swagger.before({}, compiler.program)`；③ 沙箱拦 kill，冒烟进程 PID 40881 需沙箱外 `kill -9`（§8 老坑复发，未关）。
- 性质：executing 中用户追加范围，已落 tasks.md T027 + ADR-006 决策 11/12 留痕；handoff 仍 executing；待 /evolve（候选：文档免注解的返回类型 class 约束；测试编译链路须与构建链路挂同一 AST 插件）与人工授权提交/PR。

### 2026-10-26 005 追加 T026：守卫与鉴权错误文档绑定 @AuthOnly/@AdminOnly（@dev-agent + AI）

- 触发：用户追问「能否把 `@ApiResponse`/`@ApiErrorResponses` 统一放到 guard 上、靠守卫抛的 error 处理」。
- 结论：Swagger 文档在启动期由装饰器元数据静态生成，守卫在请求期才执行、Swagger 从不执行守卫，故**无法从运行时抛错自动派生文档**；可行等价方案是用 `applyDecorators` 把守卫与其真正会抛的错误文档静态绑成一个注解。
- 改动：新增 `src/modules/user/guards/auth.decorators.ts`——`@AuthOnly()` = `UseGuards(RolesGuard)`（认证-only）+ `@ApiBearerAuth('Bearer')` + `ApiErrorResponses([401])`；`@AdminOnly()` = `@AuthOnly()` + `@Roles('admin')` + `ApiErrorResponses([403])`。user controller 6 个受保护接口（me×2、list/detail/admin/delete）与 auth logout 替换 `@UseGuards(RolesGuard)`/`@Roles`/`@ApiBearerAuth` 样板；接口 `@ApiErrorResponses` 去掉守卫负责的 401/403，只留接口自身 400/404/409。login 为 `@Public`，其 401 是凭据错误（非守卫、描述不同），不套用。200 成功外壳 data 类型逐接口不同，保留单条 `@ApiResponse({type})`。
- 边界：401/403 可随守卫；400（ValidationPipe）、404/409（Service）、公开接口凭据 401 无法随守卫。
- 测试（TDD）：先写 `auth.decorators.spec.ts` 2 用例（断言 GUARDS/ROLES/API_RESPONSE/API_SECURITY 元数据）RED→GREEN；Swagger 响应码集合不变，既有 E2E 哨兵仍绿。
- 验证：lint 0；单测 27 套件 194；E2E 7 套件 48；build:local 0。文档：ADR-006 决策 9 + 替代方案（运行时派生否决）、coding-style §1.4、tasks T026。
- 性质：用户在 executing 中追加的范围，已落 tasks.md 留痕；handoff 仍 executing，置 complete/提交/PR 待编排方与人工授权。

### 2026-10-26 005 追加 T025：ApiErrorResponses 错误响应抽取（@dev-agent + AI）

- 触发：用户要求「ApiResponse 抽取出去，不要每个接口逐个标 200/401」。澄清后选「组合装饰器工厂，按接口真实错误码一行声明」（非类级全套，避免假契约）。
- 改动：`src/common/response/response-schemas.ts` 新增 `ERROR_DESCRIPTIONS`（400/401/403/404/409 默认描述集中维护）+ `ApiErrorResponses(statuses[], overrides?)`（applyDecorators 组合，未登记状态码 fail-fast）；auth/user controller 9 个接口的错误 `@ApiResponse` 全部替换为一行（如 `@ApiErrorResponses([400,401,403,404])`），特殊文案（登录 401、注册/改邮箱/删除 409、列表 400）走 overrides；成功 200/201 保留单个 `@ApiResponse({type:XEnvelope})`（data 类型逐接口不同）。
- 测试：swagger-docs E2E 新增哨兵「9 操作响应码集合固定 + 所有 4xx \$ref ErrorEnvelope」（套件 11→12）；新增 `response-schemas.spec.ts` 3 用例（默认描述/覆盖/未知码抛错）。
- 验证：lint 0；单测 26 套件 192；E2E 7 套件 48；build:local 0。文档：ADR-006 决策 8 + 替代方案（类级全套否决）、coding-style §1.4、tasks T025。
- 性质：用户在 executing 中追加的范围，已落 tasks.md 新任务留痕（非自行扩规划）；handoff 仍 executing，置 complete/提交/PR 待编排方与人工授权。

### 2026-10-26 005-unified-response E2E 迁移与收尾 T013–T023（@dev-agent + AI）

- 目标：Phase 1–4 已完成（常量/filter/interceptor/装配/Swagger 模型），本会话认领执行 Phase 5/6：6 个业务套件断言迁外壳、豁免回归、残留清理、ADR/文档、全量门禁与手工冒烟。
- 改动/结果：`user-register`（6/6）成功体 `toEqual` 五字段 + 顶层键集合、409 补 `data:null`/无 statusCode；`user-profile`（6/6）注册取 `data.id`、本人/改邮箱读 data、409 外壳；`user-admin`（6/6）列表 `data.items/nextCursor`、提权/删除读 data、删除 `data.toEqual({id})`、detail 400/404 + LAST_ADMIN 409 补外壳；`auth-login`（15/15）直接取 token 三处迁 `data.token`、logout 断言 data、全等体（未知账号 ≡ 错密码、锁定第六次 ≡ 第一次）改 `toMatchObject({code,data:null,path})` + `typeof time==='string'`（不比较 time，毫秒级可能不同）；`redis-health` ready 补不含 code/data/message 断言；`app` 根探活不改。
- 残留 grep：`body.token|body.user|body.id|...` 0 命中；`statusCode` 仅剩负断言/文档源哨兵/filter 日志字段。
- 文档：新建 ADR-006（Pending）并登记架构索引+更新记录；001/003/004 contracts 顶部加 005 指针声明；data-flows 登录段改五字段；coding-style §1.4 加「响应统一外壳、业务代码禁手工构造、错误码抛字符串、豁免走 isEnvelopeExcludedPath」条+更新记录。
- 验证证据：`pnpm lint` 0；`pnpm test` 25 suites / 189；`pnpm test:e2e` 7 suites / 47；`pnpm build:local` exit 0。
- 手工冒烟（start:local:3000）：注册 201 五字段；登录 data.token/user；me；logout `data.success:true` 后 401；错密 401 INVALID_CREDENTIALS；重名 409 USERNAME_EXISTS；普通用户列表 403；匿名 401 UNAUTHENTICATED；admin 提权（mongoose 直改 isAdmin，mongosh 不在 PATH）后坏 id 400 INVALID_ID、不存在 404 USER_NOT_FOUND；`GET /` 纯文本、live `{status:up}`、ready Terminus 原生；api-docs-json 含 6 个 Envelope 模型、ErrorEnvelope data nullable 无 statusCode、旧 ErrorResponse 不存在。冒烟数据已清理（deleteMany smoke\*，4 条）。
- 坑：启动时 3000 被旧 watch 进程占用致两次 EADDRINUSE；kill 在沙箱内 Operation not permitted，需沙箱外执行。
- 后续：T024 `/evolve`（候选教训：破坏性外壳变更的 E2E 全等体须在规划清点阶段就识别 time 类逐请求字段；豁免路径 filter 透传顺带修复 ready 503 旧偏差）；编排方 verification 后将 handoff 置 complete（执行方不自行置位）；提交 + PR 需人工授权。

### 2026-10-25 004-swagger-docs T030 编排方收尾（@arch-agent + AI）

- 目标：003 收尾完成后做 004 最后一个任务——OCR 评审、handoff complete、PR 前置。
- OCR 委托模式评审范围 `3bc66a0..HEAD`：18 个可评审文件全覆盖（22 文件按 secret/锁文件/md 规则排除）。唯一发现：`test/swagger-docs.e2e-spec.ts` 四态用例在 logout 200 后冗余手动 `cache.del(auth:sess:<hash>)`——logout 端点自身已删 session（auth.service.logout），手动删会掩盖登出失效回归；003 登出 E2E 亦不手动删。
- 修正：移除该 cache.del 行及连带的 CacheService/createHash/sessionKey 无用声明（fc66bdd，1 file -9 行，pre-commit lint-staged 通过）；swagger 套件复跑 10/10 绿。
- 验证证据：`pnpm lint` 0；`pnpm test` 23 suites / 178；`pnpm test:e2e` 7 suites / 46；`pnpm build:local` 退出 0。
- handoff 置 `complete`（last_updated 2026-10-25T00:25+08）；tasks.md T030 勾选并记录评审结论；context.md 同步。
- 后续：远程分支推送 + PR 需人工授权（§6.6/§8，AI 不自行推远程/合并）；ADR-005 仍 Pending，PR 评审时可一并确认。

### 2026-10-25 004-swagger-docs TDD 执行 T001–T029（@dev-agent + AI）

- 目标：003 收尾（handoff 切 004、T036 标完成、提交 bbda6cf）后，认领 handoff 按 tasks.md 严格 TDD 落地 Swagger。
- 环境修复：pre-commit 钩子报 `mimic-fn` 缺失（onetime@6 符号链接悬空），沙箱外 `pnpm install --frozen-lockfile` 修复 node_modules（context §8 的 .pnpm 权限问题复发）。
- 改动/结果：T002 `pnpm add @nestjs/swagger@7.4.2`（7227f67，实测 express 运行时自带 swagger-ui-dist 而非 swagger-ui-express，+6 锁文件包）；Foundational（e27c9e6）`src/common/swagger/swagger.ts` 的 `isSwaggerEnabled`（RED 8 例 →GREEN）+ `setupSwagger`（关闭直接 return 不 createDocument/setup），main.ts/e2e-app 双入口同函数，三 env 加 SWAGGER_ENABLED；US1（3b045fa）全量 DTO/控制器注解 + response-schemas，文档源 E2E 哨兵 6 例先 RED 后 GREEN；US2/US3（eceab92）四态 Bearer 调试回归 + production 独立 bootstrap 全 404 + setupSwagger 关闭分支 2 例单测。
- 排障：production 404 E2E 两连坑——① AppModule 顶层 envFilePath 闭包在 setup-env（NODE_ENV=local）时锁定 .env.local，用 `jest.isolateModules` 隔离注册表重载；② `@nestjs/config` 不覆盖 process.env 已有键，.env.local 的 SWAGGER_ENABLED=true 残留，测试须显式覆盖 false（与 MONGODB_URI 同策略）。两坑已写入测试注释与 ADR-005。
- 验证证据：`pnpm lint` 0；`pnpm test` 23 suites / 178 tests（新增 swagger 10）；`pnpm test:e2e` 7 suites / 46 tests（swagger-docs 套件 10）；`pnpm build:local` 成功；3100 local 冒烟 register201/401/200/403/logout200/afterlogout401/ui200；3101 production 冒烟 ui/json/asset 全 404、登录管线 401 INVALID_CREDENTIALS。
- 文档：ADR-005（Pending）+ 架构 ADR 索引；development.md env 清单/文档入口；AGENTS.md §2.4；data-flows.md 无接口清单章节按任务备注跳过。
- 提交：bbda6cf（规划+认领）、7227f67（依赖）、e27c9e6（Foundational）、3b045fa（US1）、eceab92（US2/US3）。
- 后续：T030 编排方收尾——OCR `ocr review -B ./specs/004-swagger-docs/checklists/requirements.md`、handoff 置 complete、按 §6.6 发 PR（执行方不自行置位/推远程/合并）。

### 2026-10-24 004-swagger-docs Spec-Kit 规划全流程（@arch-agent + AI）

- 目标：新需求「新增 swagger 说明文档，使用 @nestjs/swagger ^7.4.2」走完 specify→plan→tasks→analyze。
- 版本核实：npm 官方源查询 7.4.2 peerDependencies 为 `@nestjs/common/core ^9||^10`、`reflect-metadata ^0.1.12||^0.2.0`，与本仓 NestJS 9 兼容，无需降级 6.x 或升级框架；`@fastify/static` optional peer 不装。
- 澄清 4 项：范围=接入+全量注解（9 业务接口 auth/users + infra）；环境=local/uat 开、production 404；鉴权=Bearer Authorize 调试；路径=`/api-docs`（文档源 `/api-docs-json`）。
- 产出：`specs/004-swagger-docs/` spec（3 US：完整文档 P1/Bearer 调试 P2/生产关闭 P1，FR-001–016，SC-001–008）、plan（宪法五原则全过、结构/env 决策）、research R1–R8（开关纯函数、不 setup 即 404、鉴权元数据与运行时守卫分离、main/e2e 同装配函数等）、data-model（无持久化实体）、contracts/api-contract（9 接口呈现契约+错误码以 service/filter 实际抛出核实）、quickstart（单测 8 例+E2E A/B 组+手工冒烟）、tasks 30 个（TDD：开关纯函数 RED、文档源内容 E2E RED、production 404 RED；文档/env/ADR [no-test]）、checklists/requirements.md 16 项全过。
- analyze：0 Critical/High；修 4 项——T006 验收「暂 404」矛盾改为「UI 空骨架」、T022 补 `.env.production` 指向 localhost/ai_blog 的环境隔离（create 前覆盖 MONGODB_URI=127.0.0.1/ai_blog_test + Redis 键）、typo swaggger→swagger、T019 RED 顺序说明。
- handoff：保持指向 003（executing，他会话 claimed），未切换；人工决定 003 complete 后再置 004 ready_for_execution 并由本会话认领执行（dev-agent，T001 起从 develop 切 feat/004-swagger-docs）。
- 验证：规划阶段纯文档 `[no-test]`；未写生产代码、未装依赖、未提交。

### 2026-10-23 003-user-login T036 /evolve 复盘归并（@dev-agent + AI）

- 目标：T001–T035 交付后执行 `/evolve`，把本 feature 复盘教训沉淀为可执行规则。
- 产出：[EVO-20261023001](../.specify/memory/evolution/EVO-20261023001-跨模块只读协作口与commitlint-subject规则.md)（P1，applied）。
- 规则归并（4 处）：`agents/arch-agent/AGENTS.md` plan.md 清单加「数据访问完备性：每类跨模块读取都由对方 export 的只读 Service 承载」、tasks.md 清单加「跨模块只读协作口逐查询落 RED+GREEN 任务，缺口未补齐不得 ready_for_execution」；`agents/dev-agent/AGENTS.md` 数据层规范加「执行中发现协作口缺口须登记偏差并落 blocked，禁止 @InjectModel 他模块 Schema」；`docs/architecture/engineering/commit-convention.md` subject 节补 commitlint `subject-case` 禁止大写英文开头、让中文语义在最前（含 `echo | npx commitlint` 自检）。
- 索引：evolution-mechanism.md 索引表已登记（applied）。
- 后续：handoff 置 complete 与 PR 由编排方 arch-agent/人工处理（执行方不自行置位）；PR 前 OCR `ocr review -B ./specs/003-user-login/checklists/requirements.md`。

### 2026-10-23 003-user-login 执行 T001–T033（@dev-agent + AI）

- 目标：认领 handoff（executing）后按 tasks.md 严格 TDD 交付登录鉴权全部 US。
- 改动/结果：Foundational（incrWithTtl、auth.config、getAuthPrincipal、@Public、session 类型）→ US1 登录签发不透明令牌（AuthService/Controller/Module、LoginDto、dummy bcrypt 均时序）→ US5 注册打 @Public → US2 全局 AuthGuard（APP_GUARD 默认拒绝、Bearer→Redis 会话 →Mongo 回查 fail-closed）+ resolveSession，删除 TestUserGuard/x-test-user，e2e-app 增 loginHelper/authHeader，2 套件改真实登录 → US3 logout + @CurrentToken → US4 incrWithTtl 计数/第 5 次置锁/锁定期统一 401。
- 规划偏差：tasks 漏列登录 $or 定位的 UserService 协作口；新增 `findLoginCredential`（返回 `{id,passwordHash,user}`）并补 2 个单测，避免 AuthService 跨模块直连 User Schema；待 arch 复核。
- 验证证据：`pnpm lint` 0 error/warning；`pnpm test` 21 suites / 168 tests 全绿；`pnpm test:e2e` 6 suites / 36 tests 全绿（真实 mongod 27017 + redis 6379，库 ai_blog_test）；`grep -rn "x-test-user\|TestUserGuard" test/ src/` 零命中；`npx tsc --noEmit` 通过。
- 提交：41c39b7（T001–T009）、e6f080b（US1/US5）、14c8360（US2）、6bfda58（US3）、7328e01（US4）。
- 后续：T034 文档（ADR-004→Pending、data-flows/context 已更新）、T035 全量门禁 + quickstart 手工冒烟、T036 `/evolve`、handoff complete 与 PR 由编排方/人工处理。

### 2026-10-22 003 plan 复核、tasks 生成、analyze 闸门与 handoff（@架构组 + AI）

- plan 检查：跨文件比对 + 代码库事实核对，修 7 处——澄清数 6→9、契约 FR 范围 019→021、data-model 锁定状态机病句、阶段 D 补 Mongo 回查 fail-closed、E2E 改写套件 3→2（实际仅 user-profile/user-admin 用桩）、research R8 补 Mongo 异常 401、quickstart 套件数同步。
- tasks：生成 `specs/003-user-login/tasks.md`，36 任务（Setup 2 / Foundational 7 / US1 7 / US5 2 / US2 9 / US3 3 / US4 3 / Polish 3），全部 checkbox+图标格式；执行序 US1→US5→US2→US3→US4（@Public 先于 APP_GUARD）。
- analyze：0 Critical/High；3 MEDIUM 已修——US5 测试描述误指 T023（应为 T022）、T014 计数 GREEN 早于 RED T031 违反宪法 III（改为 TODO 占位、计数移至 T032）、T013 补 cache.set reject→500 签发侧 fail-closed；4 LOW（plan 结构树漏 current-token decorator、成功/登出日志断言、R2 ponytail 注释、SC-007 冒烟口径）登记不堵闸门。
- handoff：`.specify/superpowers-handoff.json` 由 002/complete 切到 003，字段填全置 `ready_for_execution`（claimed\_\* 留空），JSON 校验通过。
- 验证：grep 无陈旧引用；纯文档/配置 [no-test]，未写生产代码。

### 2026-10-22 Harness 文档去重瘦身（@架构组 + AI）

- 跨文件重复分析：角色表四处（AGENTS §7.4.1、harness README §2、agents/README、prompts）各有不同用途全保留；evolve 规则三处复述（AGENTS §7.4.2、harness README §4、evolution-mechanism）以后者为唯一权威，前两处压缩为指针；handoff 规则三处复述（AGENTS §7.6、spec-kit-superpowers.mdc、§7.2/§7.3）保留 AGENTS 唯一完整版。
- AGENTS.md 缩减：§7.4.2 由 5 条 bullets 压为 2 段+链机制文件；§7.6 删除 13 行 JSON 示例（真实 `.specify/superpowers-handoff.json` 即样板，字段名改为一行罗列）；§7.4.1 四个 bullets 合为一句；§7.3 定位句删与 §7.5 重复的「禁止 /speckit.implement」。
- 两个 Cursor 规则瘦身：`spec-kit-superpowers.mdc`（alwaysApply）34→15 行只留四句红线指针；`harness-agents.mdc` 删「通用红线」4 条（与前者/§7.5 重复），路由表保留。
- `docs/harness/README.md` §4 五步复述压为两句+指针。
- 验证：章节引用 grep 无悬空；纯文档 `[no-test]`。

### 2026-10-22 §7 重排：Harness 提为 §7.4，约束/交接顺延（@架构组 + AI）

- 三层框架表彻底拆分：规划层定位在 §7.1，交接层定位新增于 §7.2 开头，执行层定位在 §7.3 开头。
- 第 3 层 Harness 新开 §7.4（原 §7.6 内容上移，子节 7.4.1 角色 / 7.4.2 自进化）；原 §7.4 全局约束顺延 §7.5（三层共用硬约束句保留为首段），原 §7.5 交接文件顺延 §7.6。
- 引用同步：AGENTS.md §4.1（§7.5→§7.6 交接、§7.6.2→§7.4.2 /evolve）、§7.2、§7.3 内引用；`agents/arch-agent/AGENTS.md`、`.cursor/rules/spec-kit-superpowers.mdc`（§7.5→§7.6）；`docs/harness/README.md` 组成表（§7.4 角色层/§7.5 约束/§7.6 交接）；`docs/context.md` 进行中区 §7.6→§7.4。历史会话记录只追加不改写。
- 验证：grep 全仓 `§7.4–§7.9` 无悬空引用；纯文档 `[no-test]`。

### 2026-10-22 §7.0 三层框架表拆分到对应节（@架构组 + AI）

- §7.0「核心框架组成」整节（表 + 共用硬约束句）删除，三层定位拆分到对应位置：规划层定位并入 §7.1 开头；执行层定位并入 §7.3 开头（指向 §7.4/§7.5）；三层共用硬约束句提为 §7.4 首段；角色与进化层定位并入 §7.6 开头。
- §7.1–§7.6 编号不变，外部引用仅 `docs/harness/README.md` 组成表由「§7.0、§7.6」改为「§7.1–§7.6」；历史会话记录中的 §7.0 字样为当时事实，不改写。
- 验证：grep 全仓 `§7.0` 仅剩 context.md 历史记录；纯文档 `[no-test]`。

### 2026-10-22 修复手工重排后的 §7 结构（@架构组 + AI）

- 人工重排后审查发现 4 处硬伤并修复：①§7.0 核心框架组成表被误删，恢复；② 半成品 §7.5「harness 占位」与 §7.7 内容重复，删除占位；③§7.4 引用了不存在的 `specs/git.md`（改指 §6.6/§6.7），「截图为证」改为命令真实输出，「禁止访问项目外文件」改为对齐 §8 的最小权限表述，测试优先条补 [no-test] 豁免；④ 交接文件节回到 §7.5、Harness 回到 §7.6/§7.6.1/§7.6.2，§4.1、§7.2、§7.3 引用随之全部有效。
- 最终 §7 编号：7.0 框架组成 → 7.1/7.2/7.3 三阶段 → 7.4 全局约束 → 7.5 交接文件 → 7.6 Harness。
- 验证：章节引用与相对链接脚本核对 0 坏链；纯文档 [no-test]。

### 2026-10-22 启动流程与触发词补全（@架构组 + AI）

- 根 `AGENTS.md` §4 加载规则新增 §4.1「启动流程（所有 Agent 必须执行）」六步 + 阶段门禁（不单列顶层章节），原按需项归为 §4.2；原 Harness 小节按人工调整统一为 §7.6/§7.6.1/§7.6.2。
- §7 工作流总览开头新增 §7.0「核心框架组成」：Spec-Kit（规划）/ Superpowers（执行）/ Harness（角色与进化）三层对照表，不重排 §7.1–§7.6 编号。
- `commands.md` 自然语言触发表扩充：9 个 `/speckit.*` 命令全部配触发词（含 clarify/checklist/taskstoissues/constitution），「写代码吧」明确不触发 `/speckit.implement` 而走 handoff 认领。
- 同步引用：`docs/harness/README.md`、`docs/context.md` 改为 §4.1/§7.6；EVO-20261022001 内 §7A 为当时历史事实，不改写。
- 结构调整：按人工意见启动流程并入 §4 加载规则（§4.1 强制启动 + §4.2 按需加载），不单列顶层 §0。
- 验证：相对链接脚本校验 0 坏链；纯文档 `[no-test]`。

### 2026-10-22 接入 Harness 多角色 Agent 与自进化机制（@架构组 + AI）

- 目标：参考 `harness-sdd` 模板，为仓库补齐多角色 agents、AGENTS.md 集成、evolution 进化记录能力。
- 改动（纯文档/配置，tasks 视角为 `[no-test]` 豁免，未跑 lint/test）：
  - 新增 `agents/README.md`、`agents/{arch,dev,test,devops}-agent/AGENTS.md`、`agents/prompts.md`：四角色，按 NestJS 9 + Mongoose + Redis 事实重写（无 frontend-agent；无 TypeORM/裸 SQL 假设）。
  - 新增 `.specify/memory/evolution-mechanism.md`、`.specify/templates/evolution-template.md`、`.specify/memory/evolution/EVO-20261022001-接入harness多角色与进化机制.md`（status=applied，含索引）。
  - 新增 `commands.md`（只收录真实存在的 `/speckit.*` 技能，标注 `/speckit.implement` 禁止）、`workflows/development-workflow.md`（11 阶段映射 §7 三阶段 + 角色交接物）。
  - 新增 `.cursor/rules/harness-agents.mdc`（文件类型 → 角色建议，alwaysApply:false）。
  - 新增 `docs/harness/README.md`（Confirmed）并更新 `docs/index.md`；根 `AGENTS.md` 新增 §7A、§3.1/§4 导航与时间戳。
- 结果：全部新增/修改文件的相对链接经脚本校验存在；未改任何生产代码与既有 §1–§9 规则正文（§7A 为追加）。
- 偏差：相对模板三处主动纠偏（Mongoose 事实、禁止 implement、单一权威源），已记入 EVO-20261022001。
- 后续：人工评审；确认决策草稿（§6）后补 ADR-004；按提交规范提交（未自动提交）。

### 2026-10-15 002 OCR 评审、修复、提交与文档确认（@架构组 + AI）

- OCR 委托模式评审（`ocr review -B specs/002-redis-integration/checklists/requirements.md`，CLI 无 LLM endpoint，走 delegate 由本代理评审）：17/17 代码文件覆盖，无 high/critical，4 条 low。
- 修复：① 退避描述对齐实现（代码为自定义线性 `min(times*100,2000)`，ioredis 默认也是线性 `times*50`，初稿"指数退避"写错）——改代码注释、research R4/R1、设计、ADR-003、tasks，保留实现不变（人工拍板"按文档对齐现有线性退避"）；②`CacheService` 加键非空守卫（TDD，4 个新用例）；③ 修正 readiness 过时注释；④ 工厂测试 mock 改为每次构造新建 jest.fn，消除共享串味。
- 状态流转：评审通过后 ADR-003、`redis-integration-design.md`、`specs/002-redis-integration/spec.md` 统一转 Confirmed，plan.md 内括注与架构索引同步。
- 提交与推送：`cbdad4a` `feat(cache): 集成 Redis 统一缓存基础设施 (#002)`（32 文件，+1878/−26），husky 钩子通过；分支 `feat/user_redis_init` 推送并设置上游（沙箱拦网络，非沙箱推送成功）。
- 验证：lint 0、tsc 0、单测 17 套件 103 项、E2E 5 套件 20 项全绿。

### 2026-10-15 Redis 缓存基础设施 002 全量 TDD 实现（@架构组 + AI）

- 目标：按 `specs/002-redis-integration/` 的 spec/plan/tasks 落地统一缓存服务、健康检查、异常可诊断，全程 RED→GREEN→REFACTOR。
- 改动：
  - `src/common/cache/`：`cache.constants.ts`（REDIS_CLIENT token）、`redis.config.ts`（host 必填无默认、keyPrefix 环境隔离、lazyConnect/enableOfflineQueue:false/退避重连）、`cache.module.ts`（全局单例、`createRedisClient` 工厂 connect+ping fail-fast、error 日志脱敏、quit 优雅关闭；仅导出 CacheService/RedisHealthIndicator）、`cache.service.ts`（正整数 TTL 强校验、EX、JSON 往返、未命中 null、del 幂等）、`redis.health.ts`（自定义 HealthIndicator，ping 失败抛 HealthCheckError）。
  - `src/health/health.controller.ts`：ready 检查数组追加 redis 指示器，沿用 5s 节流与失败不缓存；live 不触 Redis。
  - 测试：config/service/health indicator/controller/工厂 fail-fast 与日志脱敏单测（ioredis 全 mock）；`test/redis-health.e2e-spec.ts`（真实 Redis：ready 200 含 redis+mongodb，live 不依赖 Redis）；新增 `test/setup-env.ts` 并在 `test/jest-e2e.json` 注册 setupFiles——实现期发现 E2E 未设 NODE_ENV 导致 `.env.local` 不加载（CacheModule fail-fast 暴露了旧 Mongoose 靠默认 URI 的侥幸），旧 app.e2e 同步修复。
- 结果（证据）：`pnpm lint` 0；`pnpm test` 17 suites / 99 tests；`pnpm test:e2e` 5 suites / 20 tests，均退出 0。
- T018 手工验证（一次性脚本，已删除）：Redis 停服时工厂 reject 且打印 `ECONNREFUSED`（不含密码）；运行期停 Redis 后命令立即 reject（`Stream isn't writeable and enableOfflineQueue options is false`）；重启 Redis 后同实例自动重连成功（应用未重启）；物理键为 `local:probe:k1` 且 TTL=30、1 秒键真实到期、del 幂等。
- 偏差：fail-fast 工厂抽为可单测的导出函数 `createRedisClient`（任务原文为内联工厂，行为一致）；setup-env 基建已回写设计 §8。
- 后续：人工 OCR 评审（基线 `specs/002-redis-integration/checklists/requirements.md`）通过后 ADR-003/设计转 Confirmed；T021 verification-before-completion 后 handoff 置 complete。

### 2026-10-14 bcrypt/pnpm 构建排障记录与评审修正（@架构组 + AI）

- 修正 OCR 评审项：#1 `POST /users/delete` 返回 `{id}` 对齐契约；#3 schema `usernameLower` 去掉冗余 `index:true` 并补 `lowercase/trim`；#5 `pnpm-workspace.yaml` 构建脚本审批置有效值。
- 澄清 #5：`allowBuilds` 是 pnpm 12 实际读取的键（非无效键），此前只是 pnpm 自动写入的占位串未批准；`bcrypt:true`、`@nestjs/core:false`，package.json 同字段保留兼容 pnpm 9。
- 排障沉淀：pnpm ≥10 默认拦依赖 install 脚本 → `bcrypt_lib.node` 缺失；Cursor 沙箱拦 `.pnpm` 删除会令重装半损坏。已写入 [development.md §8](./development/development.md#8-故障排查) 与本文件 §8 备忘。
- 验证：lint 0、单测 13 套件 71 项、E2E 4 套件 18 项全绿。

### 2026-10-14 用户模块 001 文档状态流转（@架构组 + AI）

- 背景：代码评审已完成，进入提交前文档收尾。
- 状态流转：ADR-002、`docs/architecture/design/user-module-design.md` 由 Pending 转 Confirmed；`specs/001-user-module/spec.md` 由 Draft 转 Confirmed；架构索引与本文件同步。
- 同步修正：用户模块设计文档补齐实际落地的 `delete-user.dto.ts`、`user-query.dto.ts`、`current-user.interface.ts`；依赖描述从“待评审/待新增”改为 T001 已人工评审并安装。
- 当前交接：`.specify/superpowers-handoff.json` 为 `complete`；实现任务 T001–T035 全部勾选完成。

### 2026-10-14 用户模块 001 全量 TDD 实现（@架构组 + AI）

- 目标：按 `specs/001-user-module/` 的 spec/plan/tasks 落地注册、本人资料、管理员管理，全程 RED→GREEN→REFACTOR。
- 改动：
  - Schema/DTO：`User`（username/usernameLower/email/password/isAdmin/deletedAt，timestamps，两个唯一索引，敏感字段 select:false）；CreateUserDto（不含 isAdmin）、UpdateUserDto、SetAdminDto、DeleteUserDto、UserQueryDto（limit 缺省 20、封顶 50）、toUserResponse 脱敏。
  - Service：create（归一化 + bcrypt cost 10 + E11000 按 keyPattern 转 USERNAME_EXISTS/EMAIL_EXISTS）、findById、updateEmail、list（`_id` 游标倒序，limit+1 判下一页）、setAdmin、softDelete（最后管理员保护 LAST_ADMIN_PROTECTED，全量查询带 deletedAt:null）。
  - Controller：仅 GET/POST；POST 写参数全走 body；`POST /users` 公开；`GET/POST /users/me` 认证-only；管理员路由 `@Roles('admin')`。
  - 横切：`HttpExceptionFilter`（VALIDATION_ERROR/INVALID_ID/业务 code 透传/500 不泄内部）与 `AccessLogInterceptor`（crypto.randomUUID requestId、结构化 JSON、不打 body）注册到 main.ts。
  - 测试：`test/helpers/e2e-app.ts` 自举 + `x-test-user` 桩 Guard；修复旧 app.e2e（补 NODE_ENV/MONGODB_URI、超时与关闭）；`package.json` 的 test:e2e 固定 `--runInBand --forceExit`。
- 结果（证据）：`pnpm lint` 退出 0；`pnpm test` 13 suites / 70 tests 全绿；`pnpm test:e2e` 4 suites / 18 tests 全绿（真实 mongod，测试库 ai_blog_test）。
- 偏差同步：设计 §7 原文“createdAt 倒序”改为 `_id` 游标倒序（ObjectId 内嵌时间，等价且与 tasks 一致），并补 limit 缺省 20。
- 后续：登录/令牌落地后删除 x-test-user 桩；指标导出与跨服务 Trace 延后（见 §4）；ADR-002 与设计待人工评审转 Confirmed。

### 2026-10-13 移除 posts 示例域（@架构组 + AI）

- 背景：人工质疑 posts 出处；核查 ADR-001 与集成设计均未要求任何业务集合（Post 仅为 §2.1/§3.5/§3.8 的代码示例），posts 是 AI 为验证 forFeature/CRUD 自选示例，无 Controller/调用方，属提前脚手架（YAGNI）。
- 改动：删除 `src/posts/`（Schema/Service/Module/spec）、`test/smoke/mongodb.smoke.js` 及空目录；`app.module.ts` 移除 PostsModule。
- 保留：forRootAsync 连接、`src/mongoose.config.ts`（含常驻 connection error 监听）、health 模块、shutdown hooks；连接正确性改由 `/health/ready` 验证。
- 结果：`tsc` 0 错、`lint` 0 错、`test` 2 suites / 5 tests 通过；真实启动 `/health/ready` 200 `mongodb:up`，启动日志无 PostsModule。

### 2026-10-13 修复 localhost IPv6 连接拒绝 + 临时调试日志（@架构组 + AI）

- 现象：启动报 `MongooseServerSelectionError: connect ECONNREFUSED ::1:27017`。
- 根因：mongod 以 `--bind_ip=127.0.0.1` 只监听 IPv4；Node 18+ 解析 `localhost` 优先返回 IPv6 `::1`，mongodb 驱动先连 `::1` 被拒，故障转移到 IPv4 在 serverSelection 窗口内不稳定。
- 修复：`.env.local` 的 `MONGODB_URI` 由 `localhost` 改为 `127.0.0.1`（根治，不依赖 DNS 地址顺序）；uat/prod 占位串未动（将来是远程主机）。
- 调试：`src/mongoose.config.ts` 的 `connectionFactory` 常驻 `connection.on('error')` 监听，运行期连接错误（ECONNREFUSED/认证失败）以 `[mongoose] connection error:` 上屏（Nest 启动重试日志会吞掉真实原因）；临时的启动配置日志与一次性探测已按人工要求移除。
- 验证：改后 `probe OK ✓`、应用成功启动、`/health/ready` 200；`tsc/lint/test`（3 suites 16 tests）通过。
- 备选（未采用）：mongod 绑定改为 `--bind_ip=127.0.0.1,::1` 或 `--bind_ip_all`，需团队统一且监听更多地址，故选客户端固定 IPv4。

### 2026-10-12 MongoDB 集成实现与验证（@架构组 + AI）

- 目标：按集成设计文档落地 MongoDB 接入，含连接/Schema/Service/健康检查/优雅关闭，并给测试目标、项目、结果。
- 改动：
  - 依赖（人工指令批准）：`@nestjs/mongoose@9.2.2`、`mongoose@6.13.11`、`@nestjs/terminus@9.2.2`（pnpm 9，package.json/pnpm-lock.yaml）。
  - `.env.local`：MONGODB_URI（本地无鉴权 mongodb://localhost:27017/ai_blog）+ 连接池大小。
  - `src/mongoose.config.ts`：连接选项纯函数（池 50/5、maxIdleTimeMS、serverSelection 5s、socket 30s、retryWrites、w:majority、生产 autoIndex:false）。
  - `src/app.module.ts`：`MongooseModule.forRootAsync` 注入 ConfigService，复用上述工厂。
  - `src/posts/`：Post Schema（timestamps、collection 显式 posts）、嵌入标签快照 `@Schema(_id:false)`、authorId ObjectId 引用、`authorId+createdAt` 复合索引；PostsService（create/findById/findRecent 游标分页，非法 ObjectId→400、不存在 →404、limit 封顶 50）；Module forFeature 注册。
  - `src/health/`：Terminus `/health/live` 静态存活、`/health/ready` mongoose pingCheck，5s TTL 缓存，失败不缓存。
  - `src/main.ts`：`enableShutdownHooks()`。
  - `test/smoke/mongodb.smoke.js`：真实 mongod 冒烟（ping/索引/CRUD/嵌入/timestamps/游标分页）；`.gitignore` 忽略 `.corepack-cache`、`.pnpm-store`。
- 结果（证据）：
  - `tsc --noEmit` 退出 0；`pnpm lint` 退出 0；`pnpm test`：3 suites / 16 tests 全通过（PostsService 11 + HealthController 4 + 原有 AppController 1）。
  - 冒烟脚本对本地 mongod 输出 `SMOKE PASS`。
  - `pnpm start:local` 实启：live 200、ready 200 `{"mongodb":{"status":"up"}}`；停 mongod 后 ready 503 down、live 仍 200（故障隔离符合设计 §5.1）。
- 后续：posts Controller/DTO 未做（YAGNI，待首个写接口需求）；uat/prod 的 MONGODB_URI 需带 TLS（设计 §4.2）；事务验证需副本集（设计 §5.6）。

### 2026-10-12 context.md 定稿（@架构组 + AI）

- 决定：分支名 `20260921_cursor_mcp` 保留不改名；删除参考样例 context.reference.md。
- 改动：删除 docs/context.reference.md；§4 待决项清零（分支名保留改为 HTML 注释存档）。
- 结果：全仓无 context.reference 残留引用；context.md 9 节结构定稿。

### 2026-10-12 去除 MVP 遗留并对齐 AGENTS §7 修订（@架构组 + AI）

- 目标：清除 context.md 中全部 MVP 相关内容；对齐人工对 AGENTS.md §7 的修订。
- 改动：删除迭代周期字段与工作项周期标注；依赖安装从"人工前置"改为普通待办（§7 已移除 package.json 禁令）；env 待办与环境备忘对齐"三个 env 文件允许提交"。
- 结果：文件内相对链接全部验证存在；未跑 lint/test（纯 .md 改动）。
- 后续：可从待办第 1 项（安装依赖）开始实现。

### 2026-10-12 按人工修订重生 context.md（@架构组 + AI）

- 目标：人工已将主线确认为「NestJS 集成 MongoDB」并登记分支/负责人，AI 据此重生文件。
- 改动：按集成设计文档 §2–§5 生成 9 项待办；§1 风险对齐"依赖未装、无代码"；§4 登记分支命名规范问题。
- 结果：文件内全部相对链接验证存在；未跑 lint/test（纯 .md 改动）。

### 2026-10-12 docs 去重、事实统一与 context.md 整改（@架构组 + AI）

- 目标：消除 docs 重复内容/模板残留/跨文档矛盾；整改 context.md 结构。
- 改动：删 monitoring.md 并入 observability.md；重写 engineering/ 5 篇对齐真实配置；修死链与导航；统一 Node 20、SLO 99.9%、env 自动加载；context.md 改为快照+日志 9 节结构。
- 结果：markdown 相对链接扫描 ALL LINKS OK；lint/test 未执行（纯 .md 改动，沙箱内 eslint 受权限限制）。

## 维护规则

| 区块                 | 维护方            | 写法                                                         |
| -------------------- | ----------------- | ------------------------------------------------------------ |
| 当前状态、阻塞       | AI 每次会话末     | 覆盖，不留历史                                               |
| 进行中工作、近期完成 | 人 + AI           | 快照覆盖；完成项滚动淘汰，窗口 5 条                          |
| 关键决策             | 人工              | 只追加 ADR 指针，正文不写在这里；不删除，废弃只标记          |
| 决策草稿             | AI 追加、人工确认 | 确认后建 ADR 并移入 §5                                       |
| 已知问题             | AI                | 只留 top 3 指针，清单单一事实源在 issues/README.md           |
| 会话记录             | 人 + AI           | 只追加，每条含 目标/改动/结果（含验证证据）/后续；>30 条压缩 |
