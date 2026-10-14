<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: 新增「Spec 状态标记规范」章节（统一 ✅/⬜/❌/🚫/⚠️ 图标约定；
Markdown checkbox 保留为 speckit 技能解析进度的机器状态，图标紧随其后供人读），
为既有治理约束的实质性扩充，按语义化版本升 MINOR。

Modified principles: 无。
Added sections:
- Spec 状态标记规范（specs/ 产物状态图标与 Markdown checkbox 共存约定）

Removed sections: 无。

历史变更:
- (unfilled scaffold) → 1.0.0：首次将占位模板填充为可执行宪法。
  Modified principles (占位 → 正式原则):
  - [PRINCIPLE_1_NAME] → I. TypeScript-First（类型即契约）
  - [PRINCIPLE_2_NAME] → II. NestJS 模块边界与分层
  - [PRINCIPLE_3_NAME] → III. Test-First（NON-NEGOTIABLE，不可协商）
  - [PRINCIPLE_4_NAME] → IV. 安全与合规默认开启
  - [PRINCIPLE_5_NAME] → V. 可观测、可灰度、可回滚
  Added sections: 技术栈与工程约束、开发工作流与质量门禁、Governance。
-->

# ai-blog-backtend Constitution

## Core Principles

### I. TypeScript-First（类型即契约）

TypeScript 是一等公民，类型是模块间、前后端间的契约，而非事后补充。

- 所有业务代码 MUST 以显式类型表达 DTO、Service 方法入参与返回值；公共 Service 方法
  MUST 用 JSDoc 或类型声明说明参数与返回含义。
- MUST NOT 使用 `any` 或 `// @ts-ignore` 掩盖真实类型问题；确需放宽时 MUST 使用
  `unknown` 并收窄，且注释说明原因。
- API 响应 MUST 向后兼容：新增字段必须可选；删除或改类型字段 MUST 走版本化与
  expand-contract（见原则 V）。
- 理由：读多写少的多协作者系统中，类型是最低成本的沟通与回归防护；绕过类型等于把
  契约校验推迟到运行时，代价更高。

### II. NestJS 模块边界与分层

按业务域组织模块，模块内高内聚、模块间低耦合；分层职责不可越界。

- 每个业务域一个目录，固定 `module / controller / service / dto / schemas` 结构。
- Controller MUST NOT 写业务逻辑，只做参数接收、调用 Service、返回响应；Service
  MUST NOT 依赖 HTTP 对象（`@Req` / `@Res`）。
- 模块间 MUST 只通过对方 export 的 Service 协作；MUST NOT 直接操作其他模块的
  Schema，MUST NOT 出现循环依赖（无法避免时用 `forwardRef` 并注释原因，且优先
  重构解耦）。
- 第三方客户端 MUST 由 Nest IoC 容器注入，MUST NOT 在业务代码中直接 `new`；
  配置 MUST 经 `ConfigService` 读取，MUST NOT 硬编码端口、连接串、密钥。
- 理由：边界一旦被跨模块直连 Schema 或胖 Controller 打破，后续拆分与测试成本
  指数上升；分层约束是演进式架构（见技术栈与工程约束）的前提。

### III. Test-First（NON-NEGOTIABLE，不可协商）

任何代码修改任务 MUST 先有失败的测试，再有实现。这是不可协商的硬性原则。

- 对 `specs/*/tasks.md` 中的每个代码修改任务，MUST 严格按
  Red → Green → Refactor 执行：先写失败测试（RED），再写最小实现使其通过
  （GREEN），然后在测试绿灯下重构（REFACTOR）。
- 若在没有失败测试的情况下写出了生产代码，该代码 MUST 删除并按 TDD 重写。
- MUST NOT 为通过测试而删除或弱化测试，MUST NOT 使用 `--no-verify` 绕过钩子。
- 集成测试 MUST 覆盖：新接口契约、契约变更、跨模块协作、共享 Schema。
- 提 PR 前 MUST 本地跑全量 `pnpm lint && pnpm test`，退出码为 0；CI 未过
  MUST NOT 合并。单测覆盖率目标 80%。
- 理由：测试是重构与演进的安全网；先实现后补测试只会得到迁就实现的测试，
  无法证明行为正确。

### IV. 安全与合规默认开启

认证、授权、输入校验、限流、审计是默认要求，而非按需选配。

- 所有外部输入 MUST 经 DTO + 全局 `ValidationPipe` 校验；信任边界 MUST NOT
  接受未校验数据。
- MUST NOT 绕过 Guard / Pipe / Interceptor；密码 MUST 用 bcrypt（cost >= 10）
  哈希，MUST NOT 明文存储，MUST NOT 在日志中输出密码、令牌、密钥。
- 密钥 MUST NOT 提交到仓库（`.env.local` / `.env.uat` / `.env.production`
  按仓库白名单除外）；MUST NOT 绕过认证授权或安全校验。
- 缓存 MUST 统一封装，Controller MUST NOT 直接操作 Redis；基础设施
  （MongoDB / Redis）MUST NOT 直接暴露给用户。
- 外部调用失败 MUST 可降级或明确上抛，MUST NOT 返回不确定状态；错误响应
  MUST NOT 暴露堆栈、SQL、内部路径。
- 理由：安全缺陷的修复成本随上线时间单调上升；默认关闭式安全在博客系统的
  公开访问场景下不可接受。

### V. 可观测、可灰度、可回滚

变更默认假设会出问题：上线前必须能看见，出问题必须能撤回。

- 新增接口与外部调用 MUST 具备结构化日志、关键指标与 Trace；关键链路
  MUST 100% 可追踪。日志解释“为什么”，不泄露敏感数据（见原则 IV）。
- 数据库变更 MUST 采用 expand-contract，MUST NOT 在同一次部署中直接删除
  旧字段；API MUST 版本化。
- 变更 SHOULD 支持功能开关与灰度；回滚时间目标 ≤ 5 分钟。
- 质量目标（核心读接口 P95 ≤ 200ms、月度可用性 ≥ 99.9%）MUST 由监控数据
  验证，MUST NOT 凭主观判断声称达标。
- 理由：读多写少场景下性能与可用性优先，但没有观测与回滚能力的“快上线”
  等于把事故定位时间交给运气。

## 技术栈与工程约束

- 运行时：Node >= 20、pnpm >= 9。包管理器 MUST 使用 pnpm，MUST NOT 混用
  npm / yarn；锁定文件为 `pnpm-lock.yaml`。
- 技术栈基线：TypeScript 5.0.0、NestJS 9.0.0、MongoDB 7.0.37、redis 4.0.11。
- 环境变量按 `NODE_ENV` 自动加载 `.env.local` / `.env.uat` /
  `.env.production`，默认 local。
- 引入新依赖 MUST 优先顺序：标准库 / 平台能力 → 已安装依赖 → 成熟生态组件；
  MUST NOT 引入未经验证的外部依赖，重大选型 MUST 记录 ADR。
- 简单优先（YAGNI）：MUST NOT 构建未被要求的抽象、样板或提前演进；
  可伸缩性按真实用户量演进。已知上限的刻意简化 MUST 以 `ponytail:` 注释
  标明上限与升级路径。
- 代码风格由 ESLint + Prettier 强制，提交信息遵循 Conventional Commits；
  详细编码规则以 `docs/development/coding-style.md` 与
  `docs/architecture/development-standards.md` 为权威来源，本宪法不重复其细则。

## 开发工作流与质量门禁

- 规划与执行分离：Spec-Kit 拥有规划权（constitution → specify → clarify →
  plan → tasks），Superpowers 拥有执行权；交接以
  `.specify/superpowers-handoff.json` 的状态为准。
- `status` 为 `executing` 时 MUST NOT 重新调用 plan / tasks，MUST NOT
  自行重新规划任务；任务的唯一真相来源是该 feature 的 `tasks.md`。
- 分支：main 生产、develop 集成；feature/fix 从 develop 切出，MUST 经 PR
  合并，MUST NOT 直接推 main/develop；合并策略与命名遵循 AGENTS.md §6.5。
- 质量门禁：提 PR 前 MUST 通过 `pnpm lint && pnpm test`；CI 为强制门禁，
  未过 MUST NOT 合并；MUST NOT 修改 CI 绕过测试。
- 文档与代码 MUST 在同一 PR 更新；架构级变更在文档未更新时 MUST NOT 合并；
  关键决策 MUST 先入 `context.md` 草稿区，人工确认后转为 ADR。
- AI 代理约束：未经允许 MUST NOT 创建远程分支、合并或删除远程分支；
  MUST NOT 执行破坏性命令（`rm -rf`、`DROP DATABASE` 等）。

## Spec 状态标记规范

`specs/` 下所有产物（spec.md / plan.md / tasks.md / checklists 等）的状态标记
MUST 统一使用以下图标，使完成状态在源码中直接可见：

| 图标 | 含义        |
| ---- | ----------- |
| ✅   | 已完成      |
| ⬜   | 待办        |
| ❌   | 错误 / 失败 |
| 🚫   | 禁止        |
| ⚠️   | 已废弃      |

- 任务/检查项 MUST 以 Markdown checkbox 起头、图标紧随其后（speckit 技能按
  `- [ ]` / `- [x]` 解析进度，checkbox 是唯一机器可读状态，禁止删除）：
  待办 `- [ ] ⬜ T002 ...`；完成 `- [x] ✅ T001 ...`；
  错误/失败用 ❌、禁止用 🚫、废弃用 ⚠️ 替换图标位。
- 禁止用文字（如“完成/待办”）或其他表情替代表中的图标；同一状态 MUST 全仓一致。
- 示例：

  ```text
  - [x] ✅ T001 已完成事项
  - [ ] ⬜ T002 待办事项
  - [x] 🚫 T003 禁止做法（保留勾选与说明）
  - [x] ⚠️ T004 已废弃事项（保留勾选与说明）
  ```

## Governance

- 本宪法是项目工程治理的最高准则，与 AGENTS.md、`docs/` 下规范冲突时，
  以本宪法为准；发现冲突 MUST 提出修订而非选择性遵守。
- 修订程序：任何成员可提议修订 → 在 PR 中更新本文件并附 Sync Impact
  Report → 人工评审确认后生效；修订 MUST 同步更新版本号与 Last Amended。
- 版本策略遵循语义化版本：
  - MAJOR：删除或重新定义既有原则等不向后兼容的治理变更；
  - MINOR：新增原则 / 章节，或对既有指导的实质性扩充；
  - PATCH：措辞澄清、错别字、无语义变化的精修。
- 合规审查：每个 PR 的评审 MUST 核对本宪法原则；审查者对违反原则的改动
  行使一票否决。复杂方案 MUST 论证其对五条原则的遵从，不能默认豁免。
- 运行时开发指导见 AGENTS.md §4 加载规则；本宪法只规定不可协商的治理
  约束，具体操作细则路由到对应文档，避免重复维护。

**Version**: 1.1.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-14
