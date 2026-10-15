# Phase 0 研究记录：Redis 缓存基础设施

**日期**：2026-10-14
**对应规格**：[spec.md](./spec.md)、[plan.md](./plan.md)

> 研究目标：解决 plan 技术上下文中的实现选型，回答"用什么客户端、怎么满足 fail-fast/自动重连/TTL 必填/健康检查/键隔离"。所有结论为 ADR-003 的支撑论据。

## R1. Redis 客户端选型：ioredis 5

**Decision**：采用 [`ioredis@^5`](https://github.com/redis/ioredis)，不使用 Node 官方 `redis@4`（node-redis），本期也不引入 `@nestjs-modules/ioredis`、`@liaoliaots/nestjs-redis` 等第三方 Nest 封装。

**Rationale**：

- 自带 TypeScript 类型，无需额外 `@types`；v5 长期维护、下载量大、在 NestJS 社区是事实主流。
- 内置**自动重连 + 退避重连（默认线性）+ 命令重发**，配合自定义 `retryStrategy` 直接满足 FR-011（断线恢复后无需重启）。
- 构造选项 `lazyConnect`、`enableOfflineQueue`、`keyPrefix`、`maxRetriesPerRequest` 精确覆盖本功能的 fail-fast、断连快速失败、键隔离需求，无需自造。
- 不引第三方 Nest 封装：本功能只需要一个单例连接 + 一个薄封装 Service，用官方 `@nestjs/common` 的 provider 工厂即可，额外封装层（模块/多实例/manager 抽象）超出需求（宪法 YAGNI、plan FR-014）。

**Alternatives considered**：

- **node-redis (`redis@4`)**：官方客户端，也支持自动重连与类型。但 v4 改为 Promise 后断连期默认命令会一直等待重连（socket reconnect 策略需自行配置才能快速失败），且 `@nestjs/terminus` 历史内置 Redis 指示器正是基于 ioredis API；ioredis 在"启动校验 + 离线快速失败"这两点的选项更直接、代码更少。两者功能都够用，选 ioredis 主要因为健康检查与重连语义的实现成本更低。
- **`@liaoliaots/nestjs-redis` / `@nestjs-modules/ioredis`**：提供模块装饰器与多实例管理。本功能只有单实例、只要 get/set/del，引入即过度抽象；额外依赖也增加供应链审查面（宪法：未经验证依赖不引入）。
- **直接裸 `redis` npm 老包（v3 回调式）**：已停止维护，排除。

**依赖落地**：ioredis 当前未在 `package.json` 中。按 AGENTS §7 / 宪法，依赖变更需人工评审；tasks.md 中将安装列为首个任务并标注需人工确认，AI 不自行安装。版本钉 `ioredis@^5`，与 Node 20、Redis 4/6/7 服务端均兼容（本地服务端为 4.0.11）。

## R2. 健康检查：自定义 HealthIndicator

**Decision**：在 `src/common/cache/redis.health.ts` 自写 `RedisHealthIndicator extends HealthIndicator`，用 `client.ping()` 判定；通过 `HealthCheckService.check([...])` 并入现有 `/health/ready`。

**Rationale**：

- 实测已安装的 `@nestjs/terminus@9.2.2`：`dist/health-indicator/` 下仅 `database/disk/http/memory/microservice`，**已无 Redis 指示器**（terminus 8 的 `RedisHealthIndicator` 被移除，因其强耦合 ioredis）。因此不能照抄 MongoDB 的 `MongooseHealthIndicator.pingCheck`。
- terminus 9 官方推荐做法就是继承 `HealthIndicator`，在自定义指示器内调用客户端并返回 `getStatus(key, isHealthy, {data})`，与现有 HealthCheck 结果结构天然一致。

**Alternatives considered**：

- **降级 terminus 到 8 用内置 RedisHealthIndicator**：会拖垮已用的 Mongoose 指示器与 Nest 9 基线，否决。
- **在 controller 里直接 `ping()` 不走 HealthIndicator**：能跑但结果结构、`@HealthCheck()` 聚合与错误状态码要自己拼，且和 MongoDB 检查风格不一致；自定义指示器是 terminus 9 既定扩展点，代码量相当但更规范。

健康项键名定为 `redis`，与 `mongodb` 平级；失败时 `check` 抛出的错误由 terminus 转为 503，和 MongoDB 失败行为一致。

## R3. 启动 fail-fast 校验

**Decision**：Redis 客户端以 `lazyConnect: true` 创建（构造时不自动连），在 `CacheModule` 的连接 provider 工厂中 `await client.ping()`（带 `connectTimeout`/`commandTimeout` 上限）；ping 失败则 provider reject → Nest 启动失败并打印真实原因。成功后把实例注入容器。

**Rationale**：

- FR-008 要求配置缺失/无法连通时启动即明确失败，不能"启动成功、首次调用才报错"。
- Nest 异步 provider（`useFactory` 返回 Promise）在初始化阶段 await，reject 会中止 `NestFactory.create` / `listen`，天然实现 fail-fast，无需在 `main.ts` 额外写启动探测。
- 与现有 Mongoose 的差异：Mongoose 自带启动重试且日志会吞真实原因（见 `mongoose.config.ts` 的 `connectionFactory` 注释），Redis 侧用一次显式 ping 拿到明确的 ECONNREFUSED/认证错误。

**Alternatives considered**：

- **非 lazy、依赖 `error` 事件判断启动**：ioredis 默认后台重连，连接失败不阻塞启动，违背 fail-fast，否决。
- **在 `OnModuleInit` 里 ping 但不阻塞**：带病启动，否决。
- **连接成功才暴露服务、否则继续重试 N 次**：引入启动重试策略，超出"明确失败"要求；本期让编排层（人工/进程管理）负责重启，YAGNI。

配置缺失（无 host）同样在工厂内显式抛错，不以默认值静默连向非预期地址。

## R4. 运行期断连：自动重连 + 离线命令立即失败

**Decision**：

- `retryStrategy`：自定义**线性**退避 `Math.min(times * 100, 2000)`（封顶 2s，永不放弃），满足自动重连（FR-011）。
  - 说明（实现期核实，修正初稿"用默认指数退避"的错误描述）：ioredis 5.11.1 内置默认也是**线性** `Math.min(times * 50, 2000)`，并非指数退避；本期用 `times * 100` 让初期重连略快于默认（第 20 次到 2s 封顶，默认第 40 次到顶），封顶值一致。
- `enableOfflineQueue: false`：连接未就绪时，命令**立即 reject**而不是排队等待，配合 `maxRetriesPerRequest: 3` 限制单次命令重试。

**Rationale**：

- FR-010：失败必须让调用方可感知，不能静默成功，也不能让请求无限挂起占满连接。关闭离线队列后，断连期 `get/set/del` 立即抛错，业务层据此自行决定回源或报错（规格已拍板：缓存层不内置静默降级）。
- 重连成功后命令自动恢复，无需重启（FR-011），无需应用层干预。

**Alternatives considered**：

- **保留离线队列（默认 true）**：断连期请求排队等重连，可能长时间挂起、堆积，超时语义不清，违背"明确失败"，否决。
- **`maxRetriesPerRequest: null` 永不放弃单命令**：会让请求在抖动期无限等待，否决。

## R5. TTL 必填、禁永久键

**Decision**：`CacheService` 只暴露 `set<T>(key, value, ttlSeconds)`，`ttlSeconds` 为必填且必须为正整数；内部 `set(key, json, 'EX', ttl)`。不提供无 TTL 的写入方法。

**Rationale**：

- FR-004 要求从接口层面杜绝永久键。若暴露裸客户端或可选 TTL，调用方很容易漏写。把约束做进方法签名（必填参数 + 运行时校验抛错）是最小且不可绕过的保证。
- 统一用秒级 `EX`，避免不同调用方混用秒/毫秒；非法 TTL（≤0、非整数、NaN）在信任边界直接抛 `RangeError`。

**Alternatives considered**：

- **TTL 可选、默认一个大值**：仍可能写出超长寿命键，且"默认值"会被当作永久键用，违背规格。
- **提供 `set` + `persist` 两个方法**：无业务需要，违反 FR-014，不做。

## R6. 值序列化与未命中语义

**Decision**：

- `set` 统一 `JSON.stringify`，`get` 统一 `JSON.parse`；`get<T>` 泛型返回 `Promise<T | null>`，未命中（客户端返回 `null`）或键不存在一律返回 `null`（FR-005）。
- 解析失败（缓存里是非 JSON 脏值）明确抛错，不吞异常。
- `del` 对不存在的键幂等成功（ioredis `del` 本就返回删除数、不存在不报错）（FR-006）。

**Rationale**：调用方拿到的永远是对象/原始值或 `null`，不接触 Redis 的字符串表示；未命中与异常严格区分。

**边界（本期不处理，记录天花板）**：不区分"缓存了 null"与"未命中"（`ponytail:` 缓存穿透防护由后续业务接入选型，可用空值占位或负缓存，非基础设施职责）；不做压缩、不支持 Buffer/自定义序列化器（无需求）。

## R7. 键隔离：环境前缀 + 业务前缀

**Decision**：

- ioredis `keyPrefix` 设为环境级前缀（配置项 `REDIS_KEY_PREFIX`，缺省取 `NODE_ENV`，如 `local:`），客户端自动给所有键加前缀，调用方无感——保证不同环境即使连同一实例也互不可见（FR-013）。
- 业务模块在自己传入的 key 内再带业务命名空间（约定 `user:`、`session:` 等），写进 design 命名规范；基础设施不做业务去重。
- 本地/默认连逻辑库 `db 0`，`REDIS_DB` 可覆盖；不强依赖多逻辑库做环境隔离（前缀已够，逻辑库留给运维需要时使用）。

**Alternatives considered**：

- **仅靠逻辑库 db 编号隔离环境**：需要为每环境维护不同 db 号、易配错，且 db 数量有限；前缀更显式、键名自带环境信息，排查友好。两者可叠加，前缀为主。
- **不加前缀、靠约定**：无强制力，违背 FR-013，否决。

## R8. 配置项与凭证安全

**Decision**：新增环境变量（写入 `.env.local`，`.env.uat/.env.prod` 由运维补）：

```bash
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=        # 本地无密码留空；uat/prod 必填，不入库真实值
REDIS_DB=0
REDIS_KEY_PREFIX=local:
```

连接在 `buildRedisOptions(ConfigService)` 纯函数中组装（对齐 `src/mongoose.config.ts`），含 `connectTimeout`/`commandTimeout`/`lazyConnect`/`enableOfflineQueue`/`retryStrategy`。密码只经 env 注入，代码不硬编码（FR-007）。错误事件日志只输出 `host:port:db` 与错误名/首行信息，**不输出 password，不输出缓存值**（FR-012）。

**Alternatives considered**：单条 `REDIS_URL` 形式（含密码）也行，但拆分 host/port/db/前缀更便于拼健康展示与日志脱敏；与 MONGODB_URI 风格不同是因为 Redis 选项需要单独喂给 ioredis 且要避免把密码打进日志。后续若运维坚持 URL 形式，可平滑加一个 `REDIS_URL` 解析，不影响 Service 层。

## 研究结论汇总（供 tasks 映射）

| 结论                                                                                          | 满足 FR                |
| --------------------------------------------------------------------------------------------- | ---------------------- |
| ioredis 5，单例、无第三方 Nest 封装                                                           | FR-002/003             |
| 自定义 RedisHealthIndicator，并入 /health/ready 5s 节流                                       | FR-009                 |
| lazyConnect + 工厂内 ping，失败中止启动                                                       | FR-008                 |
| enableOfflineQueue:false + maxRetriesPerRequest:3 + 自定义线性退避重连（times\*100，封顶 2s） | FR-010/011             |
| set 必填正整数 TTL，无永久写入口                                                              | FR-004                 |
| get JSON 往返、未命中 null；del 幂等；解析失败抛错                                            | FR-005/006             |
| keyPrefix 环境前缀 + 业务 key 命名空间                                                        | FR-013                 |
| env 配置、日志脱敏、只导出 Service 不导出客户端                                               | FR-007/012，宪法 II/IV |
| 不建锁/事务/管道/发布订阅                                                                     | FR-014                 |
