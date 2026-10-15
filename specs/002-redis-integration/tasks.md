---
description: 'Task list for 002-redis-integration'
---

# Tasks: Redis 缓存基础设施集成（Redis Infrastructure Integration）

**Input**: `specs/002-redis-integration/` 下 spec.md / plan.md / research.md / data-model.md / contracts/cache-service.md / quickstart.md

**Prerequisites**: plan.md、spec.md（必需）；research.md、data-model.md、contracts/、quickstart.md（已具备）

**Tests**: 宪法原则 III（Test-First）不可协商：除标注 `[no-test]` 的任务外，每个生产逻辑任务必须先写失败测试（RED）→ 最小实现（GREEN）→ 重构（REFACTOR）。单测 mock ioredis 客户端，不依赖真实 Redis；仅健康检查 E2E 需本地 Redis 在运行。

**Organization**: 按用户故事分组。US1（统一缓存服务）即可独立交付为 MVP；US2 健康检查、US3 连接异常行为在其后增量交付。

## 格式：`[ID] [P?] [Story?] 描述（含路径）`

- **[P]**：可并行（不同文件、不依赖未完成任务）
- **[Story]**：所属用户故事（US1/US2/US3）；Setup/Foundational/Polish 不带 Story 标签
- `[no-test]`：纯配置/文档任务，豁免 TDD

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 新增依赖与目录/环境配置。

- [x] ✅ T001 [no-test] 人工评审并安装依赖 `ioredis@^5`（`pnpm add ioredis@^5`，v5 自带类型无需 `@types`；与 NestJS 9 / Node 20 / Redis 4 服务端兼容，依据 research R1）；更新 `package.json` / `pnpm-lock.yaml`。**阻塞性前置，AI 不得自行安装**；如遇 pnpm 构建脚本审批，按 `docs/development/development.md §8.1` 处理（ioredis 为纯 JS，无原生构建）。实测安装 5.11.1（沙箱外、registry.npmjs.org）
- [x] ✅ T002 [P] [no-test] 创建目录与空骨架：`src/common/cache/`（`cache.module.ts`、`cache.constants.ts`、`redis.config.ts`、`cache.service.ts`、`redis.health.ts` 及对应 `.spec.ts`）。落地方式：不预建会触发 lint/tsc 的空文件，目录随 T004–T017 的真实文件创建
- [x] ✅ T003 [P] [no-test] 在 `.env.local` 增加 `REDIS_HOST=127.0.0.1`、`REDIS_PORT=6379`、`REDIS_PASSWORD=`、`REDIS_DB=0`、`REDIS_KEY_PREFIX=local:`；在 `docs/development/development.md` 环境变量说明处补 uat/prod 需由运维提供同名变量（密码不入库）

---

## Phase 2: Foundational（阻塞性前置）

**Purpose**: 注入 token、连接选项纯函数、Redis 单例连接 provider 与模块骨架；所有 US 阶段的共用底座。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何 US 阶段。

- [x] ✅ T004 [P] 先写失败测试：`src/common/cache/redis.config.spec.ts`——给定 env 断言 `buildRedisOptions` 输出 `host/port/db/password/keyPrefix`；缺 `REDIS_HOST` 抛错（不给默认地址）；`REDIS_KEY_PREFIX` 缺省回退 `${NODE_ENV||'local'}:`；置位 `lazyConnect:true`、`enableOfflineQueue:false`、`maxRetriesPerRequest:3`、`connectTimeout`、`commandTimeout`，且 `retryStrategy` 为函数（research R3/R4/R8）
- [x] ✅ T005 [P] 实现 `src/common/cache/cache.constants.ts`（导出注入 token `REDIS_CLIENT`）与 `src/common/cache/redis.config.ts`：`buildRedisOptions(config: ConfigService): RedisOptions` 纯函数，对齐 `src/mongoose.config.ts` 风格（GREEN）
- [x] ✅ T006 [no-test] 实现 `src/common/cache/cache.module.ts`：`@Global() CacheModule`，异步工厂 `useFactory` 内 `new Redis(buildRedisOptions(config))` 提供 `REDIS_CLIENT`，注册 `client.on('error')` 结构化日志（host:port:db + 错误名/首行，**不打 password/value**），`OnModuleDestroy` 调 `client.quit()` 优雅关闭；本任务只建连，**不含启动 ping fail-fast**（归 T016）。说明：本任务为 IoC/关闭钩子的框架装配（同 Mongoose forRoot 装配，001 亦未单测），其可测行为分别由 T010（DI）、T016（fail-fast）、T017（日志脱敏）覆盖，故标 `[no-test]`（U3）
- [x] ✅ T007 [no-test] 在 `src/app.module.ts` 的 `imports` 中、`HealthModule` 之前注册 `CacheModule`（健康控制器 US2 需注入其指示器）；确认 `src/main.ts` 已有 `app.enableShutdownHooks()`（已存在，缺失才补）

**Checkpoint**: 应用可自举、Redis 单例可注入，US1 可开始。

---

## Phase 3: User Story 1 - 统一缓存服务读写（P1，MVP）🎯

**Goal**: 业务模块注入唯一 `CacheService` 完成带 TTL 的写入、读回、删除与未命中识别。

**Independent test**: mock 客户端下 `set→get` 往返一致、`del` 后未命中、未写过的 key 返回 null、TTL 到期语义由 `EX` 参数保证、不同前缀互不干扰；模块经 DI 可被消费方注入。

- [x] ✅ T008 [P] [US1] 先写失败测试：`src/common/cache/cache.service.spec.ts`——`set(k,v,ttl)` 调用底层 `set(k, json, 'EX', ttl)`；`ttlSeconds` 为 `0/负数/非整数/NaN` 时抛 `RangeError`；`get` 命中时 JSON.parse 深等于写入、未命中（底层返回 null）返回 null、脏 JSON 抛错；`del` 透传且键不存在不抛；断连（mock reject）时各方法 reject 不吞错（FR-004/005/006/010，契约 §2/§3）
- [x] ✅ T009 [US1] 实现 `src/common/cache/cache.service.ts`：`set<T>(key,value,ttlSeconds):Promise<void>`（TTL 正整数校验 + `JSON.stringify` + `'EX'`）、`get<T>(key):Promise<T|null>`（null 原样返回、有值 `JSON.parse`，失败抛错）、`del(key):Promise<void>`（幂等）；构造注入 `@Inject(REDIS_CLIENT)`；在 `cache.module.ts` 注册并 **exports 仅 `CacheService`**（不导出 `REDIS_CLIENT`）（GREEN，FR-001/002/003）
- [x] ✅ T010 [US1] DI/封装测试：在 `cache.service.spec.ts`（或新增 `cache.module.spec.ts`）用 `Test.createTestingModule({imports:[CacheModule]})` 以 mock provider 覆盖 `REDIS_CLIENT`，断言 `CacheService` 可被消费方注入、`REDIS_CLIENT` 不对外导出；验证两个业务前缀的键互不覆盖（FR-013，键规范见 data-model §2）

**Checkpoint**: US1 独立可用——任意模块注入 `CacheService` 即可安全读写缓存。

---

## Phase 4: User Story 2 - 健康检查反映缓存状态（P2）

**Goal**: `/health/ready` 新增 redis 检查项，随实际连通情况翻转，复用现有 5s 节流；`/health/live` 不变。

**Independent test**: 指示器 ping 成功报 up、失败抛 HealthCheckError；控制器 readiness 同时注册 mongodb 与 redis；E2E 中 Redis 在线时 `/health/ready` 200 且 `details.redis.status==='up'`。

- [x] ✅ T011 [P] [US2] 先写失败测试：`src/common/cache/redis.health.spec.ts`——mock `REDIS_CLIENT.ping`：resolve 时 `isHealthy('redis')` 返回 `{redis:{status:'up'}}`；reject 时抛 terminus `HealthCheckError`（FR-009，research R2）
- [x] ✅ T012 [US2] 实现 `src/common/cache/redis.health.ts`：`RedisHealthIndicator extends HealthIndicator`，注入 `@Inject(REDIS_CLIENT)`，`ping()` 成功 `getStatus(key,true)`、失败 `getStatus(key,false,{message})` 后抛 `HealthCheckError`；在 `cache.module.ts` 提供并导出该指示器（GREEN）
- [x] ✅ T013 [US2] 先写失败测试，扩展 `src/health/health.controller.spec.ts`：readiness 断言 mongodb 与 redis 两个指示器都被注册调用、5s 内复用缓存只各 ping 一次、失败不缓存（沿用现有四个用例扩展，不删原断言）；新增用例——redis 指示器 reject 时 `ready()` reject（对应 terminus 聚合的 503/down），把"健康翻转"自动化（U2，真实断线重连仍留 T018 手工）
- [x] ✅ T014 [US2] 实现（GREEN）：修改 `src/health/health.controller.ts`，构造注入 `RedisHealthIndicator`，把 `() => this.redisIndicator.isHealthy('redis')` 追加进 `ready()` 的 `health.check([...])` 数组（沿用既有 5s `PING_CACHE_TTL_MS` 节流与失败不缓存，`live()` 不触碰 Redis）
- [x] ✅ T015 [US2] E2E：新增 `test/redis-health.e2e-spec.ts`，用 `test/helpers/e2e-app.ts` 自举——本地 Redis 在线时 `GET /health/ready` 返回 200、`details.redis.status==='up'` 且 `details.mongodb` 仍在；`GET /health/live` 不依赖 Redis。文件头注释说明本 E2E 前置 `redis-server` 在运行（quickstart §1）。停服 down→ 恢复 up 的翻转由 T013 控制器测试 + T018 手工共同保证，本 E2E 不断 Redis

**Checkpoint**: US1 + US2 同时可用，运维可在健康检查看到缓存状态。

---

## Phase 5: User Story 3 - 连接异常明确可诊断（P3）

**Goal**: 启动 fail-fast、运行期断线命令立即失败、恢复后自动重连、日志脱敏。

**Independent test**: 启动 ping 失败则 provider reject（应用启动中止）并 disconnect；错误事件日志不含密码/缓存值；断连期命令立即 reject；恢复后无需重启即成功（重连由自定义线性退避 times\*100、封顶 2s 保证，手工验证）。

- [x] ✅ T016 [US3] 先写失败测试，再改 `src/common/cache/cache.module.ts` 连接工厂：创建后 `await client.ping()` 校验，成功才返回实例；失败则 `client.disconnect()` 并 reject（测试用 mock Redis：ping reject 时工厂 reject 且调用 disconnect），实现配置缺失/连不通即中止启动（FR-008，research R3）。T004 已断言 `lazyConnect` 等选项，本任务打通工厂内 ping
- [x] ✅ T017 [P] [US3] 先写失败测试：`src/common/cache/` 内断言 `error` 事件日志（捕获 Nest `Logger` 输出）只含 host:port:db 与错误信息，**不含** `REDIS_PASSWORD` 值、不含任何缓存 value（FR-012）；若 T006 日志已满足则仅补测试锁定行为
- [x] ✅ T018 [US3] [no-test] 手工/脚本验证并记录结果到 PR 描述（确定性单测难覆盖，按 quickstart §3.3–3.5）：Redis 停服时启动 → 明确 ECONNREFUSED 且不监听；运行期停 Redis → 命令立即失败（`enableOfflineQueue:false`）后重启 Redis → 无需重启应用操作恢复（FR-010/011）；日志 grep 不到密码（FR-012）

**Checkpoint**: 三个故事全部独立可用；缓存故障在启动与运行期均可被快速、明确发现。

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 全量验证、文档与交接收尾。

- [x] ✅ T019 [no-test] 全量验证 `pnpm lint && pnpm test && pnpm test:e2e`（E2E 前先起本地 Redis 与 MongoDB），退出码 0；按 `quickstart.md` 逐条核对 §2/§3 关键场景
- [x] ✅ T020 [no-test] 文档同 PR 更新：`docs/context.md`（会话记录/进行中工作，登记新依赖 ioredis 与 ADR-003）；评审通过后把 ADR-003 与 `redis-integration-design.md` 状态 Draft → Pending/Confirmed 并同步 `docs/architecture/README.md` 索引日期；若实现与设计有偏差，回改 design/ADR，不允许代码与文档脱节
- [x] ✅ T021 [no-test] 跑 superpowers `verification-before-completion`（证据先于结论）；通过后由编排 Agent 将 `.specify/superpowers-handoff.json` 置为 `complete`

---

## 依赖关系（故事完成顺序）

```text
Phase 1 Setup（T001 装依赖阻塞 → T002/T003 可并行）
   └─▶ Phase 2 Foundational（T004/T005 RED→GREEN → T006 模块/连接 → T007 注册）
          ├─▶ Phase 3 US1（缓存服务，MVP）T008–T010
          │        ├─▶ Phase 4 US2（健康检查）T011–T015   [需 CacheModule 已导出]
          │        └─▶ Phase 5 US3（fail-fast/异常/脱敏）T016–T018 [改 T006 同一工厂，与 US2 不同文件可并行，T016 排在后避免工厂合并冲突]
          ▼
     Phase 6 Polish T019–T021（必须最后）
```

- T001 是所有代码任务前置：未装 ioredis 则相关 import/测试无法运行。
- US2 与 US3 都只依赖 Foundational + US1 的模块导出，逻辑上可并行；但 T014（health.controller 实现）与 T016（cache.module 工厂）文件不同，仅 T016 与 T006/T009/T012 同在 `cache.module.ts`，按编号顺序串行改该文件。
- 同组标注 [P] 的任务文件互不重叠（如 T004/T005、T008 的测试、T011/T012、T017）；同文件的 RED→GREEN 必须串行。

## FR / 验收追溯

| FR                                                       | 任务                                           |
| -------------------------------------------------------- | ---------------------------------------------- |
| FR-001/002/003（统一服务、DI、单例）                     | T006、T009、T010                               |
| FR-004（TTL 必填、禁永久键）                             | T008、T009                                     |
| FR-005/006（未命中 null、删除幂等）                      | T008、T009                                     |
| FR-007（env 配置、不硬编码）                             | T003、T005                                     |
| FR-008（启动 fail-fast）                                 | T016、T018                                     |
| FR-009（健康检查）                                       | T011–T015（T013 含 down 翻转的控制器测试，U2） |
| FR-010（失败明确上抛、不静默）                           | T008、T013、T018                               |
| FR-011（断线自动恢复）                                   | T004（选项）、T018（手工验证）                 |
| FR-012（连接错误结构化日志、脱敏；不要求逐命令成功日志） | T006、T017、T018（U1 收窄）                    |
| FR-013（环境/模块键隔离）                                | T005（keyPrefix）、T010                        |
| FR-014（不建锁/事务/管道/ pubsub）                       | 全程不引入；review 核对                        |

## 并行示例

- Setup：T002 骨架 与 T003 env 文档可并行（T001 装依赖先完成）。
- Foundational：T004（config 测试）先落，T005（constants+config 实现）与之成对；T006 模块在其后。
- US2 ↔ US3：US1 完成后，健康指示器（`redis.health.*` + controller）与连接工厂增强（`cache.module.ts` ping/日志）分属不同文件，可两人并行；合并 `cache.module.ts` 时按 T012→T016 顺序 rebase。

## 实现策略

1. **MVP 优先**：完成 Phase 1–3（US1）即得到可被任意模块注入的统一缓存层，可独立演示/部署。
2. **严格 TDD**：除 `[no-test]` 外先提交失败测试再写最小实现；禁止先实现后补测试、禁止删测试求通过、禁止 `--no-verify`。
3. **增量交付**：US1 → US2 → US3，每个 Phase 结束保持 `pnpm lint && pnpm test` 绿；E2E 仅在本地 Redis/MongoDB 就绪时运行。
4. **安全默认**：TTL 强制、客户端不导出、日志脱敏、fail-fast 在对应阶段闭环，不延后到 Polish。
5. **YAGNI**：不实现分布式锁/事务/管道/发布订阅（FR-014）；单实例、单连接的天花板以 `ponytail:` 注释在 `cache.module.ts`/`redis.health.ts` 标明升级路径。
6. 依赖安装（T001）需人工评审，AI 不得自行变更 `package.json`。
