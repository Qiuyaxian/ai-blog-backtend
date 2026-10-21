# Harness 多 Agent 手册

> 状态：Confirmed
> 更新时间：2026-10-22
> Harness 是本仓库在 Spec-Kit（规划权）+ Superpowers（执行权）之上的多角色协作层：规定「谁在什么环节、按什么职责边界工作」，并通过自进化机制把任务教训沉淀为可执行规则。

## 1. 组成

| 组成        | 路径                                                                                       | 作用                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 全局规则    | [AGENTS.md](../../AGENTS.md) §4.1、§7.1–§7.6                                               | §4.1 会话启动流程；§7.1–§7.3 三层流程（三层定位见各节开头）；§7.4 角色协作层；§7.5 全局约束；§7.6 交接文件 |
| 角色索引    | [agents/README.md](../../agents/README.md)                                                 | 四角色与规则文件导航                                                                                       |
| 角色规则    | `agents/<role>-agent/AGENTS.md`                                                            | 各角色职责、流程、权限、禁令                                                                               |
| 注入 Prompt | [agents/prompts.md](../../agents/prompts.md)                                               | 复制即用的全局 + 角色 Prompt                                                                               |
| 指令手册    | [commands.md](../../commands.md)                                                           | 斜杠命令、工程命令、自然语言触发词                                                                         |
| 工作流      | [workflows/development-workflow.md](../../workflows/development-workflow.md)               | 11 阶段到 §7 三阶段 + 角色交接映射                                                                         |
| 进化机制    | [.specify/memory/evolution-mechanism.md](../../.specify/memory/evolution-mechanism.md)     | 触发时机、记录格式、归并流程、优先级                                                                       |
| 进化模板    | [.specify/templates/evolution-template.md](../../.specify/templates/evolution-template.md) | EVO 记录模板                                                                                               |
| 进化记录    | `.specify/memory/evolution/EVO-*.md`                                                       | 编号归档的复盘记录                                                                                         |
| Cursor 路由 | [.cursor/rules/harness-agents.mdc](../../.cursor/rules/harness-agents.mdc)                 | 按文件类型的角色建议                                                                                       |

## 2. 角色

纯后端项目，四个角色，不设前端角色：

- 🏛️ **arch-agent**：宪章维护、spec/plan/tasks 评审与 analyze 闸门、handoff 编排、ADR、Code Review、EVO 归并。不写业务代码。
- 👨‍💻 **dev-agent**：NestJS 模块 TDD 实现（Controller/Service/Mongoose Schema/DTO）、缓存只经 `CacheService`、缺陷修复。
- 🧪 **test-agent**：Jest 单测与 supertest E2E、契约/权限/边界覆盖、Bug 报告、验收门禁。
- 🔧 **devops-agent**：env 与本地依赖、CI 门禁、部署回滚（expand-contract）、健康检查与监控、安全加固、故障定级处置。

角色可随时切换（`/role <角色名>` 或自然语言），但同一时间只按一个角色的职责边界行动；跨职责产出移交对应角色。

## 3. 与现有工作流的关系

```text
Spec-Kit 规划（arch）          Superpowers 执行（dev/test）       Harness
specify→plan→tasks→analyze → handoff ready → 认领 TDD → 评审/验收 → evolve
        arch-agent                    dev/test-agent              全员复盘，arch 归并
```

- Harness 不改变权力划分：规划仍只归 Spec-Kit，执行仍只归 Superpowers，handoff 状态机不变。
- `/speckit.implement` 在本仓库依旧禁止；角色层新增指令只有 `/role` 与 `/evolve`。
- 详细阶段/角色/交接物对照表见 [workflows/development-workflow.md](../../workflows/development-workflow.md)。

## 4. 自进化机制（/evolve）

任务收敛后、handoff 置 `complete` 前强制执行：用模板产出编号 EVO 记录（`pending_apply`），规则归并到唯一权威文件后置 `applied` 并登记索引；同一错误禁止出现第 3 次。

触发时机、记录格式、归并目标、P0–P3 优先级与完成判定以 [.specify/memory/evolution-mechanism.md](../../.specify/memory/evolution-mechanism.md) 为唯一权威，本手册不复述。

## 5. 使用示例

- 「切换到架构师角色，评审 003 的 plan」→ 加载 `agents/arch-agent/AGENTS.md`，按 plan 清单逐条核对。
- 「以 dev-agent 认领 003，从 T001 开始 TDD」→ 检查 handoff、认领置 executing、RED→GREEN→REFACTOR。
- 「003 收尾，复盘」→ `/evolve` 产出 EVO，归并规则，更新 context，handoff complete。

## 更新记录

- 2026-10-22 @架构组：初版，接入四角色、指令手册、工作流映射与自进化机制（EVO-20261022001）。
