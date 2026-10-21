# Harness 多 Agent 角色索引

> Harness 多角色协作层：在 Spec-Kit（规划权）+ Superpowers（执行权）之上定义「谁在什么角色下工作」。
> 全局规则以根 [AGENTS.md](../AGENTS.md) 与 [宪法](../.specify/memory/constitution.md) 为准；本目录文件只定义角色职责，不得与二者冲突。
> 角色机制与进化机制说明见 [Harness 手册](../docs/harness/README.md)。

## 角色清单

本项目为纯后端（NestJS 9 + MongoDB/Mongoose + Redis），不设前端角色。

| 角色                          | 职责                                                                       | 规则文件                                           | 注入 Prompt                |
| ----------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------- |
| 🏛️ arch-agent（架构师）       | 宪章维护、spec/plan/tasks 评审与一致性闸门、ADR、Code Review、进化记录归并 | [arch-agent/AGENTS.md](./arch-agent/AGENTS.md)     | [prompts.md](./prompts.md) |
| 👨‍💻 dev-agent（后端开发）      | NestJS 模块开发（Controller/Service/Schema/DTO）、TDD、缓存接入            | [dev-agent/AGENTS.md](./dev-agent/AGENTS.md)       | [prompts.md](./prompts.md) |
| 🧪 test-agent（测试工程师）   | 单测/E2E 用例设计与执行、Bug 报告、覆盖率与验收                            | [test-agent/AGENTS.md](./test-agent/AGENTS.md)     | [prompts.md](./prompts.md) |
| 🔧 devops-agent（运维工程师） | 环境配置、部署/回滚、CI 门禁、安全扫描、故障处理                           | [devops-agent/AGENTS.md](./devops-agent/AGENTS.md) | [prompts.md](./prompts.md) |

## 使用规则

1. 切换角色：自然语言（「切换到测试工程师角色」）或 `/role <角色名>`，完整指令表见 [commands.md](../commands.md)。
2. 角色可随时切换，但同一时间只按一个角色的职责边界行动；跨职责的产出必须移交对应角色。
3. 角色规则是 AGENTS.md §6/§7/§8 的细化，不是豁免：TDD、handoff 状态机、分支与提交规范对所有角色生效。
4. 每个任务完成后必须执行 `/evolve` 复盘（见[进化机制](../.specify/memory/evolution-mechanism.md)），否则任务不算完成。
5. 新增角色：在本目录新建 `<role>-agent/AGENTS.md` 并更新本索引与 [docs/harness/README.md](../docs/harness/README.md)。
