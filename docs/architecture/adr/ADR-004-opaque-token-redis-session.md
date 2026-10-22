# ADR-004：登录会话采用不透明令牌 + Redis 服务端会话（含即时吊销与即时鉴权）

## 状态

草稿（Draft）

> 状态枚举遵循 `AGENTS.md` §9。2026-10-22 随 003-user-login plan 阶段产出；待实现、全量验证与人工评审后转 Pending/Confirmed。

## 日期

2026-10-22

## 背景与约束

- 001 用户模块已有账号、bcrypt 密码（cost 10）与软删除（deletedAt），但无登录能力；受保护接口当前靠 E2E 测试桩 `x-test-user` 注入 `request.user`，真实鉴权落地后必须删除该桩。
- 002 已落地统一 `CacheService`（ioredis 单例、强制 TTL、未命中 null、错误上抛、keyPrefix 环境隔离）。
- 规格 `specs/003-user-login` 的硬约束：
  - FR-004 令牌不透明、服务端集中会话、固定 7 天 TTL；
  - FR-010 登出/过期即时失效（可主动吊销）；
  - FR-011 账号软删或管理员被降权后，在途令牌**立即**失去对应访问权；
  - FR-013 账号维度失败 5 次锁 15 分钟；
  - FR-015 会话存储故障失败关闭；
  - FR-019 本期不做 refresh/滑动续期/单点互踢。
- 规模：博客级，单应用 + 单 Redis；核心读接口 P95 目标 ≤ 200ms（宪法原则 V）。

## 决策

采用**不透明随机令牌 + Redis 服务端会话 + 每请求账号状态回查**：

1. 登录成功用 Node 标准库 `crypto.randomBytes(32).toString('hex')` 生成令牌；对令牌做 `sha256` 后作为 Redis 键，原令牌只在登录响应中返回一次。
2. 会话键 `auth:sess:<tokenSha256>`，值为 `{ sub: userId }`（不缓存 isAdmin，见第 4 条），TTL 604800 秒（7 天，固定不滑动）。
3. 鉴权链：全局 `AuthGuard`（APP_GUARD，默认拒绝，`@Public()` 白名单）解析 `Authorization: Bearer` → 查会话键（null/异常按 401 处理，fail-closed）→ 以 `sub` 经 `UserService.getAuthPrincipal` 点查 Mongo（`_id` 索引 + `deletedAt:null`；查询本身失败同样 fail-closed，不放行）→ 注入 `request.user = { id, isAdmin }`（以库中当前值为准）→ 既有 `RolesGuard` 继续做角色判定。
4. **即时生效不依赖会话内容**：isAdmin 不入会话快照、软删状态不信任会话；每请求回查 Mongo，降权/删除无需感知有哪些会话即生效。
5. 登出 = 删除会话键（DEL 幂等），立即失效。
6. 防爆破：计数键 `auth:fail:<userId>` 经 `CacheService.incrWithTtl`（multi 原子 INCR+EXPIRE 900，滑动窗口）；第 5 次失败写锁定键 `auth:lock:<userId>`（TTL 900）；定位账号后查锁定键，命中只写服务端安全日志、对外仍返回与密码错误/账号不存在完全相同的 401 `INVALID_CREDENTIALS`（不使用 423/独立错误码，避免借锁定响应枚举账号或主动锁死他人；安全评审结论），不延长锁、不计次；成功登录 DEL 计数键；不存在标识不写任何键。
7. 不引入 passport、jsonwebtoken 等任何新依赖；令牌 TTL 经 `AUTH_TOKEN_TTL_SECONDS` 配置（默认 604800，正整数 fail-fast），阈值/前缀为代码常量。

## 考虑的替代方案

- **无状态 JWT（Authorization 头）**：省掉会话查询，但签发即有效，登出/吊销需另建 Redis 黑名单——黑名单 + 短期 access token 实质又回到服务端状态，且要处理双令牌、刷新与黑名单 TTL，复杂度更高；降权即时生效同样需黑名单或短 TTL，与 FR-010/FR-011 直接冲突。否决。
- **JWT + 每请求回查账号但不做黑名单**：降权可即时生效，但登出无法即时失效（FR-010 不满足）。否决。
- **会话内缓存 isAdmin/软删快照 + 变更时主动吊销对应用户全部会话**：省一次点查，但需维护 user→ 会话反向索引，且 `setAdmin/softDelete` 反向耦合 auth 模块（循环依赖风险）；权限变更存在最长快照 TTL 窗口，不满足「即时」。作为未来高 QPS 升级路径保留（research R2）。
- **Cookie + 服务端会话**：浏览器同站场景可用，但本项目为纯 API 后端，Bearer 头对 API 客户端/E2E 更直接，且 Cookie 需额外处理 CSRF/SameSite。FR-008 澄清已拍板仅 Bearer。
- **锁定/计数放 Mongo**：每次失败一次读写，放大主库压力，且需 TTL 索引清理；Redis 天然过期更适合临时安全状态。

## 后果

### 正面

- 吊销即时（DEL 键），降权/软删即时（每请求回查），完全满足 FR-010/FR-011。
- 不透明令牌 + sha256 落库：Redis 键泄露不等于可冒用；令牌无法离线解读身份。
- 无新依赖；全部 Redis 访问经既有 `CacheService`，符合宪法 II/IV。
- 无 Mongo Schema 变更、无数据迁移；回滚=撤回版本，残留会话键 7 天自动过期。

### 负面

- 每个鉴权请求依赖 Redis 与 Mongo 各一次访问；Redis 故障期间登录与鉴权失败关闭（FR-015，安全优先）。
- 每请求 Mongo 点查在极高读 QPS 下有成本（博客规模可忽略，见 research R2 升级路径）。
- 令牌丢失即会话失效，无刷新机制（本期 FR-019 明确不做，需重新登录）。

### 中性

- E2E 与本地开发依赖 Redis 运行（002 起已是既成事实）。
- 会话键占用 Redis 内存，随登录数线性增长，7 天自动回收；博客规模无压力。

## 重新评估条件

- 读 QPS 使每请求 Mongo 点查成为瓶颈 → 引入账号版本号或变更事件驱动吊销 + 短缓存（research R2）。
- 需要多端单点互踢、强制下线、在线会话列表 → 增加 user→session 索引结构。
- 需要移动端长期免登录 → 另立 refresh token 规格（FR-019 延后项）。
- 多实例/多区域部署对会话一致性提出更高要求 → 评估集中式 Redis 集群或 JWT+黑名单混合方案。

## 相关文档

- 规格：[specs/003-user-login/spec.md](../../specs/003-user-login/spec.md)
- 研究：[research.md](../../specs/003-user-login/research.md)（R1/R2/R4/R8）
- 上游：[ADR-002 用户模块数据模型与权限基线](./ADR-002-user-module.md)、[ADR-003 Redis 统一缓存层](./ADR-003-redis-cache.md)
- 宪法原则：`.specify/memory/constitution.md` II / IV / V

## 更新记录

- 2026-10-22 @架构组 + AI：安全评审修订——锁定期对外不再返回 423（可枚举账号且可被利用主动锁死他人），统一为 401 INVALID_CREDENTIALS，真实原因仅入服务端日志；Guard 的 Mongo 回查失败明确 fail-closed。仍为 Draft。
- 2026-10-22 @架构组 + AI：初始版本（Draft），随 003 plan 阶段产出，待评审。
