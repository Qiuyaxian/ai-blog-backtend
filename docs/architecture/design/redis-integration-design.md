# Redis + NestJS 集成设计文档

> 状态：已确认（Confirmed）
> 日期：2026-10-14（2026-10-15 实现完成，Draft → Pending；同日 OCR 评审通过并修复意见后 → Confirmed）
>
> 状态枚举遵循 `AGENTS.md` §9：Draft → Pending → Confirmed。本文档是 [ADR-003](../adr/ADR-003-redis-cache.md)（Confirmed）的实现展开。

## 1. 概述

**文档目的**：定义 Redis 缓存层在 NestJS 应用中的集成方案：模块结构、连接配置、统一缓存服务、健康检查、安全与异常行为，作为开发与后续业务模块接入的实现依据。

**适用范围**：仅缓存**基础设施**。登录态/令牌、验证码、业务数据缓存不在本期。

**技术栈**：

| 组件             | 版本                | 用途                                                |
| ---------------- | ------------------- | --------------------------------------------------- |
| NestJS           | 9.x                 | 应用框架（仓库基线）                                |
| ioredis          | 5.x                 | Redis 客户端（自带类型、内置重连）                  |
| @nestjs/config   | 2.x                 | 配置管理（已装）                                    |
| @nestjs/terminus | 9.2.2               | 健康检查框架（已装，无内置 Redis 指示器，需自定义） |
| Redis            | 4.0+（本地 4.0.11） | 缓存中间件                                          |

> ioredis 当前未安装，属新增依赖，需人工评审后执行 `pnpm add ioredis@^5`；AI 不自行安装（AGENTS §7 / 宪法）。v5 自带类型，无需 `@types/ioredis`。

数据流：业务模块注入 `CacheService` → 经 ioredis 单例连接读写 Redis；Controller 不接触缓存；健康检查经自定义指示器对 Redis 发 `PING`。

```text
业务 Service
   │ 注入（@Global，仅 CacheService 可见）
   ▼
CacheService（set 必带 TTL / get 未命中 null / del 幂等，JSON 编解码）
   │ 持有（token 不导出）
   ▼
ioredis 单例（lazyConnect、enableOfflineQueue:false、自动重连、keyPrefix）
   ▼
Redis
```

## 2. 模块结构

```text
src/common/cache/
├── cache.module.ts       # @Global()；提供 REDIS_CLIENT（异步工厂，启动 ping 校验）、CacheService、RedisHealthIndicator
├── cache.constants.ts    # 注入 token、配置键/默认值常量
├── redis.config.ts       # buildRedisOptions(ConfigService): RedisOptions 纯函数
├── cache.service.ts      # 统一缓存服务（业务唯一入口）
├── redis.health.ts       # RedisHealthIndicator extends HealthIndicator
├── cache.service.spec.ts
└── redis.health.spec.ts
```

约定：

- 缓存为横切基础设施，放 `src/common/cache/`（与 `common/filters`、`common/interceptors` 同级），不归属任何业务模块。
- `CacheModule` 标 `@Global()` 且 `exports: [CacheService, RedisHealthIndicator]`；**不导出 `REDIS_CLIENT`**，从结构上阻止业务绕过封装（宪法原则 II/IV）。
- 在 `AppModule` 中于 `HealthModule` 之前注册 `CacheModule`（健康控制器需注入其指示器）。

## 3. 连接与配置

### 3.1 环境变量

```bash
# .env.local（本地无密码）；.env.uat/.env.prod 由运维补，密码不入库
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=local:
```

- 经全局 `ConfigModule` 读取（已 `isGlobal`），不重复声明。
- `REDIS_KEY_PREFIX` 缺省取 `` `${NODE_ENV || 'local'}:` ``；host 必填，缺失则启动显式抛错，不给默认地址（FR-008）。

### 3.2 `redis.config.ts`（纯函数，对齐 `src/mongoose.config.ts`）

`buildRedisOptions(config: ConfigService): RedisOptions` 组装：

| 选项                                | 值 / 规则                                                   | 理由                                                        |
| ----------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `host` / `port` / `password` / `db` | 来自 env；无密码时不传 password                             | 配置外置（FR-007）                                          |
| `keyPrefix`                         | `REDIS_KEY_PREFIX`                                          | 环境键隔离（FR-013）                                        |
| `lazyConnect`                       | `true`                                                      | 延迟连接，交由工厂内 `ping` 做启动校验（fail-fast）         |
| `enableOfflineQueue`                | `false`                                                     | 断连期命令立即失败，不排队挂起（FR-010）                    |
| `maxRetriesPerRequest`              | `3`                                                         | 限制单命令抖动期重试，不无限等待                            |
| `connectTimeout`                    | `5000`（ms）                                                | 建连超时上限，启动 ping 不被无限阻塞                        |
| `commandTimeout`                    | `3000`（ms）                                                | 命令超时                                                    |
| `retryStrategy`                     | 自定义线性退避 `min(times*100, 2000)` ms，封顶 2s，永不放弃 | 自动重连（FR-011）；初期重连比 ioredis 默认 `times*50` 略快 |
| `maxRetriesPerRequest` 连接级       | 见上                                                        | 与单命令一致                                                |

### 3.3 连接 provider（启动 fail-fast）

`CacheModule` 用异步工厂提供 `REDIS_CLIENT`：

1. `new Redis(buildRedisOptions(config))`（lazy，构造不连）。
2. 注册 `client.on('error', ...)`：用 Nest `Logger` 打结构化错误（host:port:db + 错误名/首行，**不含 password**），对齐 `mongoose.config.ts` 的 `connectionFactory` 处理（避免错误被吞）。
3. `await client.ping()`：成功才返回实例；失败则 `client.disconnect()` 并 reject → Nest 启动中止（FR-008）。
4. 应用关闭经已启用的 `app.enableShutdownHooks()`（`main.ts` 已有）触发 `OnModuleDestroy` 调用 `client.quit()` 优雅释放。

## 4. CacheService（业务唯一入口）

完整方法契约见 [specs 接口契约](../../specs/002-redis-integration/contracts/cache-service.md)。要点：

```typescript
export interface CacheService {
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
}
```

- `set`：校验 `ttlSeconds` 为正整数（否则 `RangeError`），`JSON.stringify(value)` 后 `client.set(key, json, 'EX', ttl)`；无永久写入口（FR-004）。
- `get`：`client.get(key)`，`null` 原样返回（未命中，FR-005）；有值则 `JSON.parse`，解析失败抛错不吞。
- `del`：`await client.del(key)`，不存在不报错（幂等，FR-006）。
- 所有方法在断连期因 `enableOfflineQueue:false` 立即 reject；**不做 try/catch 静默、不做回源**（FR-010，降级归业务）。

业务键命名规范见 [data-model §2](../../specs/002-redis-integration/data-model.md)：`<环境前缀自动><业务域>:<标识>`，如 `user:65ab...`。

## 5. 健康检查

terminus 9.2.2 无内置 Redis 指示器，自写：

```typescript
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }
  async isHealthy(key = 'redis') {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (e) {
      this.getStatus(key, false, { message: (e as Error).message });
      throw new HealthCheckError(`${key} failed`, e); // terminus 聚合为 503
    }
  }
}
```

`HealthController.ready()` 的检查数组由仅 mongodb 追加 redis：

```typescript
this.health.check([
  () => this.mongooseIndicator.pingCheck('mongodb'),
  () => this.redisIndicator.isHealthy('redis'),
]);
```

- 复用现有 5s `PING_CACHE_TTL_MS` 节流与失败不缓存逻辑；任何一项 down → 503。
- `/health/live` 不改动，不触碰 Redis（避免缓存抖动引发重启）。

## 6. 安全设计

- **凭证**：密码只从 env 注入，不硬编码、不进仓库；`.env.*` 按 AGENTS §8 白名单管理。
- **日志脱敏**：错误/连接日志只出现 `host:port:db`、错误名与首行信息；禁止打印 password、连接串、key 对应的 value（FR-012）。
- **统一入口**：Controller 禁止注入 Redis；业务只经 `CacheService`；Redis 不直接暴露给用户（宪法 IV）。
- **数据约束**：不缓存明文密码/令牌等敏感值；令牌类 key 使用不可猜测标识（后续登录功能承接）。
- **网络**：生产 Redis 部署于内网，限制可访问 CIDR；是否启用 TLS/ACL 账号由运维在 uat/prod 配置（本地无鉴权）。

## 7. 异常与可靠性

| 场景                       | 行为                                                            |
| -------------------------- | --------------------------------------------------------------- |
| 缺 host / 配置非法         | 启动抛错中止                                                    |
| 启动时连不通               | `ping` 失败，启动中止并打印真实原因                             |
| 运行期断线                 | 自定义线性退避自动重连（times\*100，封顶 2s）；期间命令立即失败 |
| 单命令抖动                 | 最多重试 3 次后 reject                                          |
| 恢复后                     | 自动恢复，无需重启                                              |
| JSON 序列化/反序列化失败   | 明确 reject，不返回不确定状态                                   |
| 缓存整体不可用对业务的影响 | 由业务模块决定回源/报错，基础设施不内置降级                     |

> `ponytail:` 已知天花板：本期单实例 Redis、单连接，无集群/哨兵/读写分离；健康检查仅做 PING 不做延迟/容量阈值。升级路径：博客量级增长后引入托管高可用实例与多实例配置，`CacheModule` 内部扩展而业务接口不变。

## 8. 测试策略

- **单测（mock ioredis，不依赖真实 Redis）**：
  - `redis.config`：env → 选项映射、缺 host 抛错、keyPrefix 默认值、离线队列/lazyConnect 置位。
  - `CacheService`：set 带 TTL 的命令参数、get 命中/未命中、del 幂等、非法 TTL 抛 `RangeError`、脏 JSON 抛错、断连 reject。
  - `RedisHealthIndicator`：ping 成功返回 up；失败抛 HealthCheckError。
  - `createRedisClient` 工厂（mock ioredis）：connect+ping 成功才返回；缺 host 不触网直接抛错；ping 失败 disconnect 并 reject；error 事件日志只含 host:port/db 与错误首行，不含密码。
- **E2E（需本地 Redis）**：新增 `test/redis-health.e2e-spec.ts`，`GET /health/ready` 返回 200 且含 `details.redis.status=up`；确认 mongodb 项仍在、节流不回归。
  - 实现期补漏（偏差记录）：E2E 此前不设 `NODE_ENV`，`.env.local` 不被加载；Mongoose 靠默认 URI 侥幸通过，Redis 无默认地址导致 fail-fast。新增 `test/setup-env.ts` 并在 `test/jest-e2e.json` 的 `setupFiles` 注册，在任何模块 import 前设 `NODE_ENV=local`；旧 `app.e2e-spec.ts` 同步受益。
- 遵循宪法原则 III，tasks.md 中生产代码任务一律 RED→GREEN→REFACTOR；纯配置/文档任务标 `[no-test]`。

## 9. 部署与运维

- 本地：按 AGENTS §2.3 启动 `redis-server`（4.0.11，默认 6379）。
- 新增环境变量需同步 uat/prod；密码由运维/密钥管理注入。
- 回滚：移除 `AppModule` 中的 `CacheModule` 注册与依赖即可；无数据迁移，缓存清空不造成不可逆损失。
- 监控/告警阈值（连接数、内存、命中率、延迟）属统一可观测设施，本期只保证健康检查与错误日志，不建指标导出。

## 10. 参考文档

- [ADR-003 Redis 作为统一缓存层及其接入基线](../adr/ADR-003-redis-cache.md)
- [ioredis 官方文档（自动重连/离线队列）](https://github.com/redis/ioredis)
- [NestJS Terminus 自定义健康指示器](https://docs.nestjs.com/recipes/terminus)
- 同层基础设施参考：[MongoDB 集成设计](./mongodb-integration-design.md) §5.1 健康检查（liveness/readiness 分离、ping 节流）

## 11. 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-15 @架构组 + AI：实现与全量验证完成，OCR 评审 4 条意见修复（退避描述对齐为线性 `times*100`、补 CacheService 键守卫、修正健康检查注释、加固工厂测试 mock），Pending → Confirmed。
- 2026-10-14 @架构组 + AI：初始版本（Draft），随 002 plan 阶段产出，待评审。
