# 验证指南：Redis 缓存基础设施（Quickstart）

**对应规格**：[spec.md](./spec.md) | **契约**：[cache-service.md](./contracts/cache-service.md)
**目的**：本功能落地后，用下列可运行步骤端到端证明"统一缓存服务、健康检查、异常行为"成立。不含完整实现代码，只给验证路径与预期。

## 1. 前置条件

1. Node 20（`node -v` ≥ 20，见 `.nvmrc`）+ pnpm 9。
2. 本地 Redis 在跑（AGENTS §2.3）：

```bash
cd /usr/local/redis-4.0.11
redis-server
# 另开终端确认
redis-cli ping    # PONG
```

3. `.env.local` 含（tasks 安装任务会补）：

```bash
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=local:
```

4. 已安装依赖（含人工评审后的 `ioredis@^5`）：`pnpm install`。

## 2. 自动化验证

```bash
# 静态检查
pnpm lint

# 单元测试（不依赖真实 Redis：mock 客户端）
pnpm test
# 覆盖点：
#  - buildRedisOptions 读取 env、缺 host 抛错、组装 lazyConnect/离线队列/keyPrefix
#  - CacheService：set 带 TTL 往返 / get 未命中为 null / del 幂等 / 非法 TTL 抛 RangeError / JSON 脏值抛错
#  - RedisHealthIndicator：ping 成功 up、失败 down

# E2E（需要本地 Redis 在跑；自举应用）
pnpm test:e2e
# redis-health.e2e-spec：GET /health/ready 返回 200 且 details.redis.status == "up"
```

预期：全部退出码 0，无失败。

## 3. 手工端到端验证

### 3.1 正常读写往返（对应 P1 验收）

通过一个注入 `CacheService` 的临时校验（或在后续业务模块中），执行：

1. `set('probe:k1', { hello: 'world' }, 30)` → 成功。
2. `redis-cli` 查物理键：`KEYS 'local:probe:*'` 能看到带 `local:` 前缀的键；`TTL local:probe:k1` 返回 ≤ 30 的正数。
3. `get<{hello:string}>('probe:k1')` → 深等于写入对象。
4. `del('probe:k1')` 后再 `get` → `null`；再次 `del` 不报错（幂等）。

### 3.2 TTL 到期（对应 P1 验收 3）

1. `set('probe:ttl', 1, 1)`（1 秒）。
2. 立刻 `get` → 1；等待 > 1 秒后 `get` → `null`，`redis-cli` 中键已消失。
3. 代码层确认无任何"不带 TTL"的写入口（只存在一个三参 `set`）。

### 3.3 健康检查翻转（对应 P2 验收）

1. Redis 正常：`curl -s localhost:3000/health/ready` → `status:"ok"`，`details.redis.status:"up"`。
2. 停掉 Redis（`redis-cli shutdown` 或 Ctrl+C）：再次请求 → HTTP 503，`error.redis.status:"down"`。
3. 重启 Redis：再请求 → 恢复 `up`（**应用不重启**，验证自动重连，FR-011）。
4. `curl -s localhost:3000/health/live` 全程只反映进程存活，不依赖 Redis。

### 3.4 启动 fail-fast（对应 P3 验收 1）

1. Redis 未启动时执行 `pnpm run start:local`。
2. 预期：启动失败并打印明确连接错误（ECONNREFUSED 等，含目标 host:port、不含密码），应用不进入监听。
3. 启动 Redis 后再启动 → 成功。

### 3.5 日志脱敏检查（对应 P3 验收 4）

1. 制造一次连接错误（如填错端口启动，或运行中断 Redis）。
2. 检查日志：含 `host:port/db` 与错误信息；**grep 不到密码、不打印缓存值**（FR-012）。

## 4. 回归边界

- `/health/ready` 中 `mongodb` 项行为不变；5s 节流仍生效（连续请求只 ping 一次）。
- 现有 001 用户模块全部单测/E2E 保持绿色（新增模块为全局基础设施，不改变用户接口语义）。
