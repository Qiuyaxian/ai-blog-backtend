# 数据模型：用户登录鉴权

**Feature**：003-user-login | **Date**：2026-10-22

本功能**不新增、不修改 Mongo 集合/Schema**（expand-contract 的零变更面）；新增数据全部为 Redis 中带 TTL 的临时状态。

## 1. Mongo（复用，只读协作）

复用 001 的 `users` 集合。鉴权链路只经 `UserService` 暴露的只读方法访问，不直连其 Schema 写数据。

| 用途         | 查询                                                                          | 投影/条件                                                                                                      |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 登录定位账号 | `findOne({ $or: [{ usernameLower: key }, { email: key }], deletedAt: null })` | 需 `password` 字段 → 查询显式带上（该字段 `select:false`，方法内用 `.select('+password ...')` 或等价显式投影） |
| 鉴权回查账号 | `getAuthPrincipal(id)`                                                        | `{ _id: id, deletedAt: null }`，投影 `_id, isAdmin, deletedAt`；查不到 → 软删/不存在                           |

唯一性由既有索引保证：`usernameLower` 唯一、`email` 唯一；`$or` 最多命中一条，理论双命中取 email 命中者（research R3）。

## 2. Redis 键（全部经 CacheService，ioredis keyPrefix 自动加环境前缀，如 `local:`）

| 键（逻辑名）                | 值                               | TTL                             | 写入/删除时机                                                                     | 对应 FR        |
| --------------------------- | -------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- | -------------- |
| `auth:sess:<sha256(token)>` | JSON `SessionPayload`（见下）    | 604800s（7 天，env 可配）       | 登录成功 `set`；登出 `del`；过期自动消失                                          | FR-004/010/012 |
| `auth:fail:<userId>`        | 整数（连续失败次数，字符串编码） | 900s 滑动：每次失败 INCR 时刷新 | 密码错误 `incrWithTtl`；登录成功 `del`；不存在标识**不写**                        | FR-013         |
| `auth:lock:<userId>`        | `1`                              | 900s 固定                       | 计数 4→5 时 `set`；定位账号后先查，命中记安全日志但对外仍回统一 401；期满自动解除 | FR-013/006     |

命名空间前缀 `auth:` 为代码常量（`auth.constants.ts`），与环境 keyPrefix 叠加；E2E 清理只删 `auth:*` 逻辑键，禁止 flushdb。

### 2.1 SessionPayload

```text
{
  "sub": string  // 用户 _id（24 位 hex）
}
```

- 刻意**不存 isAdmin / 角色**：角色每请求回查 Mongo，保证降权即时生效（FR-011，ADR-004）。
- 不存签发时间（TTL 由 Redis 承载）；不存客户端元信息（IP/UA，本期 FR-019 不做审计画像）。
- 令牌本身不落明文：键用 sha256 摘要；值中也不含原令牌。

### 2.2 令牌材料

- 令牌：`crypto.randomBytes(32).toString('hex')` → 64 字符 hex（256 bit 熵）。
- 落库键材料：`createHash('sha256').update(token).digest('hex')`。
- 比较只用 Redis 键查找（哈希索引），不做令牌字符串时间敏感比较以外的运算。

## 3. 状态机

### 3.1 会话生命周期

```text
登录凭据校验通过
  └─(set 会话键, TTL=7d)→ ACTIVE
        ACTIVE ──登出 DEL──→ REVOKED（立即；等同键不存在 → 401）
        ACTIVE ──TTL 到期──→ EXPIRED（键不存在 → 401）
        ACTIVE ──账号软删/降权──→ 鉴权回查：软删 401；降权后 isAdmin=false（会话仍可访问认证-only 接口）
```

### 3.2 登录失败计数（账号维度）

```text
              密码错误(INCR+EXPIRE900)
  无计数 ───────────────────────► 计数 1..4 ──密码错误──► 计数=5 + set lock(900s)
   ▲                                │                        │
   │成功登录 DEL                    │成功登录 DEL            │ 任何登录尝试
   └────────────────────────────────┘                        ▼
                                                       LOCKED（内部状态，对外仍 401 INVALID_CREDENTIALS）
                                                       期间：不参考密码比对结果、绝不放行、不计次、不延长；
                                                       服务端日志记录锁定命中
                                                       TTL 到期 → 键消失 → 回到无计数
```

- 不存在标识：直接返回 `INVALID_CREDENTIALS`，不进入此状态机（FR-013 澄清）。
- 计数键滑动窗口与锁定键固定窗口并存：锁定以 lock 键存在与否为准。

## 4. 对外数据形状（详见 contracts/auth-api.md）

- 登录成功：`{ token, expiresAt, user: UserResponse }`；`UserResponse` 复用 001 `toUserResponse`（无 password/deletedAt/usernameLower）。
- `request.user`（AuthGuard 注入，内部形状，沿用 001 `CurrentUser`）：`{ id: string, isAdmin: boolean }`。

## 5. 不做（YAGNI，FR-019）

refresh token / 滑动续期、user→session 反向索引、单点互踢、会话列表、IP/设备维度计数、验证码——均不在本期，不预留字段。
