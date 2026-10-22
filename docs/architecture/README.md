# 架构文档索引

## AI 阅读指引

- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 按需阅读

| 当任务涉及     | 读取文件                                                                     |
| -------------- | ---------------------------------------------------------------------------- |
| 架构总览       | [./overview.md](./overview.md)                                               |
| 模块依赖       | [./module-dependencies.md](./module-dependencies.md)                         |
| 关键数据流     | [./data-flows.md](./data-flows.md)                                           |
| 架构编码规范   | [./development-standards.md](./development-standards.md)                     |
| 工程化概览     | [./engineering/README.md](./engineering/README.md)                           |
| 架构决策 ADR   | [ADR 索引](#adr-索引)（文件在 `adr/`）                                       |
| 模块设计文档   | `design/` 目录，命名 `{module}.md`                                           |
| 用户模块       | [./design/user-module-design.md](./design/user-module-design.md)             |
| Redis 缓存集成 | [./design/redis-integration-design.md](./design/redis-integration-design.md) |

## 读者导航

| 角色       | 建议阅读顺序                                  |
| ---------- | --------------------------------------------- |
| 新成员     | 系统概览 → 模块地图 → 各模块 design.md        |
| 修改某模块 | 对应 design.md → 关联 ADR                     |
| 做架构决策 | ADR 索引 → 相关 design.md → 新建 ADR          |
| AI 代理    | `AGENTS.md` → 本 README → 按需加载 design/ADR |

## ADR 索引

| 编号                                                   | 标题                                                     | 状态      | 日期                                   | 影响模块                    |
| ------------------------------------------------------ | -------------------------------------------------------- | --------- | -------------------------------------- | --------------------------- |
| [ADR-001](./adr/ADR-001-mongodb.md)                    | 采用 MongoDB 作为核心数据存储                            | Confirmed | 2026-10-12                             | 数据存储 / 全部业务模块     |
| [ADR-002](./adr/ADR-002-user-module.md)                | 用户模块数据模型与权限基线                               | Confirmed | 2026-10-13（2026-10-14 评审确认）      | 用户模块                    |
| [ADR-003](./adr/ADR-003-redis-cache.md)                | Redis 作为统一缓存层及接入基线                           | Confirmed | 2026-10-14（2026-10-15 实现+评审确认） | 缓存基础设施 / 全部业务模块 |
| [ADR-004](./adr/ADR-004-opaque-token-redis-session.md) | 登录会话：不透明令牌 + Redis 服务端会话 + 每请求账号回查 | Draft     | 2026-10-22                             | 登录鉴权模块                |

> 新增 ADR 时，在此表追加一行。详细内容见 `adr/` 目录。

## 文档维护规范

- 设计文档放在 `design/`，命名 `{module}.md`
- ADR 放在 `adr/`，命名 `ADR-{4位编号}-{短标题}.md`
- 新增文档后必须更新本 README
- 架构发生变化时，必须同步更新 `overview.md` 和相关专题文档
- `design.md` 必须引用相关 ADR
- ADR 不硬编码 `design.md` 路径，只写影响模块/主题
- 反向链接由工具或 CI 自动生成
- 架构图优先使用 Mermaid，便于版本管理和评审
- 文档应标明状态、最后更新时间和维护人

## 10. 维护规则

- `design`：就地覆盖，保持当前有效
- `ADR`：只追加，旧决策标记 `Superseded`
- 每季度审查一次 ADR 状态
- 文档无 Owner 时，应分配或删除

## 11. 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-22：实现计划 `specs/003-user-login/plan.md` 产出，新增 ADR-004（不透明令牌 + Redis 服务端会话 + 每请求账号回查，Draft），登记 ADR 索引。
- 2026-10-15：`specs/002-redis-integration` 实现并评审完成（T001–T018，TDD；单测 103 / E2E 20 全绿，含真实 Redis 的 fail-fast、断线即败、自动重连手工验证；OCR 评审 4 条意见已修复），ADR-003 与 `design/redis-integration-design.md` 及功能规格转 Confirmed。
- 2026-10-14：实现计划 `specs/002-redis-integration/plan.md` 产出，新增 ADR-003（Redis 统一缓存层及接入基线，Draft）与 `design/redis-integration-design.md`（Draft），登记 ADR 索引与按需阅读表。
- 2026-10-14：代码评审通过，ADR-002 与用户设计文档状态 Pending → Confirmed，索引同步。
- 2026-10-14：实现计划 `specs/001-user-module/plan.md` 产出，ADR-002 与用户设计文档状态 Draft → Pending，索引同步。
- 2026-10-13：新增 ADR-002（用户模块数据模型与权限基线，Draft）与 `design/user-module-design.md`（Draft），登记 ADR 索引与按需阅读表。
