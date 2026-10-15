# 接口契约：统一缓存服务（CacheService）

**日期**：2026-10-14 | **对应规格**：[spec.md](../spec.md) FR-001~006、FR-010

> 本期**无对外 HTTP 接口**。唯一契约是基础设施层暴露给业务模块的内部服务 `CacheService`，以及健康检查端点的增量。本文档定义其方法签名与行为，供 tasks 实现与后续模块接入。

## 1. 注入方式

`CacheModule` 为 `@Global()`，业务模块无需 import 即可在构造函数注入：

```typescript
constructor(private readonly cache: CacheService) {}
```

- 业务代码 MUST 只依赖 `CacheService`，MUST NOT 注入 ioredis 客户端（客户端 token 不导出）。
- Controller MUST NOT 直接操作缓存（宪法原则 IV）。

## 2. 方法契约

### 2.1 `set`：写入（TTL 必填）

```typescript
set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
```

| 输入         | 规则                                                        |
| ------------ | ----------------------------------------------------------- |
| `key`        | 非空字符串；调用方负责业务命名空间（见 data-model §2）      |
| `value`      | 任意可 JSON 序列化值；不得含明文密码/令牌等敏感值           |
| `ttlSeconds` | **必填**，正整数（秒）；`≤0`、非整数、`NaN` 抛 `RangeError` |

行为：以 JSON 字符串写入并设置过期；底层等价 `SET <prefix+key> <json> EX <ttl>`。无永久写入入口（FR-004）。

失败：连接不可用/超时 → reject（`enableOfflineQueue:false` 时立即失败），MUST NOT 静默成功（FR-010）。

### 2.2 `get`：读取（未命中返回 null）

```typescript
get<T>(key: string): Promise<T | null>
```

| 返回                 | 含义                                             |
| -------------------- | ------------------------------------------------ |
| `T`（JSON.parse 后） | 键存在且未过期                                   |
| `null`               | 键不存在或已过期（未命中，FR-005）；不与异常混淆 |

异常：值不是合法 JSON（脏值）→ 抛错，不返回 `null` 掩盖问题；连接失败 → reject。

### 2.3 `del`：删除（幂等）

```typescript
del(key: string): Promise<void>
```

行为：删除键；键不存在也成功（FR-006），不抛"不存在"错误。连接失败时 reject。

## 3. 错误语义汇总

| 情形                     | 行为                        |
| ------------------------ | --------------------------- |
| 未命中                   | `get` 返回 `null`（非异常） |
| 非法 TTL                 | 同步/异步抛 `RangeError`    |
| 序列化失败（循环引用等） | reject，错误由调用方处理    |
| 反序列化失败（脏值）     | reject，不吞异常            |
| 断连期调用               | 立即 reject（离线队列关闭） |
| 重连成功后调用           | 自动恢复，无需重启          |

> 缓存层**不内置降级/回源**：所有失败明确上抛，是否回 MongoDB 由业务模块决定（spec 边界场景拍板）。

## 4. 健康检查端点（增量）

现有 `/health/ready` 的检查结果新增 `redis` 项，与 `mongodb` 平级；复用控制器 5s 结果节流：

正常：

```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

Redis 不可用：`status` 变为 `error`，HTTP 503，`error.redis.status = "down"`（具体包裹以 terminus 输出为准）。

- `/health/live` 不变：只返回进程存活，不触碰 Redis/MongoDB。
- Redis 检查基于一次 `PING`，不返回任何缓存数据。
