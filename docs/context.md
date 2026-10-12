# 项目上下文

> 跨会话动态项目记忆，抵抗 AI 上下文丢失。每次重要会话结束前更新。
> 稳定规则不在此复制：硬性规则见 [../AGENTS.md](../AGENTS.md)，编码规范见 [development/coding-style.md](./development/coding-style.md)，架构决策见 [architecture/adr/](./architecture/README.md#adr-索引)，文档入口见 [index.md](./index.md)。
> 最后更新：2026-10-13 01:02（@架构组 + AI，会话：移除 posts 示例域，接入收敛为连接+健康检查）

## 1. 当前状态

- 当前阶段：NestJS 集成 MongoDB —— 基础接入完成（forRootAsync 连接 + 连接选项 + 健康检查 + 优雅关闭）；尚无任何业务集合
- 主干健康：本会话实测 `tsc --noEmit` 退出 0、`pnpm lint` 退出 0、`pnpm test` 2 suites / 5 tests 通过；真实 mongod 启动 `/health/live`、`/health/ready` HTTP 验证通过
- 阻塞项：无
- 风险：
  - 暂无业务 Schema/Service；[data-flows.md](./architecture/data-flows.md) 所有业务链路（文章/用户/评论/标签）都是规划，未落地代码。
  - 健康检查端点实际路径为 `/health/live`、`/health/ready`（设计只要求分离，未定名）；部署侧探针需按此配置。
  - 本地 mongod 为单节点非副本集，事务/change streams 不可验证（设计 §5.6）。

## 2. 进行中工作

### NestJS 集成 MongoDB，支持数据存储

- 目标：NestJS 集成 MongoDB，支持数据存储
- 分支：`20260921_cursor_mcp`
- 负责人：架构组
- 实现依据：[MongoDB + NestJS 集成设计文档](./architecture/design/mongodb-integration-design.md)、[ADR-001](./architecture/adr/ADR-001-mongodb.md)

- [x] 安装依赖 `@nestjs/mongoose@9.2.2` + `mongoose@6.13.11`（+ `@nestjs/terminus@9.2.2`，设计 §3.1/§5.1，人工指令批准）
- [x] `.env.local` 补 MongoDB 连接配置（设计 §3.2；三个 env 文件按 AGENTS.md §7 允许提交）
- [x] 根模块 `MongooseModule.forRootAsync` + ConfigService 接入（设计 §3.3，选项抽到 `src/mongoose.config.ts`）
- [ ] 首个业务 Schema 与 `forFeature` 注册（待真实业务域需求；设计 §2 的文章建模仅为文档示例）
- [ ] Service 层 `@InjectModel` 注入与基础读写（待业务 Schema 落地后按设计 §3.5 实现）
- [x] 连接池配置（设计 §3.6：max/min pool、超时、w:majority、生产 autoIndex:false）
- [x] `/health/ready` 含 MongoDB ping、`/health/live` 不打 DB，ping 结果 5s 节流（设计 §5.1）
- [x] 优雅关闭（设计 §5.4，main.ts `enableShutdownHooks`）
- [x] 验证：`pnpm lint && pnpm test` 退出码 0；真实启动 `/health/ready` 200 连通验证通过

完成定义：全部勾选完成 + 相关设计文档同 PR 更新 + 本地 `pnpm run start:local` 连通验证通过。

后续候选（未开工）：首个真实业务域（文章/用户/标签等，以 data-flows 与产品需求为准）Schema+Service+Controller/DTO；E2E 测试；uat/prod 连接串补 TLS（设计 §4.2）。

## 3. 近期完成（滚动窗口，只留最近 5 项）

- 2026-10-13 移除 posts 示例域：设计文档未要求任何业务集合，posts 为 AI 自选示例（YAGNI）；删除 src/posts 与 test/smoke 冒烟，接入收敛为 forRootAsync 连接 + health + shutdown hooks。
- 2026-10-12 MongoDB 基础接入：forRootAsync 连接（池/超时/w:majority/生产 autoIndex 关）；health 模块 liveness/readiness 分离 + 5s 节流；shutdown hooks。
- 2026-10-12 docs 去重与事实统一：删 monitoring.md 并入 observability.md；engineering/ 5 篇按真实配置重写；死链清零；统一 Node 20 / SLO 99.9% / env 自动加载口径。
- 2026-10-12 ADR-001 确认：MongoDB 7 + @nestjs/mongoose 9 + Mongoose 6。
- 2026-10-11 docs 文档体系初始化（架构 / 开发 / 运维 / 工具手册四类骨架）。

## 4. 阻塞与待决

- 无阻塞，无待决。
  <!-- 分支名 20260921_cursor_mcp 虽不符合 §6.5 命名规范，人工确认保留，不改名。 -->

## 5. 关键决策（只放指针，正文在 ADR）

| 编号                                             | 决策                          | 状态      | 日期       |
| ------------------------------------------------ | ----------------------------- | --------- | ---------- |
| [ADR-001](./architecture/adr/ADR-001-mongodb.md) | 采用 MongoDB 作为核心数据存储 | Confirmed | 2026-10-12 |

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

## 9. 会话记录（只追加；超过 30 条压缩为季度摘要，归档到 issues/ 或独立归档文件）

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
