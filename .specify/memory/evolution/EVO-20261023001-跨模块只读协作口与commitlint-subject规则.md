---
evolution_id: EVO-20261023001
date: 2026-10-23 16:25+08:00
task_id: 003-user-login
task_name: 用户登录鉴权（T001–T035 执行复盘）
agent: dev-agent
priority: P1
status: applied
---

# 进化记录 - 2026-10-23 16:25

## 1. 任务/问题场景

003-user-login 执行到 Foundational（T008）与 US1 登录实现（T014）之间时发现：plan/data-model 明确「AuthService 访问 users 集合只经 UserService 暴露的只读方法，不直连其 Schema」，但 tasks 只规划了 `getAuthPrincipal(id)`（鉴权回查），**登录的 `$or: [{usernameLower},{email}] + deletedAt:null + select('+password')` 查询没有任何跨模块协作口**。若照 tasks 执行，AuthService 只有两条违规路：注入 User Mongoose Model（跨模块直连 Schema，违反宪法原则 II），或把登录查询塞进 `getAuthPrincipal`（污染最小投影）。最终在执行期临时新增 `UserService.findLoginCredential` 并补 TDD 用例收口（超出 tasks 字面范围）。

次要低效点：本会话多次提交被 commitlint `subject-case` 打回——提交信息 subject 以大写英文缩写开头（`Foundational ...`、`ADR-004 ...`）被判 sentence/upper-case，需改写成中文开头重试，浪费往返。

## 2. 根因分析

- 协作口缺口：plan 阶段列了模块边界（auth 通过 UserModule 导出的 Service 协作），data-model 列了「登录定位账号」与「鉴权回查账号」两类查询，但 tasks 拆分时只为后者建了任务，**没有一条规则强制「逐查询核对跨模块数据访问是否都有 export 的 Service 方法」**。analyze 一致性闸门校验 spec/plan/tasks 文本一致，却无法发现 tasks 相对 plan 架构约束的任务级遗漏。
- commitlint 返工：提交规范文档只讲 Conventional Commits 类型与关联编号，未记录本仓库 commitlint 配置对 subject 大小写的实际限制（英文大写开头即拒），AI 与新会话不知道要让 subject 以中文/小写开头。

## 3. 最终解决方案

- 执行期未越权直连 Schema：在 UserService 增补只读 `findLoginCredential(normalized)`（返回 `{ id, passwordHash, user }`，`$or + deletedAt:null + select('+password')`），先写 2 个单测（RED）再实现（GREEN），并在 tasks/context 登记该规划偏差待 arch 复核；AuthService 只注入 UserService。
- 提交信息统一改为中文语义开头（`feat(auth): 登录端点…`），绕开 subject-case 规则。

## 4. 沉淀的可执行规则

- [x] **必须（规划/analyze，P1）**：生成/分析 tasks 时，对 plan 数据模型中每一类「跨模块/跨集合读取」逐条核对目标模块已 export 对应只读 Service 方法；缺协作口必须在 tasks 增补「RED+GREEN 只读方法」任务后才能置 ready_for_execution，禁止把缺口留到执行期临时决定。归属：`agents/arch-agent/AGENTS.md` 的 plan/tasks 评审清单 + `agents/dev-agent/AGENTS.md` 数据层规范（执行中发现缺口必须落 blocked/登记偏差，禁止自行注入他模块 Model）。
- [x] **禁止（P1）**：Service 禁止为绕过缺口而 `@InjectModel` 其他模块的 Schema；跨模块数据只允许调对方 `exports` 的 Service。
- [x] **必须（提交，P3）**：commitlint subject 受 `subject-case` 约束，subject 禁止以大写英文/缩写开头（如 `Foundational`、`ADR-004`）；含英文缩写时让中文语义在 subject 最前。归属：`docs/architecture/engineering/commit-convention.md`。

## 5. 需要更新的文件清单

| 文件路径                                             | 更新内容                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `agents/arch-agent/AGENTS.md`                        | plan.md/tasks.md 评审清单各加一条：逐查询核对跨模块只读协作口已在 tasks 落任务           |
| `agents/dev-agent/AGENTS.md`                         | 数据层规范补：发现跨模块协作口缺口时登记偏差/落 blocked，禁止注入他模块 Model 自行补查询 |
| `docs/architecture/engineering/commit-convention.md` | 补 commitlint subject-case 实际约束与中文开头示例                                        |
| `.specify/memory/evolution-mechanism.md`             | 本记录索引登记                                                                           |

## 6. 防重复验证规则

- 评审命令 `ocr review -B ./specs/<feature>/checklists/requirements.md` 时加一条人工核对：plan 数据模型的每个跨模块查询在 tasks 都有「export Service 只读方法」对应任务。
- 提交前自检：`echo "<message>" | npx commitlint`，subject 含英文大写开头时先改写中文开头再提交（本会话已因此返工 3 次）。
