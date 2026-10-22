# 实现计划：用户登录鉴权（User Login & Authentication）

**Branch**：`003-user-login` | **Date**：2026-10-22 | **Spec**：[spec.md](./spec.md)

**Input**：`specs/003-user-login/spec.md`（9 项澄清 + 安全评审修订后的版本）

## Summary

新增 `auth` 模块：用户名或邮箱 + 密码登录，校验成功后签发**不透明随机令牌**，会话以 Redis 为唯一裁决（固定 7 天 TTL）；全局 `AuthGuard` 解析 `Authorization: Bearer <token>` 并**每次回查 Mongo 账号状态**（软删/降权即时生效，FR-011）；提供登出即时吊销；同账号连续失败 5 次锁 15 分钟（账号维度，Redis 原子计数，不存在标识不计数）。复用 001 的 users 集合/bcrypt/软删与 002 的 `CacheService`，**不新增任何第三方依赖、不改动 Mongo Schema**；落地后删除 `x-test-user` 测试桩，全部 E2E 走真实登录。

关键技术取舍见 [ADR-004](../../docs/architecture/adr/ADR-004-opaque-token-redis-session.md)（Draft）。

## Technical Context

**Language/Version**：TypeScript 5.0.0 / Node >= 20

**Primary Dependencies**：NestJS 9.0.0、@nestjs/mongoose + mongoose 6.13、ioredis 5.11（均已安装，**不新增依赖**；不引入 passport/jwt）

**Storage**：MongoDB 7（users 集合，只读复用，无 Schema 变更）；Redis 4（经 `CacheService`，存会话/失败计数/锁定键）

**Testing**：Jest 单测（与源码同目录，Mock Model/Redis/外部 Service）；supertest E2E（`test/helpers/e2e-app.ts` 自举，真实 mongod + redis，库 `ai_blog_test`，`--runInBand`）

**Target Platform**：Linux/macOS 服务端（NestJS HTTP API）

**Project Type**：web-service（纯后端 API）

**Performance Goals**：对齐宪法原则 V，核心读接口 P95 ≤ 200ms；登录/鉴权 90% 请求 2s 内反馈（SC-007，功能测试 + 冒烟验证，不建压测设施）

**Constraints**：

- 令牌只经 `Authorization: Bearer` 头（FR-008，唯一方式，不支持 query/cookie）
- 会话 TTL 固定 604800 秒（7 天），不滑动、不刷新（FR-004/FR-019）
- Redis 不可用时鉴权 fail-closed（FR-015）
- 不新增用户档案字段；失败计数/锁定不写 Mongo（spec 关键实体）
- 缓存只经 `CacheService`，不导出裸 client（宪法 IV）

**Scale/Scope**：博客规模；单 Redis 实例、单应用实例；每鉴权请求 1 次 Redis GET + 1 次 Mongo \_id 点查

## Constitution Check

_GATE：Phase 0 前初检，Phase 1 设计后复检。_

| 原则                    | 结论 | 说明                                                                                                                                                                                                                            |
| ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. TypeScript-First     | ✅   | 登录 DTO、会话负载、Service/Guard 入参返回全部显式类型；无 any；新增错误均为 Nest 内置/`HttpException` 子类                                                                                                                     |
| II. 模块边界与分层      | ✅   | `auth` 为独立业务域目录（module/controller/service/dto/guards）；只注入 UserModule export 的 `UserService`，不直连 User Schema 之外的集合；Redis 只经 `CacheService`；Controller 不碰 HTTP 对象以外的业务逻辑；令牌解析在 Guard |
| III. Test-First         | ✅   | 所有生产逻辑任务（配置工厂、CacheService 扩展、AuthService、AuthGuard、Controller、UserService 新方法）逐个 RED→GREEN→REFACTOR；纯 env/文档任务标 `[no-test]`                                                                   |
| IV. 安全默认开启        | ✅   | 不透明令牌 + sha256 后入 Redis（静态落库不可直接冒用）；bcrypt 既有 cost 10；账号不存在时执行 dummy 比对均化响应；输入全走 DTO + 全局 ValidationPipe；锁定防爆破；日志不记密码/完整令牌；fail-closed                            |
| V. 可观测/可灰度/可回滚 | ✅   | 登录成功/失败/登出/锁定结构化日志（不泄敏）；无 Mongo Schema 变更，expand-contract 不适用；纯新增接口与新增模块，回滚=撤回版本；Metrics/Trace 仍为延后项                                                                        |

**初检通过，无 MUST 违例。** Phase 1 后复检见文末。

### 跨模块触碰（最小化，登记在案）

1. `UserModule` 增加 `exports: [UserService]`，`UserService` 新增 1 个只读方法 `getAuthPrincipal(id)`（含 deletedAt 投影）——归属 auth feature 任务，TDD，不改既有方法签名。
2. 全局默认拒绝后需给既有公开路由打 `@Public()`：`POST /users`（注册）、`GET /health/live`、`GET /health/ready`、`GET /`（根）。每行 1 个装饰器。
3. `CacheService` 扩展 1 个原子方法 `incrWithTtl`（失败计数需要原子 INCR+TTL），配套补单测；既有 `set/get/del` 与调用方不变。

## Project Structure

### Documentation (this feature)

```text
specs/003-user-login/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-api.md
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit-tasks 产出，本命令不创建
```

### Source Code (repository root)

```text
src/
├── app.module.ts                         # +import AuthModule
├── common/
│   └── cache/
│       ├── cache.service.ts              # +incrWithTtl（原子计数）
│       └── cache.service.spec.ts         # +用例
├── health/
│   └── health.controller.ts              # +@Public() live/ready
├── app.controller.ts                     # +@Public() GET /
└── modules/
    ├── user/
    │   ├── user.module.ts                # +exports UserService
    │   ├── user.service.ts               # +getAuthPrincipal(id)
    │   └── user.service.spec.ts          # +用例
    └── auth/                             # 新增
        ├── auth.module.ts                # imports UserModule；APP_GUARD 注册 AuthGuard
        ├── auth.controller.ts            # POST /auth/login、POST /auth/logout
        ├── auth.service.ts               # 登录校验/会话签发/吊销/锁定计数
        ├── auth.service.spec.ts
        ├── auth.guard.ts                 # Bearer 解析→会话→回查账号→注入 request.user
        ├── auth.guard.spec.ts
        ├── auth.config.ts                # TTL/阈值经 ConfigService 读取 + 校验
        ├── auth.config.spec.ts
        ├── auth.constants.ts             # 键前缀、默认 TTL/阈值、IS_PUBLIC
        ├── session.interface.ts          # SessionPayload / AuthenticatedRequest
        ├── decorators/
        │   └── public.decorator.ts
        └── dto/
            ├── login.dto.ts
            └── login.dto.spec.ts

test/
├── helpers/
│   └── e2e-app.ts                        # 删 TestUserGuard；导出 authHeader/loginHelper
├── auth-login.e2e-spec.ts                # 新增：登录/鉴权/登出/锁定全链路
└── user-{profile,admin}.e2e-spec.ts      # 2 个用桩套件改真实登录令牌
                                          # user-register（公开注册）不用桩，不改；
                                          # app/redis-health 不走 createTestApp，天然无桩
```

**Structure Decision**：沿用 001/002 的单仓库 NestJS 布局——业务域在 `src/modules/<domain>/`，横切在 `src/common/`；auth 为独立模块，通过 UserModule 导出的 Service 协作用户数据，不新建第二个用户数据访问层。

## Implementation Strategy（HOW，tasks 阶段展开为有序任务）

- **阶段 A 基础设施**：`auth.constants.ts` + `auth.config.ts`（ConfigService，正整数 fail-fast）；`CacheService.incrWithTtl`（multi 原子 INCR+EXPIRE）。
- **阶段 B 用户域协作口**：UserModule export；`getAuthPrincipal`（投影 `_id/isAdmin/deletedAt`，软删返回 null）。
- **阶段 C AuthService**：`login`（$or 双标识查找 → 查锁定键（命中仅记日志）→bcrypt 比对（不存在走 dummy、锁定也走比对均化时序）→ 锁定命中/密码错都回统一 401；失败计数/第 5 次置锁 → 成功清计数+签发会话）、`logout`、`resolveSession`（Guard 用）。
- **阶段 D 鉴权链**：`@Public()` + `AuthGuard`（APP_GUARD 全局默认拒绝；解析 Bearer；Redis 取会话（异常 →401 fail-closed）；以 `sub` 回查 Mongo 当前账号（查无/软删 →401；查询本身失败同样 fail-closed，FR-015）；注入 `{id,isAdmin}`）；公开路由打标。
- **阶段 E 控制器**：`POST /auth/login`（公开，200 返回 token/expiresAt/user）、`POST /auth/logout`（已认证，200）。
- **阶段 F 测试切换**：删测试桩；helper 提供真实登录；新增 auth E2E；改写 2 个用桩的 user E2E（user-profile、user-admin；user-register 测公开注册不用桩，保持不动）。
- **阶段 G 收尾**：三套 env 补认证配置项（[no-test]）、ADR-004/设计文档/context、quickstart 真实验证。

## Rollback / Risk

- **回滚**：无数据迁移、无 Schema 变更；回滚=撤回应用版本。旧版本无 AuthGuard，Redis 会话键自然过期（7 天 TTL），无残留危害。
- **风险 R1 全局 Guard 锁死全部接口**：缓解——先给 register/health/root 打 `@Public()` 再注册 APP_GUARD；E2E 全量回归。
- **风险 R2 每请求回查 Mongo 的开销**：\_id 唯一索引点查，博客规模 P95 可接受；`ponytail:` 注释标注天花板（单实例读多场景），升级路径=变更事件驱动主动吊销 + 会话内缓存（见 ADR-004）。
- **风险 R3 锁定键并发与枚举**：第 5 次失败用既有 `set`（EX 15min）置锁；锁定期不触碰计数，故锁定不延长、不重置；计数键每次失败刷新 TTL（滑动窗口）见 research R4。锁定命中对外与凭据错误不可区分（统一 401，仅服务端日志记录，FR-006/FR-014），杜绝借锁定响应枚举账号或主动锁死他人。
- **风险 R4 测试污染本地 Redis**：E2E 只删本功能前缀键（`auth:*` 经 keyPrefix 后为 `local:auth:*`），禁止 flushdb。

## Complexity Tracking

| Violation                                                     | Why Needed                                                                | Simpler Alternative Rejected Because                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 全局 APP_GUARD + @Public 标记（默认拒绝）                     | 保证 FR-008「所有受保护接口必须校验」无遗漏，未来新路由默认安全           | 逐路由挂 Guard 与 001 现状一致，但新路由忘记挂即裸奔，违背宪法 IV「默认开启」；标记 4 个公开点比保护 N 个路由更小更安全 |
| `CacheService` 增加 incrWithTtl                               | 失败计数必须原子自增+TTL，防并发绕过阈值（spec 边界：并发登录计数准确性） | 先 get 再 set 非原子，并发请求可读到旧计数使 5 次阈值失效；引入 bull/限流器属过度建设（YAGNI）                          |
| 登录成功/失败两条路径都做安全处理（dummy bcrypt、统一错误体） | 防账号枚举与响应时序侧信道                                                | 仅统一错误码不足以消除「用户不存在时跳过 bcrypt」的时序差                                                               |

## Phase 1 后宪法复检

设计产物（research/data-model/contracts）完成后复检：原则 I–V 全部保持 ✅——会话负载与请求形状均有显式 interface；模块依赖方向为 auth → user(exported service) → mongoose，无循环依赖、无跨域 Schema 直连；契约中所有接口均有对应验收场景与测试任务位；密钥/令牌不入日志与响应（登录响应的 token 除外）；无未经验证依赖。**复检通过，可进入 `/speckit-tasks`。**
