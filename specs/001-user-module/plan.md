# 实现计划：用户模块（User Module）

**分支**：`001-user-module` | **日期**：2026-10-14 | **规格**：[spec.md](./spec.md)

**输入**：`specs/001-user-module/spec.md`

## 摘要

实现 NestJS 9 用户模块：公开注册（用户名/邮箱/密码）、本人查看与改邮箱、管理员的用户列表/详情/设置管理员/软删除。数据存 MongoDB（Mongoose 6），单 `users` 集合，含 `usernameLower` 大小写不敏感唯一索引与 `deletedAt` 软删除；密码 bcrypt（cost ≥ 10）；HTTP 仅 GET/POST 且写参数走 body。技术取舍已在 ADR-002 与用户模块设计文档定稿，本计划只对齐落地结构，不重复选型论证。

## 技术上下文

- **语言/版本**：TypeScript 5.0.0，Node >= 20
- **主要依赖**：NestJS 9.0.0、`@nestjs/mongoose` 9、Mongoose 6、MongoDB 7；T001 已完成人工评审并安装 `bcrypt`、`class-validator`、`class-transformer`
- **存储**：MongoDB 7（`users` 集合，唯一索引 `usernameLower`/`email`）；Redis 本模块不使用
- **测试**：Jest（`pnpm test` 单测）+ `pnpm test:e2e` 自举应用
- **目标平台**：Linux/macOS 服务端
- **项目类型**：web-service（NestJS 后端）
- **性能目标**：90% 注册/改资料请求 2 秒内返回；核心读 P95 ≤ 200ms（宪法 V）
- **约束**：仅 GET/POST；POST 参数走 body；密码不明文；唯一约束由 DB 索引裁决；软删记录不物理删
- **规模/范围**：博客规模，单集合、7 个接口、3 个用户故事（FR-001~017）

## 宪法检查

_闸门：Phase 0 前必须通过，Phase 1 后复检。_

| 原则                | 结论               | 依据                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I TypeScript-First  | 通过               | 全部 DTO/Service 显式类型，禁 `any`；出参走 `UserResponseDto`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| II NestJS 模块边界  | 通过               | `module/controller/service/dto/schemas/guards` 固定分层；导出 Service，不跨模块直连 Schema                                                                                                                                                                                                                                                                                                                                                                                        |
| III Test-First      | 通过（执行期强制） | 每个生产逻辑任务按 RED→GREEN→REFACTOR，tasks.md 标注；单测+E2E                                                                                                                                                                                                                                                                                                                                                                                                                    |
| IV 安全合规默认开启 | 通过               | 全局 ValidationPipe + DTO；bcrypt cost≥10；`password`/`usernameLower`/`deletedAt` 不出参；RolesGuard（角色可选，兼认证）；注册 DTO 不收 `isAdmin`；全局异常过滤器不泄堆栈                                                                                                                                                                                                                                                                                                         |
| V 可观测/灰度/回滚  | 通过               | 访问日志拦截器每请求生成 `requestId`（标准库 `crypto.randomUUID()`）并输出结构化日志（requestId/method/path/status/耗时，不打 password），关键链路 100% 可按 requestId 关联，满足原则 V 的日志与 Trace 最低要求；**指标导出/跨服务 TraceContext 传播明确延后**到统一可观测设施（tasks T034 带 `ponytail:` 天花板注释，另立后续功能，不在本规格内静默豁免）；SC-006 的 2s 反馈本期由 E2E/手工冒烟验证；唯一索引建法按环境区分（生产 autoIndex=false）；不涉及 API 删除，可直接回滚 |

无未决 `NEEDS CLARIFICATION`，无违例，无需 Complexity Tracking。

## 项目结构

### 本功能文档

```text
specs/001-user-module/
├── spec.md
├── plan.md            # 本文件
├── research.md        # Phase 0
├── data-model.md      # Phase 1
├── quickstart.md      # Phase 1
├── contracts/
│   └── user-api.md    # Phase 1 接口契约
└── tasks.md           # /speckit-tasks 产出（本命令不创建）
```

### 源码

```text
src/
├── app.module.ts                 # 注册 UserModule（增量）
├── main.ts                       # 全局 ValidationPipe / 异常过滤器 / 访问日志拦截器（如缺则补）
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts   # 统一错误体 + CastError→400（契约错误码承诺，analyze C1）
│   └── interceptors/
│       └── access-log.interceptor.ts  # requestId + 结构化访问日志/耗时（宪法 V 日志与 Trace 最低基线，analyze C2/D1）
└── modules/user/
    ├── user.module.ts
    ├── user.controller.ts
    ├── user.service.ts
    ├── dto/
    │   ├── create-user.dto.ts
    │   ├── update-user.dto.ts
    │   ├── set-admin.dto.ts
    │   ├── delete-user.dto.ts
    │   ├── user-query.dto.ts
    │   └── user-response.dto.ts
    ├── schemas/
    │   └── user.schema.ts
    └── guards/
        ├── roles.guard.ts            # 角色可选：无 @Roles 元数据时仅认证（/users/me 用），analyze U1
        └── current-user.interface.ts   # 后续登录模块注入 request.user 的约定
```

> E2E 测试基建：`test/helpers/e2e-app.ts`（`createTestApp()` + `x-test-user` 桩 Guard），登录模块落地后删除（analyze U2）。

**结构决策**：单体 NestJS 应用内按业务域新增 `src/modules/user/`，遵循宪法原则 II 与设计文档 §2；不新增项目/子包。

## 复杂度跟踪

无违例，本表留空。
