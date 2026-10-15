# 实现计划：Redis 缓存基础设施集成（Redis Infrastructure Integration）

**分支**：`feat/user_redis_init` | **日期**：2026-10-14 | **规格**：[spec.md](./spec.md)

**输入**：`specs/002-redis-integration/spec.md`

## 摘要

为 NestJS 9 应用引入统一缓存层：基于 ioredis 5 的全局 `CacheModule`，经 `ConfigService` 读取环境配置，单例连接；对外只暴露统一 `CacheService`（写必须带 TTL、读未命中返回 null、删幂等），业务模块只注入它、禁止直连客户端；启动期 `ping` 校验连接，失败即中止启动（fail-fast）；运行期断线自动重连、离线命令直接拒绝（不排队、不静默成功）；新增自定义 Redis 健康指示器并入现有 `/health/ready`（沿用 5s 节流）。架构取舍记录于 ADR-003 与 Redis 集成设计文档。

本期只交付基础设施，不做登录态/令牌/业务缓存。

## 技术上下文

- **语言/版本**：TypeScript 5.0.0，Node >= 20
- **主要依赖**：NestJS 9.0.0、`@nestjs/config` 2、`@nestjs/terminus` 9.2.2（已装）；新增 `ioredis@^5`（**待人工评审安装，AI 不自行安装**；v5 自带类型，无需 `@types/ioredis`）
- **存储**：Redis 4.x（本地开发实例 4.0.11，AGENTS §2.3）；缓存仅为临时层，权威数据仍在 MongoDB
- **测试**：Jest（`pnpm test` 单测，mock ioredis 客户端）+ `pnpm test:e2e`（自举应用，`/health/ready` 含 redis 项，需本地 Redis 在跑）
- **目标平台**：Linux/macOS 服务端
- **项目类型**：web-service（NestJS 后端，横切基础设施模块）
- **性能目标**：缓存为内存级操作；核心读 P95 ≤ 200ms 的质量目标由后续业务接入时度量，本期不承诺业务 SLO
- **约束**：TTL 必填（禁永久键）；配置走 env 不硬编码；日志不含密码/缓存敏感值；故障明确上抛不内置降级；`enableOfflineQueue:false` 让断连期命令立即失败
- **规模/范围**：博客规模单实例 Redis；1 个全局模块、1 个统一服务、1 个健康指示器、3 个用户故事（FR-001~014）

## 宪法检查

_闸门：Phase 0 前必须通过，Phase 1 后复检。_

| 原则                | 结论               | 依据                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I TypeScript-First  | 通过               | `CacheService` 方法全部显式泛型与签名；ioredis v5 自带类型；禁 `any`，未知值用 `unknown`/泛型收窄                                                                                                                                                                                 |
| II NestJS 模块边界  | 通过               | 基础设施落 `src/common/cache/`；`@Global() CacheModule` 由 IoC 注入客户端（注入 token），业务代码不 `new Redis`；配置只经 `ConfigService`；客户端不导出给业务模块，只导出 `CacheService`                                                                                          |
| III Test-First      | 通过（执行期强制） | 所有生产逻辑任务在 tasks.md 按 RED→GREEN→REFACTOR 标注；配置纯函数、service、健康指示器均配单测；E2E 覆盖 readiness 含 redis                                                                                                                                                      |
| IV 安全合规默认开启 | 通过               | 统一封装缓存、Controller 不直连 Redis（宪法 §IV 明文）；密码仅经 env 注入；错误事件日志只打 host:port/db，不打密码、不打缓存值；写入强制 TTL；故障上抛不返回不确定状态；Redis 不直接暴露给用户                                                                                    |
| V 可观测/灰度/回滚  | 通过               | 连接错误事件结构化日志（host:port、错误名/首行信息，对齐 `mongoose.config.ts` 既有写法）；redis 健康项并入 readiness 且复用既有 5s 节流；回滚=移除模块注册与依赖，无 schema/数据迁移（缓存非权威数据，清空无数据损失）；指标导出/跨服务 Trace 属统一可观测设施，本期不建（YAGNI） |

无未决 `NEEDS CLARIFICATION`，无违例，无需 Complexity Tracking。

## 项目结构

### 本功能文档

```text
specs/002-redis-integration/
├── spec.md
├── plan.md            # 本文件
├── research.md        # Phase 0
├── data-model.md      # Phase 1（缓存条目/键命名/TTL 约定）
├── quickstart.md      # Phase 1 验证指南
├── contracts/
│   └── cache-service.md   # Phase 1：CacheService 内部接口契约
└── tasks.md           # /speckit-tasks 产出（本命令不创建）
```

架构文档（用户要求随本计划一并产出）：

```text
docs/architecture/
├── adr/ADR-003-redis-cache.md          # 缓存层基线决策（Confirmed）
└── design/redis-integration-design.md  # 集成实现设计（Confirmed）
```

### 源码

```text
src/
├── app.module.ts                       # 注册全局 CacheModule（增量，置于 HealthModule 之前）
├── common/
│   └── cache/
│       ├── cache.module.ts             # @Global 模块；提供 Redis 单例 + CacheService + 健康指示器
│       ├── cache.constants.ts          # 注入 token REDIS_CLIENT、配置键常量
│       ├── redis.config.ts             # buildRedisOptions(ConfigService): RedisOptions 纯函数（对齐 mongoose.config.ts）
│       ├── cache.service.ts            # 统一缓存服务：set(必带 TTL)/get(未命中 null)/del(幂等)
│       ├── redis.health.ts             # RedisHealthIndicator（自定义，terminus 9 已无内置 Redis 指示器）
│       ├── cache.service.spec.ts
│       └── redis.health.spec.ts
└── health/
    └── health.controller.ts            # readiness 指示器数组追加 redis（增量，沿用 5s 节流）

test/
└── redis-health.e2e-spec.ts            # /health/ready 含 redis up（E2E，需本地 Redis）
```

**结构决策**：

- 缓存是横切基础设施，落 `src/common/cache/`（与 `common/filters`、`common/interceptors` 同级），不放进某个业务模块。
- `CacheModule` 标 `@Global()`，业务模块直接注入 `CacheService` 即可，无需到处 import；但**只导出 `CacheService`**，ioredis 客户端用非导出的 provider token 持有，从结构上阻止业务代码绕过封装。
- 健康检查不新增端点，把 redis 指示器追加进现有 `/health/ready` 检查数组，复用控制器已有的 5s 结果节流；`/health/live` 继续不碰任何依赖。

## 复杂度跟踪

无违例，本表留空。
