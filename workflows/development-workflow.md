# Harness 标准开发工作流

> 本文件把通用 SDD 11 阶段映射到本仓库既有治理（AGENTS.md §7 三阶段 + handoff 状态机 + 宪法门禁），并明确每个阶段的角色、动作与产物。
> 不定义新流程；与 AGENTS.md §7、宪法冲突时以后者为准。

## 全流程与角色映射

```text
需求 → ①specify → ②clarify → ③plan → ④tasks → ⑤analyze闸门 → ⑥HANDOFF
     → ⑦认领执行(TDD) → ⑧评审 → ⑨测试验收 → ⑩交付合并 → ⑪evolve复盘
```

| 阶段               | 主责角色                   | 动作                                                                                                                         | 产物 / 状态                           |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| ① specify          | arch-agent                 | `/speckit.specify`，写清做什么、范围边界、用户故事、验收标准                                                                 | `specs/<feature>/spec.md`（Draft）    |
| ② clarify          | arch-agent                 | `/speckit.clarify`，至多轮澄清并回写 spec                                                                                    | spec 无歧义                           |
| ③ plan             | arch-agent（dev 输入）     | `/speckit.plan`：选型、模块边界、Schema/索引、缓存、契约、风险、expand-contract                                              | `plan.md`；重大选型附 ADR 草稿指针    |
| ④ tasks            | arch-agent                 | `/speckit.tasks`：小步任务、依赖有序；代码任务标 TDD，文档/配置标 `[no-test]`；图标遵循宪法状态标记规范                      | `tasks.md`                            |
| ⑤ analyze **闸门** | arch-agent                 | `/speckit.analyze` 交叉一致性校验                                                                                            | 不一致先修复，禁止进入交接            |
| ⑥ HANDOFF          | arch-agent                 | 填全 `.specify/superpowers-handoff.json` 四路径与 constitution，置 `ready_for_execution`                                     | handoff 字段完整                      |
| ⑦ 执行             | dev-agent（test 早期介入） | 认领置 `executing`；Superpowers `executing-plans` + TDD（RED→GREEN→REFACTOR）；每任务 `pnpm test` 绿后勾选；阻塞置 `blocked` | 代码 + 同目录 `*.spec.ts`；tasks 勾选 |
| ⑧ 评审             | arch-agent（OCR 辅助）     | PR + `ocr review -B specs/<feature>/checklists/requirements.md`；按角色 CR 清单逐条核对；意见走 receiving-code-review        | 评审通过 / 打回                       |
| ⑨ 测试验收         | test-agent                 | `pnpm lint && pnpm test` + `pnpm test:e2e`；按验收清单与契约核验；缺陷返 ⑦                                                   | 测试证据、Bug 列表                    |
| ⑩ 交付合并         | dev-agent + 人工           | `verification-before-completion`、`finishing-a-development-branch`；文档与代码同 PR；CI 绿；人工合并                         | handoff `complete`                    |
| ⑪ evolve           | 全员，arch 归并            | `/evolve`：生成 EVO 记录 → 归并规则到权威文件 → `applied` 登记索引 → 更新 context.md                                         | EVO `applied`                         |

> 阶段 ⑪ 位于 handoff 置 `complete` 之前（见 [进化机制](../.specify/memory/evolution-mechanism.md)）；本仓库 001/002 两个 feature 的收尾记录在 `docs/context.md`，新 feature 起强制留存 EVO。

## 角色交接物

- arch → dev：analyze 通过的 spec/plan/tasks + `ready_for_execution` handoff + 相关 ADR/设计。
- dev → test：可运行分支、契约文件、变更接口清单、已跑过的测试证据。
- test → dev：标准 Bug 报告（格式见 `agents/test-agent/AGENTS.md`），修复后复验回归。
- dev → arch：PR 描述关联 feature 与需求编号、验证输出、文档/context 更新。
- 全员 → arch：`/evolve` 记录（pending_apply），arch 归并后置 applied。

## 跨职能并行点

- plan 阶段 test-agent 可并行起草验收用例要点（不写实现依赖的用例）。
- 执行阶段多个**无共享状态**的任务可用 Superpowers `dispatching-parallel-agents` 并行；同一文件/模块的任务串行。
- devops-agent 在 plan 评审介入配置/依赖/环境变量评审，在交付前介入部署与回滚审查；本仓库暂无 Dockerfile/流水线文件，相关产出需先经 ADR。

## Hotfix 最小流程

1. 定级 P0/P1（devops）；arch 快速评估修复方案。
2. 从 `main` 切 `hotfix/<id>-<desc>`；先写复现测试（RED）再修复（GREEN）。
3. OCR 最小评审 + test-agent 核心场景回归；人工紧急合并发布。
4. 事后补齐：spec/tasks 记录、context 会话记录、EVO 复盘；必要时补 ADR。

## 禁止事项（流程视角）

- 禁止 analyze 未过或 handoff 未就绪就写实现；禁止用 `/speckit.implement` 顶替认领执行。
- 禁止 `executing` 状态下重新 plan/tasks（先 blocked + 人工确认）。
- 禁止跳过评审/测试/evolve 直接合并；禁止文档与代码分离的 PR。
