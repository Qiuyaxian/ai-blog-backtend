# Harness 自进化机制

> 核心原则：每完成一个任务必须复盘一次，把教训转成可执行规则，不犯第二次同样的错误。
> 上位约束：本机制是 AGENTS.md §7 Spec-Kit + Superpowers 工作流的收尾环节，不改变规划权/执行权划分；宪法修订仍须走 Governance 程序。

## 🧬 一、触发时机（强制）

1. 任务完成、`/speckit.converge` 对照规格收敛通过后；handoff 置 `complete` 之前。
2. Bug 修复完成后（先有复现测试，修复后复盘）。
3. 线上故障 / 应急处置结束后。
4. 同一问题重复出现第 2 次时（第 2 次必须更新规则，不允许出现第 3 次）。
5. 学到可复用的最佳实践或工具用法时。

## 📝 二、记录格式与存放

- 目录：`.specify/memory/evolution/`
- 文件名：`EVO-YYYYMMDDNNN-<短横线小写主题>.md`，序号按当天递增（如 `EVO-20261022001-接入harness多角色与进化机制.md`）。
- 模板：[.specify/templates/evolution-template.md](../templates/evolution-template.md)
- 记录必须含：任务/场景、根因分析、解决方案、**沉淀的可执行规则（必须/禁止句式）**、受影响文件、防重复验证项；frontmatter 含 `evolution_id / date / task_id / agent / priority / status`。
- 状态：`pending_apply`（已记录待归并）→ `applied`（规则已落入对应文件）。只记录不归并视为未完成。

## 🔄 三、`/evolve` 执行步骤

1. 回顾任务全过程：错误点、低效点、返工点、评审/测试中暴露的问题。
2. 按模板生成进化记录，编号落盘到 `evolution/`，初始 `status=pending_apply`。
3. 按问题类别把规则归并到唯一权威文件，避免多处重复：
   - 流程/角色协作 → `workflows/development-workflow.md`、根 `AGENTS.md`、`agents/*/AGENTS.md`
   - 编码问题 → `docs/development/coding-style.md`、`docs/architecture/development-standards.md`
   - 架构/选型 → 对应 ADR（`docs/architecture/adr/`）与架构设计文档
   - 测试问题 → `docs/development/development.md` 测试章节、`agents/test-agent/AGENTS.md`
   - 运维/安全 → `docs/operations/README.md`
   - 跨会话事实（环境坑、分支状态）→ `docs/context.md`
4. 属于不可协商治理约束的，提议宪法修订（PR 附 Sync Impact Report + 版本号），不得直接改宪法。
5. 归并完成后将记录 `status` 改为 `applied`，在本文件下方索引登记。
6. 在 `docs/context.md` 当次会话记录中写明进化结论；handoff 方可置 `complete`。

## 📚 四、优先级

| 级别 | 类别                               | 处理时限                       |
| ---- | ---------------------------------- | ------------------------------ |
| P0   | 安全：越权、泄露、注入、密钥       | 立即更新全局规则，所有角色遵守 |
| P1   | 质量：重复 Bug、测试缺失、分层破坏 | 24 小时内更新规范              |
| P2   | 效率：流程冗余、重复劳动、工具用法 | 下一迭代优化                   |
| P3   | 体验：风格、命名、注释             | 定期批量处理                   |

## ✅ 五、完成判定

- 每个 feature 的 tasks.md 最后一个任务隐含「执行 `/evolve`」；无 `applied` 进化记录（或明确记录「本次无可沉淀规则」并在会话记录中说明）不得声称任务完成。
- 新会话启动时，arch-agent 角色应回看最近 3 条进化记录，确认规则已在对应文件生效。

## 🚫 六、禁止事项

- 禁止只记录问题不归并规则；经验必须落成「必须/禁止」可执行约束。
- 禁止同一错误记录超过 2 次；第 2 次必须从流程/规范上消除。
- 禁止删除或改写历史进化记录；需要废弃时追加废弃说明，保留原文。
- 禁止以进化为名绕过 Spec-Kit 规划权：规则改变导致任务范围变化时，走 blocked → 人工确认 → 重新规划。

## 📇 进化记录索引（最新在上）

| 编号                                                                                          | 日期       | 主题                                                                                    | 角色       | 优先级 | 状态    |
| --------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- | ---------- | ------ | ------- |
| [EVO-20261026003](./evolution/EVO-20261026003-CRUD-data形态与分页范式须首个列表接口前锁定.md) | 2026-10-26 | CRUD data 五形态与分页范式须在首个列表接口前锁定；只读空结果 200/null 与写操作 404 分离 | dev-agent  | P2     | applied |
| [EVO-20261026002](./evolution/EVO-20261026002-响应码值域须在规划期锁定.md)                    | 2026-10-26 | 响应码值域/与 HTTP 关系/同状态细分区分须规划期锁定；契约推翻先回规划层                  | dev-agent  | P2     | applied |
| [EVO-20261026001](./evolution/EVO-20261026001-动态字段全等断言与豁免路径异常分支.md)          | 2026-10-26 | 动态字段响应禁整体 toEqual；横切豁免路径异常分支必测                                    | dev-agent  | P1     | applied |
| [EVO-20261025001](./evolution/EVO-20261025001-多环境E2E模块注册表与env覆盖隔离.md)            | 2026-10-25 | 多环境 E2E：isolateModules 模块注册表隔离与 env 键覆盖                                  | dev-agent  | P1     | applied |
| [EVO-20261023001](./evolution/EVO-20261023001-跨模块只读协作口与commitlint-subject规则.md)    | 2026-10-23 | 跨模块只读协作口规划缺口与 commitlint subject 大小写                                    | dev-agent  | P1     | applied |
| [EVO-20261022001](./evolution/EVO-20261022001-接入harness多角色与进化机制.md)                 | 2026-10-22 | 接入 Harness 多角色与进化机制                                                           | arch-agent | P2     | applied |
