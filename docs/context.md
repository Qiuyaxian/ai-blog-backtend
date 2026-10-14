# 项目上下文

> 跨会话动态项目记忆，抵抗 AI 上下文丢失。每次重要会话结束前更新。
> 稳定规则不在此复制：硬性规则见 [../AGENTS.md](../AGENTS.md)，编码规范见 [development/coding-style.md](./development/coding-style.md)，架构决策见 [architecture/adr/](./architecture/README.md#adr-索引)，文档入口见 [index.md](./index.md)。
> 最后更新：2026-10-14 21:51（@架构组 + AI，会话：记录 bcrypt/pnpm 构建脚本排障，评审项 1/3/5 修正）

## 1. 当前状态

- 当前阶段：用户模块（`specs/001-user-module`，T001–T035）已实现、验证并通过代码评审；ADR-002、用户模块设计文档与功能规格已转 Confirmed；首个真实业务集合 `users` 已落地
- 主干健康：本会话实测 `pnpm lint` 退出 0、`pnpm test` 13 suites / 70 tests 通过、`pnpm test:e2e` 4 suites / 18 tests 通过（真实本地 mongod，测试库 `ai_blog_test`）
- 阻塞项：无
- 风险：
  - 登录/令牌尚未实现：E2E 靠 `test/helpers/e2e-app.ts` 的 `x-test-user` 测试桩 Guard 注入 `request.user`；认证模块落地后必须删除该桩（T035 已注明）。
  - 访问日志只有请求级 requestId 关联，无跨服务 TraceContext 传播、无指标导出（宪法原则 V 延后项，见 §4 待决）。
  - 本地 mongod 为单节点非副本集，事务/change streams 不可验证（设计 §5.6）。
  - E2E 固定 `--runInBand`（package.json）：多个 AppModule 并行 bootstrap 会把本地 Mongo 连接打满；CI 若换测试容器可再评估并行。

## 2. 进行中工作

### 用户模块 001（注册 / 本人资料 / 管理员管理）

- 依据：[spec](../specs/001-user-module/spec.md)、[plan](../specs/001-user-module/plan.md)、[tasks](../specs/001-user-module/tasks.md)、[用户模块设计](./architecture/design/user-module-design.md)、[ADR-002](./architecture/adr/ADR-002-user-module.md)
- 状态：代码与测试全部完成（US1–US3 + Foundational），handoff 为 `complete`；代码评审通过，ADR-002、用户模块设计文档与功能规格均为 Confirmed
- 已交付：Schema（usernameLower/email 唯一、select:false、软删）、全局异常过滤器、访问日志拦截器、注册/本人/管理员 7 个接口、RolesGuard（认证-only + 管理员）、E2E 测试基建
- 剩余：无；后续认证模块落地时删除 `x-test-user` 测试桩（见风险与延后项）

## 3. 近期完成（滚动窗口，只留最近 5 项）

- 2026-10-14 用户模块全量实现并通过代码评审：T001–T035 按 TDD 落地；70 单测 + 18 E2E 全绿；全局过滤器/拦截器注册 main.ts；旧 app.e2e 补 NODE_ENV/MONGODB_URI；`test:e2e` 固定 --runInBand --forceExit；ADR-002、设计与 spec 转 Confirmed。
- 2026-10-13 移除 posts 示例域：设计文档未要求任何业务集合，posts 为 AI 自选示例（YAGNI）；删除 src/posts 与 test/smoke 冒烟，接入收敛为 forRootAsync 连接 + health + shutdown hooks。
- 2026-10-12 MongoDB 基础接入：forRootAsync 连接（池/超时/w:majority/生产 autoIndex 关）；health 模块 liveness/readiness 分离 + 5s 节流；shutdown hooks。
- 2026-10-12 docs 去重与事实统一：删 monitoring.md 并入 observability.md；engineering/ 5 篇按真实配置重写；死链清零；统一 Node 20 / SLO 99.9% / env 自动加载口径。
- 2026-10-12 ADR-001 确认：MongoDB 7 + @nestjs/mongoose 9 + Mongoose 6。

## 4. 阻塞与待决

- 无阻塞。
- 延后项（宪法原则 V，需建后续功能/issue，勿静默遗忘）：
  1. 指标导出（Metrics）：本期只有结构化访问日志与 requestId，无 RED/速率/延迟指标。
  2. 跨服务 TraceContext 传播：`x-request-id` 仅进程内关联，无下游透传与统一 Trace 设施。
  <!-- 分支名 20260921_cursor_mcp 虽不符合 §6.5 命名规范，人工确认保留，不改名。 -->

## 5. 关键决策（只放指针，正文在 ADR）

| 编号                                                 | 决策                                   | 状态      | 日期                              |
| ---------------------------------------------------- | -------------------------------------- | --------- | --------------------------------- |
| [ADR-001](./architecture/adr/ADR-001-mongodb.md)     | 采用 MongoDB 作为核心数据存储          | Confirmed | 2026-10-12                        |
| [ADR-002](./architecture/adr/ADR-002-user-module.md) | 用户集合 + isAdmin 布尔角色 + 软删基线 | Confirmed | 2026-10-13（2026-10-14 评审确认） |

## 6. 关键决策草稿（AI 追加，人工确认后移入 §5 并建 ADR）

- 暂无。

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
