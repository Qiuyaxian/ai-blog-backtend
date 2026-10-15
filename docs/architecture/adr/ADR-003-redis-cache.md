# ADR-003：Redis 作为统一缓存层及其接入基线

## 状态

待确认（Pending）

> 状态枚举遵循 `AGENTS.md` §9：草稿 Draft → 待确认 Pending → 已确认 Confirmed。2026-10-14 随 plan 阶段产出为 Draft；2026-10-15 实现与全量验证完成，转 Pending 待人工评审。

## 日期

2026-10-14

## 背景与约束

- 项目技术栈基线已包含 Redis（AGENTS §2：redis 4，定位为缓存层，支撑会话与令牌存储）；但当前应用只接入了 MongoDB，尚无任何 Redis 连接与缓存代码。
- 后续"登录态/令牌、验证码、热点资料"等能力都需要一个临时、可过期、可重建的键值存储；若各模块自建连接、自定读写方式，会出现连接泄漏、永久键、键冲突与日志泄密等问题。
- 宪法原则 IV 已明确："缓存 MUST 统一封装，Controller MUST NOT 直接操作 Redis；基础设施 MUST NOT 直接暴露给用户。"
- 本决策只覆盖**缓存基础设施基线**；登录、鉴权、具体业务缓存不在范围内（另立规格）。
- 部署规模为博客级单实例 Redis（本地 4.0.11），不预设集群/哨兵。

## 决策

采用 **Redis（ioredis 5 客户端）** 作为唯一缓存中间件，并以"一个全局模块 + 一个统一服务"作为接入基线：

1. 引入 `ioredis@^5`（自带类型、内置自动重连），不使用 node-redis，也不引入第三方 Nest Redis 封装；依赖变更经人工评审。
2. 新增 `@Global() CacheModule`（`src/common/cache/`），由 IoC 容器持有唯一 Redis 连接（单例），经 `ConfigService` 从环境变量读取连接配置，禁止硬编码、禁止业务代码 `new Redis`。
3. 业务模块只注入并使用 `CacheService`：`set(key, value, ttlSeconds)`（**TTL 必填且为正整数，不提供永久写入口**）、`get<T>(): T | null`（未命中返回 null）、`del`（幂等）。ioredis 客户端不导出给业务模块。
4. **启动 fail-fast**：客户端 `lazyConnect`，模块初始化时执行一次 `ping` 校验，配置缺失或连不通即中止启动并输出明确错误。
5. **运行期行为**：自定义线性退避自动重连（`min(times*100,2000)` ms，封顶 2s、永不放弃；恢复后无需重启）；`enableOfflineQueue:false` + `maxRetriesPerRequest:3`，断连期命令立即失败、不排队、不静默成功；缓存层**只上抛错误，不内置静默降级/回源**（降级由业务模块决定）。
6. 健康检查新增自定义 Redis 指示器，并入现有 `/health/ready`（沿用 5s 节流），`/health/live` 不依赖缓存；terminus 9 已无内置 Redis 指示器。
7. **键隔离**：ioredis `keyPrefix` 自动附加环境前缀（`REDIS_KEY_PREFIX`，缺省取 `NODE_ENV`），业务 key 自带命名空间；默认逻辑库 db 0，`REDIS_DB` 可覆盖。
8. 值统一 JSON 编解码；连接错误日志只含 host:port:db 与错误信息，不含密码、不打印缓存值。
9. 本期不建设分布式锁、事务、管道、发布订阅及多实例/集群能力，有具体业务需求时另立规格扩展（YAGNI）。

## 考虑的替代方案

- **node-redis（官方 `redis@4`）**：功能等价且同为主流。未选原因：断连期默认命令等待重连，要做到"离线立即失败"需额外配置 socket 重连策略；terminus 历史 Redis 指示器基于 ioredis；综合"启动校验 + 离线快速失败 + 健康检查"，ioredis 代码更少、语义更直接。并非 node-redis 不可用，未来如需可平滑替换（仅 `CacheService` 内部实现变化，对业务模块零影响——这正是统一封装的价值）。
- **第三方 Nest 封装（`@liaoliaots/nestjs-redis`、`@nestjs-modules/ioredis`）**：提供多实例管理与装饰器，但本功能只需单实例 + get/set/del，引入即过度抽象，且多一个供应链审查面。
- **各模块直连 ioredis（不做统一层）**：最少文件，但违反宪法原则 IV（缓存必须统一封装、Controller 不得直连），无法强制 TTL、键前缀与日志脱敏，连接可能被重复创建。明确否决。
- **缓存层内置降级（断连自动回 MongoDB / 返回旧值）**：会让调用方拿到不确定状态，违背原则 IV"外部调用失败 MUST 可降级或明确上抛，MUST NOT 返回不确定状态"。本期选择"明确上抛"，把"是否降级、如何回源"留给了解业务语义的业务模块。
- **带备缓存启动（连不上也照常启动）**：可用性看似更高，但会把配置错误/依赖缺失推迟到线上首次调用才暴露；基础设施类依赖采用 fail-fast 更安全，由进程编排负责重启。

## 重新评估条件

出现以下任一情况，应重新评估本决策：

- 出现多实例/多租户/集群、读写分离需求，单实例 + keyPrefix 隔离不足。
- 业务需要分布式锁、限流原语、发布订阅或多键原子操作，超出 get/set/del 能力。
- 需要跨服务共享缓存且引入服务网格/统一缓存代理，客户端直连模式不再合适。
- node-redis 在重连/可观测上显著优于 ioredis，或 ioredis 停止维护，触发客户端重选（因有统一封装，替换成本限于基础设施内部）。
- 缓存演变为权威数据存储（本决策假设其仅为可重建临时层）——一旦缓存承载不可丢数据，需重新设计持久化与一致性方案。

## 后果

### 正面

- 业务模块接入缓存零连接管理成本，且从方法签名上强制 TTL，杜绝永久键。
- 连接、重连、超时、健康检查、日志脱敏集中一处实现与审计。
- fail-fast + readiness 让缓存故障在启动与运行期都可被快速发现。
- 统一封装使未来替换客户端（ioredis ↔ node-redis）不影响业务代码。
- 缓存非权威数据，回滚/清空无不可逆损失，发布风险低。

### 负面

- 多一层封装，业务方只能用统一服务暴露的能力（本期刻意只给 get/set/del），高级用法需先扩规格。
- fail-fast 意味着 Redis 不可用时应用无法启动——对"缓存挂了也要能服务"的场景需要业务侧后续引入回源降级（本期明确不做）。
- 所有值经 JSON 编解码，不适合存放超大二进制或需要富数据结构（hash/zset）的场景（本期无此需求）。

### 中性

- 团队需遵守键命名空间与 TTL 约定（写入 design 与 data-model）。
- 本地开发需额外启动 Redis（AGENTS §2.3 已含）。
- E2E 健康检查依赖本地 Redis 在运行。

## 相关文档

- 实现设计：[Redis + NestJS 集成设计文档](../design/redis-integration-design.md)
- 规格：[specs/002-redis-integration/spec.md](../../specs/002-redis-integration/spec.md)
- 上游：[ADR-001 采用 MongoDB 作为核心数据存储](./ADR-001-mongodb.md)（缓存为其之上的临时加速层，权威数据仍在 MongoDB）
- 宪法原则：`.specify/memory/constitution.md` II / IV / V

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-14 @架构组 + AI：初始版本（Draft），随 002 plan 阶段产出，待评审。
