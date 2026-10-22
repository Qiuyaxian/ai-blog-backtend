# Phase 0 研究记录：用户登录鉴权

**Feature**：003-user-login | **Date**：2026-10-22

每条：Decision / Rationale / Alternatives。结论已回填 plan 与 ADR-004。

## R1：令牌形态——不透明随机令牌 + 服务端会话（对应 ADR-004）

- **Decision**：登录成功生成不透明随机令牌（`crypto.randomBytes(32).toString('hex')`，Node 标准库），对令牌做 sha256 后作为 Redis 键存放会话；令牌原样只在登录响应返回一次。
- **Rationale**：spec 要求登出即时吊销（FR-010）、软删/降权即时生效（FR-011）。会话裁决在服务端，删除键即失效；Redis 已是现成基础设施（ADR-003）。静态落库的是 sha256 摘要，即使 Redis 键被窥到也无法直接当 Bearer 令牌用（不能原样回传）。
- **Alternatives**：
  - 自包含 JWT（无状态）：签发即无法在不引入黑名单的情况下吊销，与 FR-010/FR-011 冲突；黑名单又回到 Redis 状态，双轨更复杂。**否决**。
  - 自实现签名串/HMAC：等价于更差的 JWT，且要自己处理时效与解析。**否决**。

## R2：FR-011 软删/降权即时生效——每请求回查 Mongo（账号状态快照不缓存）

- **Decision**：`AuthGuard` 取到会话后，用会话中的 userId 经 `UserService.getAuthPrincipal(id)` 点查 Mongo（`_id` 唯一索引 + `deletedAt:null`），以库中**当前** `isAdmin` 注入 `request.user`；查不到（软删/不存在）→ 401。
- **Rationale**：行为正确优先，降权/删除无需知道有哪些会话即生效；`_id` 点查成本博客规模可忽略（每鉴权请求 1 GET + 1 点查）。
- **Alternatives**：
  - 变更时主动吊销该用户全部会话：需要维护 user→tokens 索引集合，setAdmin/softDelete 反向依赖 auth 模块（循环依赖风险），删除用户路径耦合会话清理。**否决**（作为未来高流量升级路径）。
  - 会话快照定时 TTL 容忍：存在最长 7 天权限窗口，违反「即时」。**否决**。
- **ponytail 天花板**：每鉴权 1 次 Mongo 点查；若未来读 QPS 成为瓶颈，升级为「账号版本号」或变更事件驱动吊销 + 短缓存，接口不变。

## R3：登录标识歧义——$or 双查（usernameLower 或 email）

- **Decision**：归一化（trim+lowercase）后用 `{ $or: [{ usernameLower: key }, { email: key }], deletedAt:null }` 单查询定位账号。
- **Rationale**：001 的注册 DTO 未禁止用户名含 `@`，按「含 @ 即邮箱」判断会让含 `@` 用户名无法登录（违反 FR-001）。$or 覆盖两种标识，且 `usernameLower`/`email` 都有唯一索引，最多命中一条（理论双命中时取 email 命中者，确定性顺序）。
- **Alternatives**：
  - 字符串格式判路由：简单但对含 `@` 用户名错误。**否决**。
  - 收紧注册用户名字符集：属 001 已 Confirmed 契约变更，超出本 feature 规划权。**不在本期**。

## R4：失败计数与锁定的原子性

- **Decision**：
  - 计数键 `auth:fail:<userId>`：每次密码错误 `INCR` + `EXPIRE 900`（15 分钟滑动窗口，成功登录 DEL 清零）。
  - 锁定键 `auth:lock:<userId>`：第 5 次失败时用现有 `set(..., 900)` 写入（仅当计数从 4→5）；登录定位到账号后先查锁定键，命中则记"锁定命中"安全日志、继续走一次 bcrypt 比对，最终一律回 401 INVALID_CREDENTIALS（对外不可区分，FR-006，见 R5），且不触碰计数（锁定期不延长、成功也不清，期满自动解除）。
  - 不存在的标识：不读写任何计数/锁定键（FR-013 澄清），仅做 dummy bcrypt 后回统一错误。
  - 顺序：定位账号（$or）→ 查 lock 键（命中只记日志）→ bcrypt 比对 → 命中锁或密码错都回 401；未锁且密码对 →DEL 计数键、签发会话。
  - INCR 与 EXPIRE 用一次 `multi()` 管道原子提交，经 `CacheService.incrWithTtl(key, ttlSeconds)` 暴露；`CacheService` 注入的 client 类型从 `Pick<'set'|'get'|'del'>` 扩展加 `multi`。
- **Rationale**：并发登录请求不能读旧计数绕过阈值（spec 边界场景明确要求）；multi 单连接原子，无需 Lua/eval，不增加复杂度。
- **Alternatives**：
  - get→ 判断 →set 三步：非原子，并发下计数丢失。**否决**。
  - Lua 脚本 eval：能力过剩且要内联脚本维护。**否决**（YAGNI）。
  - 用固定 15 分钟计数窗口（首失败起算）：滑动窗口对慢速爆破更严格且实现等价（INCR 时刷新 EXPIRE）。采用滑动。

## R5：防账号枚举——统一错误 + dummy bcrypt 均化时序

- **Decision**：账号不存在、密码错误与锁定期命中都抛 `UnauthorizedException('INVALID_CREDENTIALS')`，同一 401/同一 code，客户端无法据响应区分账号是否存在或被锁；"锁定命中"的真实原因只写服务端结构化日志（FR-006/FR-014）。账号不存在分支对一个固定 dummy hash 执行一次 `bcrypt.compare`，使响应路径耗时与真实账号相近；锁定期命中在判定前也执行一次 bcrypt 比对（结果不影响响应），避免锁定路径因跳过 bcrypt 产生时序差。
- **Rationale**：先查锁再回 423 会让"连错 5 次后是否变 423"成为账号枚举与主动锁死他人账号的探测手段（安全评审发现）；统一 401 堵住枚举，日志保留运营排障所需信息。
- **Alternatives**：
  - 锁定期一律回独立 423（UX 更明确）——枚举漏洞，否决。
  - 锁定期先验密码：错 →401、对 →423——真实用户仍会看到 423，攻击者用错误密码探测时仍全是 401，看似可行，但攻击者可对目标先制造 5 次失败、再用一个已知公开泄露的弱密码尝试，若返回 423 即确认密码，属信息泄露；统一 401 更稳。否决。
  - 仅统一错误码不补 dummy/锁定时序——可按耗时差异枚举证号。不足，否决。

## R6：全局鉴权接入点——APP_GUARD 全局 AuthGuard + @Public 白名单

- **Decision**：AuthModule 以 `{ provide: APP_GUARD, useClass: AuthGuard }` 全局注册；自定义 `@Public()` 元数据（IS_PUBLIC_KEY）豁免。公开点仅：`POST /auth/login`、`POST /users`、`GET /health/live`、`GET /health/ready`、`GET /`。既有 `RolesGuard`（@UseGuards 路由级）继续做角色判定，全局 AuthGuard 先跑并保证 `request.user` 已就位；RolesGuard 代码不改。
- **Rationale**：默认拒绝，新增受保护路由无需记得挂守卫（宪法 IV）。Nest 全局 Guard 先于控制器级 Guard 执行，顺序天然正确。
- **Alternatives**：逐路由 `@UseGuards(AuthGuard)`——与 001 写法一致但漏挂即裸奔。**否决**（见 plan Complexity Tracking）。

## R7：配置项——TTL 走 env，锁定阈值/安全常量走代码常量

- **Decision**：仅令牌 TTL 经 env（`AUTH_TOKEN_TTL_SECONDS`，默认 604800，正整数校验，fail-fast）；失败阈值 5、锁定 900s、键前缀 `auth:` 放 `auth.constants.ts`。
- **Rationale**：TTL 是运维可能按环境调整的量；阈值是安全策略，不应被环境变量悄悄放宽。devops 红线要求可配置项走 ConfigService、三套 env 同步键名。
- **Alternatives**：全部 env 化——配置面膨胀且阈值可被错误配置削弱安全。**否决**。

## R8：失败关闭（fail-closed）语义

- **Decision**：AuthGuard 中 Redis 读取抛错（非 null，而是连接错误）→ 记脱敏错误日志并返回 401；Guard 回查 Mongo 账号状态抛错（依赖不可用，无法确认当前状态）同样 401，不放行（FR-015 安全评审补充）；登录时 Redis 写会话失败 → 500（不返回令牌）。bcrypt/Mongo 在登录路径异常 → 500 统一错误体。
- **Rationale**：FR-015 无法核验即拒绝；ioredis 已配 `enableOfflineQueue:false`，断线时命令立即 reject，行为确定。
- **Alternatives**：Redis 故障时退化为「信任令牌」——无法吊销且违反 FR-015。**否决**。
