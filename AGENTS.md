# AGENTS.md

> 文件介绍：本文件是 AI 代理进入本仓库的总入口，也是所有文档的总索引。
> 使用场景：所有代理在开始任何任务前必须先阅读本文件。
> 目标读者：AI 代理。
> 维护者：架构组。
> 状态：已确认。
> 更新时间：2026-10-22（§4 加载规则增补启动流程；§7 重排：三层框架拆入 §7.1–§7.3，Harness 为 §7.4，全局约束 §7.5，交接文件 §7.6；同日去重瘦身：evolve 细节归机制文件、JSON 示例删除以真实 handoff 文件为样板）。

## 1. 项目背景

本项目是一个基于 NestJS 构建的后端服务初始化模板，采用 MongoDB 作为主数据库进行持久化存储，Redis 作为缓存层提升数据读取性能，同时可支撑服务间通信、会话管理与令牌存储。

## 2. 项目基础

### 2.1 环境要求

- Node >= 20
- Pnpm >= 9
- MongoDB >= 7
- redis >= 4

> 环境要求有疑问或版本不一致时，读 [架构总览](./docs/architecture/overview.md) 的技术栈一节核对。

### 2.2 使用技术

- 编程语言：TypeScript@5.0.0
- 后端框架：NestJS@9.0.0
- 数据库：MongoDB@7.0.37
- 缓存：redis@4.0.11

> 涉及不确定技术时：必读 [架构总览](./docs/architecture/overview.md)

### 2.3 快速开始

#### 1. 安装依赖

```bash
pnpm install
```

#### 2. 本地开发

> 启动遇到无法解决的问题时，读 [开发指南](./docs/development/development.md) 排查。

> 1. 启动 Redis

```bash
cd /usr/local/redis-4.0.11
redis-server
```

> 2. 启动 MongoDB

```bash
mongod --dbpath ~/Documents/Study/new-blogs/Harness_Engineering_demo/mongod-database --port=27017
```

> 3. 运行项目

```bash
pnpm run start:local
```

#### 3. 环境变量

无需复制 env 文件：应用按 `NODE_ENV` 自动加载 `.env.local` / `.env.uat` / `.env.production`（默认 local，见 `src/app.module.ts`）。确认 `.env.local` 配置即可。

### 2.4 常用命令

- 本地启动：`pnpm run start:local`。
- 本地打包：`pnpm run build:local`。
- 本地测试：`pnpm run test`、`pnpm run test:e2e`。
- 检查与格式化 ：`pnpm run lint`、`pnpm run format`。
- 代码提交：`pnpm run commit`。
- 完整命令与本地依赖启动见[开发指南](./docs/development/development.md#6-常用命令) 。

## 3. 文档导航

- [项目根 README](./README.md)： 项目简介、快速开始、目录概览
- [文档总索引](./docs/index.md)： 所有文档入口
- [架构索引](./docs/architecture/README.md)：系统架构文档索引
- [架构总览](./docs/architecture/overview.md)：系统概览、模块地图
- [模块依赖](./docs/architecture/module-dependencies.md)：模块清单、依赖方向、演进顺序
- [关键数据流](./docs/architecture/data-flows.md)：登录、建分类标签、发文、浏览、评论链路
- [开发指南](./docs/development/development.md)： 开发流程
- [团队代码规范](./docs/architecture/engineering/code-style.md)： 团队代码规范
- [开发规范](./docs/development/coding-style.md)： 开发规范
- [编码硬约束](./docs/development/coding-style.md)：必须遵守的编码规则，无例外
- [编码禁止事项](./docs/development/coding-style.md)：编码层面明令禁止的做法
- [运维手册](./docs/operations/README.md)： 部署、回滚、故障处理

### 3.1 工具手册（按需加载）

- [Ponytail](./docs/ponytail/README.md)：惰性高级开发模式
- [Headroom](./docs/headroom/README.md)：上下文压缩
- [Caveman](./docs/caveman/README.md)：精简沟通模式
- [Codebase Memory](./docs/codebase-memory/README.md)：代码库记忆 MCP
- [Open Code Review](./docs/open-code-review/README.md)：AI 代码审查 CLI
- [Spec Kit 快速上手](./docs/spec-kit/README.md)：AI Spec-Kit 使用教程
- [Superpowers 快速上手](./docs/superpowers/README.md)：AI Superpowers 使用教程
- [Harness 多 Agent 手册](./docs/harness/README.md)：多角色协作、指令手册（commands.md）、自进化机制

## 4. 加载规则

### 4.1 启动流程（所有 Agent 新会话必须按序执行，禁止跳过）

1. 读本文件（全局规则，尤其 §6/§7/§8）。
2. 读 [宪法](./.specify/memory/constitution.md)：最高优先级，不可违背；冲突以宪法为准。
3. 读 [项目上下文](./docs/context.md)：当前状态、进行中工作、阻塞项、环境备忘。
4. 读 `.specify/superpowers-handoff.json`：确认当前 feature 与状态；写生产代码前必须是本人认领的 `executing`（流程见 §7.6）。
5. 确定角色并读对应规则：`agents/<role>-agent/AGENTS.md` 与 [agents/prompts.md](./agents/prompts.md)；角色不确定时按 [.cursor/rules/harness-agents.mdc](./.cursor/rules/harness-agents.mdc) 路由或用 `/role` 切换。
6. 按当前阶段加载产物：规划阶段读 `specs/<feature>/spec.md`、`plan.md`、`tasks.md` 及相关设计/ADR；执行阶段以 `tasks.md` 为唯一执行依据。

启动后必须满足的阶段门禁：

- 没有 spec → plan → tasks → `/speckit.analyze` 通过 + handoff `ready_for_execution`，**拒绝写生产代码**。
- 代码任务必须 TDD（RED→GREEN→REFACTOR）；禁止 `/speckit.implement` 绕过 Superpowers。
- 任务收尾必须 `/evolve`（见 §7.4.2）；中断/阻塞把 handoff 置 `blocked` 并写 `reason`。
- 自然语言即可触发流程命令，触发词与命令对照见 [commands.md](./commands.md)。

### 4.2 按需加载（不预读）

- [开发指南](./docs/development/development.md)：开发流程
- [团队代码规范](./docs/architecture/engineering/code-style.md)：团队代码规范
- [开发规范](./docs/development/coding-style.md)：开发规范
- 任务涉及架构改动时：必读 [架构总览](./docs/architecture/overview.md) 及相关 ADR，按[架构索引](./docs/architecture/README.md)的对照表按需加载
- 任务涉及某工具时：读取第 3.1 节对应的工具手册
- 阶段交接与角色交接物：[workflows/development-workflow.md](./workflows/development-workflow.md)
- 任务收尾复盘时：读取[进化机制](./.specify/memory/evolution-mechanism.md)，执行 `/evolve`

## 5. 维护规则

### 5.1 context.md

- 每次会话结束前，更新 `context.md` 的 `会话记录` 和 `进行中工作`。
- 新增决策时，先追加到 `关键决策草稿` 草稿区，等待人工确认后再移入 `关键决策`。
- 不要删除已有的 `关键决策`，只追加或标记为 “已废弃”。
- 日志超过 30 条时，主动提议压缩为摘要。

<!-- 后续章节预留：5.2 memory 记忆（或者 issues 记录） ... -->

## 6. 开发要求

### 6.1 开发原则

- 先读后写：修改前先阅读相关文件和文档。
- 小步提交：每个 PR 只做一件事。
- 不绕过测试和 lint。
- 不为通过测试而删除测试。
- 文档与代码必须在同一 PR 中更新。

### 6.2 开发规范

- [团队代码规范](./docs/architecture/engineering/code-style.md)： 团队代码规范
- [开发规范](./docs/development/coding-style.md)： 开发规范

### 6.3 测试规范

- 运行时：Node 20+（见 `.nvmrc`）+ pnpm 9
- 安装依赖：`pnpm install`
- 快速检查：`pnpm lint`
- 单元测试：`pnpm test`
- 单文件：`pnpm test src/foo.test.ts`
- E2E：`pnpm test:e2e`，测试内自举应用，无需先启动服务
- 覆盖率：`pnpm run test:cov`，目标 80%（当前未配置 Jest 强制阈值）
- 本地提交钩子：`.husky/pre-commit` 对暂存文件跑 lint-staged（eslint --fix + prettier），`.husky/commit-msg` 校验提交信息；只查增量，不跑全量测试
- 提 PR 前必须本地跑全量：`pnpm lint && pnpm test`，退出码 0
- 强制门禁以 CI 为准：CI 未过不得合并（见 §6.5）
- 通过标准：退出码 0，无失败
- 失败处理：看第一个失败；环境问题先修复；不要跳过/删除测试；禁止用 --no-verify 绕过钩子
- 禁止：用生产密钥；提交 `coverage/`、`dist/`；修改 CI 绕过测试

### 6.4 代码审查

- 运行环境：Node 20+（见 `.nvmrc`）+ pnpm 9
- 本地环境：20.20.1
- 审查分支：从 `context.md` 中获取
- 触发命令：`ocr review -B ./specs/<feature>/checklists/requirements.md`

### 6.5 PR 检查清单

- [ ] 代码通过测试
- [ ] 代码通过 lint
- [ ] 相关设计文档已更新
- [ ] 关键决策已写 ADR
- [ ] `context.md` 已更新
- [ ] 没有提交敏感信息

### 6.6 分支规范

- 主分支：main 生产，develop 集成
- 分支命名：`<type>/<issue-id>-<short-desc>`
- 类型：参考[提交信息类型](./docs/architecture/engineering/commit-convention.md#type-类型)
- 基线：feature/fix 从 develop；hotfix 从 main；release 从 develop
- 必须 PR，禁止直接推 main/develop
- 合并前：同步目标分支、解决冲突、CI 通过、审查通过
- 合并策略：feature/fix squash；release/hotfix merge commit + tag
- 合并后删除分支
- 禁止 force push 共享分支，禁止提交密钥/生成物
- AI 代理：未经允许不创建远程分支、不合并、不删除远程分支

### 6.7 提交规范

- 提交信息使用 Conventional Commits，类型枚举以 `commitlint.config.cjs` 的 `promptTypes` 为准，具体类型请按[提交信息类型](./docs/architecture/engineering/commit-convention.md#type-类型)。
- 关联需求编号，例如：`feat(auth): 实现登录接口 (#001)`。
- 不要提交敏感信息（API Key、密码、Token）。
- 更多的 commit 要求请按[提交信息规范](./docs/architecture/engineering/commit-convention.md)

## 7. 工作流总览

本项目采用 Spec-Kit + Superpowers 手动集成工作流。产物统一落盘到 `specs/<feature>/`（含 `spec.md`、`plan.md`、`tasks.md`）；`<feature>` 用短横线小写命名。

### 7.1 阶段一：Spec-Kit 设计 (WHAT)

规划层（WHAT）：决定做什么、怎么做、拆成什么任务，拥有唯一规划权。

1.  `/speckit.constitution` — 建立或更新项目宪法。
2.  `/speckit.specify` — 撰写功能规范 `specs/<feature>/spec.md`。
3.  `/speckit.clarify` — 澄清规范中的模糊点（按需，可多轮）。
4.  `/speckit.plan` — 生成实现计划 `plan.md`。
5.  `/speckit.tasks` — 生成任务清单 `tasks.md`。
6.  `/speckit.analyze` — **强制闸门**：校验 spec/plan/tasks 三者一致性；有不一致必须先修复，不得进入交接。

### 7.2 阶段二：手动交接 (HANDOFF)

交接层：规划产物经一致性闸门后，通过 `.specify/superpowers-handoff.json` 移交执行权。

1.  **强制步骤**：在 analyze 通过后，创建或更新 `.specify/superpowers-handoff.json`（字段见 §7.6）。
2.  填全 `feature_directory`、`tasks_file`、`source_of_truth`、`constitution`，再将 `status` 置为 `ready_for_execution`。字段不全禁止置位。

### 7.3 阶段三：Superpowers 执行 (HOW)

执行层（HOW）：handoff 认领后以 tasks.md 为唯一依据，按 Superpowers 纪律实现（TDD、systematic-debugging、verification-before-completion）；交接文件见 §7.6，全局约束见 §7.5。

1.  **强制步骤**：执行任何实现前，读取 `.specify/superpowers-handoff.json`。
2.  仅当 `status=ready_for_execution` 时，写入 `claimed_by`/`claimed_at` 并将状态原子置为 `executing`（认领，见 §7.6）。
3.  使用 `superpowers:executing-plans` 技能，以 `tasks_file` 为唯一执行依据。
4.  **TDD 范围**：凡新增/修改生产逻辑代码的任务，必须先写失败测试（RED）→ 最小实现（GREEN）→ 重构（REFACTOR），技能 `superpowers:test-driven-development`；纯文档、配置、重命名任务在 `tasks.md` 标注 `[no-test]` 后豁免。
5.  全部任务完成后，跑 `superpowers:verification-before-completion`（可用 `/speckit.converge` 对照规格补漏），通过才将 `status` 置为 `complete`。
6.  执行中断、任务失败或阻塞时，置 `status=blocked` 并写 `reason`，不得停留在 `executing`。

### 7.4 Harness 多 Agent 协作层（角色与进化）

角色与进化层（WHO / 复盘）：§7.1–§7.3 解决「按什么流程做」，本节规定「由哪个角色做、教训如何沉淀」；§7.5 为三层共用约束，§7.6 为交接文件规则。完整手册见 [docs/harness/README.md](./docs/harness/README.md)，角色规则是宪法与本文件的下位文件，冲突时以宪法、AGENTS.md 为准。

#### 7.4.1 角色（纯后端，四角色，不设前端角色）

| 角色            | 职责边界                                                                                                            | 规则文件                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 🏛️ arch-agent   | 宪章维护、spec/plan/tasks 评审与 analyze 闸门、handoff 编排、ADR、Code Review、EVO 归并；不写业务代码               | [agents/arch-agent/AGENTS.md](./agents/arch-agent/AGENTS.md)     |
| 👨‍💻 dev-agent    | 认领 handoff 后按 tasks.md 以 TDD 实现 NestJS 模块（Controller/Service/Mongoose Schema/DTO），缓存只经 CacheService | [agents/dev-agent/AGENTS.md](./agents/dev-agent/AGENTS.md)       |
| 🧪 test-agent   | Jest 单测 + supertest E2E、契约/权限/边界覆盖、Bug 报告、验收门禁                                                   | [agents/test-agent/AGENTS.md](./agents/test-agent/AGENTS.md)     |
| 🔧 devops-agent | env 与本地依赖、CI 门禁、部署回滚（expand-contract）、健康检查、安全加固、故障处置                                  | [agents/devops-agent/AGENTS.md](./agents/devops-agent/AGENTS.md) |

角色可随时用 `/role <arch|dev|test|devops>-agent` 或自然语言切换，但同一时间只按一个角色的职责边界行动，跨职责产出移交对应角色；注入 Prompt 见 [agents/prompts.md](./agents/prompts.md)，指令表见 [commands.md](./commands.md)，阶段-角色交接物对照见 [workflows/development-workflow.md](./workflows/development-workflow.md)，Cursor 文件类型路由建议见 [.cursor/rules/harness-agents.mdc](./.cursor/rules/harness-agents.mdc)。

#### 7.4.2 自进化机制（/evolve）

任务 converge 后、handoff 置 `complete` 前强制执行；Bug 修复、故障处置、同类问题第 2 次出现也触发。产出 EVO 记录（`pending_apply`），规则必须归并到既有权威文件后置 `applied` 并在机制文件索引登记；同一错误禁止记录超过 2 次，历史 EVO 只追加不改写。

触发时机、模板、归并目标、优先级与完成判定详见 [.specify/memory/evolution-mechanism.md](./.specify/memory/evolution-mechanism.md)。

### 7.5 全局强制约束（所有 Agent 必须遵守）

三层（Spec-Kit / Superpowers / Harness）共用同一条硬约束：宪法最高优先级，规范是唯一真相来源；无 analyze 通过 + handoff `ready_for_execution`，不得写生产代码。

- **唯一真相来源**：设计以 `spec.md`/`plan.md` 为准，任务执行以 `tasks.md` 为准；handoff 的 `source_of_truth` 指向 feature 目录，`tasks_file` 指向具体任务文件。
- **执行权唯一**：实现阶段只允许走 Superpowers（§7.3）。**禁止调用 `/speckit.implement`** 绕过 TDD。
- **禁止重叠**：`status=executing` 时，禁止再次调用 `/speckit.plan` 或 `/speckit.tasks`；需改规划先落 `blocked` 并人工确认。
- **宪法优先**：执行时必须读取并遵守 `.specify/memory/constitution.md`。
- **测试优先**：新增/修改生产逻辑必须先写失败测试，再写实现（TDD）；单元测试覆盖率目标 ≥80%（[no-test] 豁免见 §7.3）
- **单一职责**：一次只做一个任务，禁止把多个不相关的修改混在同一个提交里
- **证据驱动完成**：任务完成必须提供验证证据（`pnpm lint && pnpm test` 等命令的真实输出、接口返回、构建日志），禁止口头声称完成
- **最小权限**：禁止执行破坏性命令、禁止提交敏感信息（密钥、密码、令牌）；AI 代理未经允许不得创建/合并/删除远程分支（见 §8、§6.6）
- **Git 规范**：严格遵守 §6.6 分支规范与 §6.7 提交规范（Conventional Commits）

### 7.6 交接文件维护规则

- 路径：`.specify/superpowers-handoff.json`；维护者：当前 feature 的编排 Agent，人类审查。
- 字段：`feature_directory`、`source_of_truth`、`tasks_file`、`constitution`、`status`、`claimed_by`、`claimed_at`、`reason`、`last_updated`；字段不全禁止置 `ready_for_execution`，当前文件即完整样板。
- 状态机：

```text
draft → ready_for_execution → executing → complete
                    ↑            │
                    +────────────┴→ blocked（填 reason，人工处理后回 ready_for_execution）
```

- 仅在状态转换或引用路径变化时修改；`last_updated` 不作心跳。
- 并发保护：进入 `executing` 必须同时写 `claimed_by`（Agent/会话标识）与 `claimed_at`（ISO 时间）；已被认领且非本人时不得接管。

## 8. 禁止事项

- 禁止提交密钥、令牌、密码，但是 `.env.local`，`.env.uat`，`.env.production` 三个文件除外.
- 禁止直接修改 `main` 分支.
- 禁止执行破坏性命令（如 `rm -rf`、`DROP DATABASE`）。
- 禁止绕过认证、授权或安全校验。
- 禁止引入未经验证的外部依赖。
- 禁止在未更新文档的情况下合并架构级变更。

## 9. 文档状态说明

### 9.1 描述文档

| 中文状态 | 英文状态   | 枚举值       | 说明                                         |
| -------- | ---------- | ------------ | -------------------------------------------- |
| 草稿     | Draft      | `Draft`      | 作者正在编写，尚未提交评审，内容可能大幅变化 |
| 待确认   | Pending    | `Pending`    | 仍在讨论，可能变化。                         |
| 已确认   | Confirmed  | `Confirmed`  | 评审通过，内容完成，作为当前基线。           |
| 已发布   | Published  | `Published`  | 正式生效，可对外/对团队引用。                |
| 已废弃   | Deprecated | `Deprecated` | 不再维护，被新文档替代。                     |
| 已归档   | Archived   | `Archived`   | 历史留存，不再变更。                         |

**状态流转**

```text
草稿 → 待确认 → 已确认 → 已发布 → 已废弃
  ↑       ↓________|        |         |
  +--------回退-------------+---------+
任意状态 → 已归档
```

### 9.2 架构类 ADR 文档 与 Design 文档

| 中文状态 | 英文状态   | 枚举值       | 说明                                         |
| -------- | ---------- | ------------ | -------------------------------------------- |
| 草稿     | Draft      | `Draft`      | 作者正在编写，尚未提交评审，内容可能大幅变化 |
| 待确认   | Pending    | `Pending`    | 仍在讨论，可能变化                           |
| 已确认   | Confirmed  | `Confirmed`  | 评审通过，内容完成，作为当前基线             |
| 已发布   | Published  | `Published`  | 正式生效，可对外/对团队引用                  |
| 已废弃   | Deprecated | `Deprecated` | 不再维护，被新文档替代                       |
| 已归档   | Archived   | `Archived`   | 历史留存，不再变更                           |

<!-- 后续章节预留：9.3 流程文档状态、9.4 ... -->
