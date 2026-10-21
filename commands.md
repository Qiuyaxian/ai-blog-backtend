# Harness 触发指令手册

> 所有指令无需额外插件：`/speckit.*` 对应 `.cursor/skills/` 与 Superpowers 已安装技能；`/role`、`/evolve` 为角色层约定指令（自然语言同样触发）。
> 指令不得改变 AGENTS.md §7 的权力划分：Spec-Kit 规划、Superpowers 执行、handoff 状态机为准。

## 一、斜杠命令

| 指令                                    | 效果                                                           | 主责角色                      |
| --------------------------------------- | -------------------------------------------------------------- | ----------------------------- |
| `/speckit.constitution`                 | 建立/修订项目宪章（修订须附 Sync Impact Report）               | arch-agent                    |
| `/speckit.specify`                      | 撰写 `specs/<feature>/spec.md`（做什么）                       | arch-agent                    |
| `/speckit.clarify`                      | 澄清规格模糊点并回写 spec                                      | arch-agent                    |
| `/speckit.plan`                         | 生成 `plan.md`（怎么做）                                       | arch-agent                    |
| `/speckit.tasks`                        | 生成依赖有序的 `tasks.md`                                      | arch-agent                    |
| `/speckit.analyze`                      | **强制闸门**：spec/plan/tasks 一致性分析，不过不得交接         | arch-agent                    |
| `/speckit.checklist`                    | 基于需求生成 feature 检查清单                                  | arch-agent / test-agent       |
| `/speckit.converge`                     | 对照规格补漏、收敛交付                                         | arch-agent                    |
| `/speckit.taskstoissues`                | tasks 转 GitHub Issues                                         | arch-agent                    |
| 🚫 `/speckit.implement`                 | **本仓库禁止**：绕过 Superpowers/TDD；实现只能走 §7.3 认领执行 | —                             |
| `/role <arch\|dev\|test\|devops>-agent` | 切换角色，加载 `agents/<role>/AGENTS.md`                       | 对应角色                      |
| `/evolve`                               | 任务复盘，生成 EVO 记录并归并规则（完成前强制）                | 执行角色起草，arch-agent 归并 |

> Superpowers 技能（按技能说明自动触发，非自定义斜杠命令）：`brainstorming`、`writing-plans`、`executing-plans`、`test-driven-development`、`systematic-debugging`、`verification-before-completion`、`requesting-code-review`、`receiving-code-review`、`finishing-a-development-branch` 等。

## 二、工程命令（终端）

| 命令                                                         | 用途                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `pnpm run start:local`                                       | 本地启动（先起 redis-server 与 mongod）                              |
| `pnpm lint`                                                  | ESLint 检查                                                          |
| `pnpm test`                                                  | Jest 单元测试                                                        |
| `pnpm test:e2e`                                              | E2E（真实本地 mongod + redis，测试库 `ai_blog_test`，`--runInBand`） |
| `pnpm run build:local`                                       | 构建                                                                 |
| `ocr review -B ./specs/<feature>/checklists/requirements.md` | OCR 委托模式代码评审（AGENTS.md §6.4）                               |

## 三、自然语言触发词

无需记斜杠命令；下列说法等价于对应命令，AI 识别后必须走相同流程与门禁。

### 3.1 Spec-Kit 流程（主责 arch-agent）

| 说法（示例，同义表达均触发）                                              | 等价命令                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 「帮我写 XXX 的 spec」「梳理 XXX 需求」「写需求文档」「specify 这个功能」 | `/speckit.specify`                                                           |
| 「这个需求还有什么没明确的」「澄清 spec 里的模糊点」「补充验收细节」      | `/speckit.clarify`                                                           |
| 「设计 XXX 怎么实现」「出技术方案」「做技术选型」「生成 plan」            | `/speckit.plan`                                                              |
| 「拆开发任务」「列个 todo」「排实现步骤」「生成 tasks」                   | `/speckit.tasks`                                                             |
| 「检查 spec/plan/tasks 一不一致」「跑 analyze」「过一致性闸门」           | `/speckit.analyze`                                                           |
| 「生成验收清单」「按需求出 checklist」                                    | `/speckit.checklist`                                                         |
| 「对照规格查漏补缺」「看还有哪些没实现」「收敛交付」                      | `/speckit.converge`                                                          |
| 「把任务转成 GitHub issues」                                              | `/speckit.taskstoissues`                                                     |
| 「更新/修订项目宪章」「加一条宪法原则」                                   | `/speckit.constitution`                                                      |
| 「开始实现」「写代码吧」                                                  | 🚫 不触发 `/speckit.implement`；先确认 analyze + handoff，再按 §7.3 认领执行 |

### 3.2 角色与进化

| 说法（示例，同义表达均触发）                                 | 角色 / 指令      |
| ------------------------------------------------------------ | ---------------- |
| 「评审 spec/方案」「做技术选型」「把控门禁」「归并进化规则」 | 🏛️ arch-agent    |
| 「写接口/Service/Schema」「实现 tasks」「修业务 Bug」        | 👨‍💻 dev-agent     |
| 「写用例」「跑测试/E2E」「验收」「提 Bug 报告」              | 🧪 test-agent    |
| 「配 env/CI」「部署回滚」「健康检查/告警」「安全扫描」       | 🔧 devops-agent  |
| 「切换到 XXX 角色」「以 XXX 身份工作」                       | `/role <角色名>` |
| 「复盘」「总结经验」「更新最佳实践」「这次踩了什么坑」       | `/evolve`        |

> 触发歧义时（如「写测试用例」可能属 dev 的 TDD 或 test 的用例设计），先按当前 handoff 阶段判断：实现中是 dev-agent（TDD RED），验收阶段是 test-agent；仍不确定只问一个关键问题。

## 四、文件类型路由（Cursor 建议）

`.cursor/rules/harness-agents.mdc` 在打开对应文件时提示角色建议：

- `specs/**`、`docs/architecture/**`、`AGENTS.md`、`.specify/**` → arch-agent
- `src/**/*.ts`（不含 spec）、`src/common/**` → dev-agent
- `**/*.spec.ts`、`test/**` → test-agent
- `.env.*`、CI/部署脚本、`docs/operations/**` → devops-agent

建议性质：实际角色以 `/role` 或会话声明为准，不自动替代理性判断。

## 五、强制规则

1. 没有 spec → plan → tasks → analyze 通过与 handoff `ready_for_execution`，写生产代码的请求必须拒绝。
2. 代码任务必须先 RED 后 GREEN；`[no-test]` 仅限文档/配置/重命名并在 tasks.md 标注。
3. 任务完成必须 `/evolve`（或在会话记录中明确说明无可沉淀规则），否则 handoff 不得置 `complete`。
4. 命令集合以本文件为准；新增命令必须先有对应技能/脚本落地（见 EVO-20261022001 验证项）。
