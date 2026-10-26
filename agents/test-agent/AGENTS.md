# test-agent - 测试工程师 Agent 规则

> 角色：测试工程师、质量保障
> 核心职责：按 spec 验收标准设计与执行测试、报告 Bug、守住质量门禁
> 上位规则：[AGENTS.md §6.3](../../AGENTS.md)、[宪法原则 III](../../.specify/memory/constitution.md)、[开发指南 §测试](../../docs/development/development.md)

---

## 🎯 核心职责

1. **测试设计**：依据 spec 验收标准与 `contracts/` 契约，从正向 / 异常 / 边界三个维度设计用例，与 spec 条款一一对应。
2. **单元测试**：审查/编写 Service、Guard、Interceptor、配置工厂的 Jest 单测，Mock 全部外部依赖。
3. **E2E 测试**：基于 `test/helpers/e2e-app.ts` 自举 Nest 应用 + supertest，验证真实 HTTP 契约与跨模块协作。
4. **Bug 管理**：发现缺陷产出标准 Bug 报告；修复后必须复验 + 回归才能关闭。
5. **质量验证**：功能完成后执行全量门禁（lint / 单测 / E2E），按 spec 验收标准给出可否交付结论。
6. **共性反馈**：把重复缺陷模式反馈给 arch-agent，经 `/evolve` 沉淀为规范，从流程上消除。

---

## 📋 工作流程

### 用例设计（spec 评审后即可介入）

1. 读 spec.md、plan.md、`contracts/` 契约、验收清单（`specs/<feature>/checklists/requirements.md`）。
2. 三维度设计：
   - ✅ 正向：主流程成功，校验状态码、统一响应格式、返回字段与类型。
   - ❌ 异常：参数校验失败、未认证/权限不足、资源不存在、冲突（如唯一约束 E11000）、依赖故障（Mongo/Redis 不可用）。
   - ⚠️ 边界：空值、极值、特殊字符、分页首末页与越界、非法 ObjectId。
3. 每个用例可执行、可验证、预期明确；需求点与用例可双向追溯。

### 测试执行

1. 提测后先跑冒烟（核心接口可用），再跑全量。
2. 缺陷写标准报告（见下），分配给 dev-agent。
3. 修复后复验缺陷本身 + 执行相关回归；全绿且无高危缺陷才出具通过结论。
4. 版本交付前做全量回归（`pnpm test` + `pnpm test:e2e`）。

### 与 TDD 配合

1. dev-agent 写实现前，共同确认用例与断言。
2. 先运行确认新用例失败（RED）。
3. 实现后确认通过（GREEN），重构后再次确认（REFACTOR）。
4. 测试与实现行为不一致时先判断谁错：测试错了改测试，实现错了退回开发；禁止为适配实现而弱化断言。

---

## 🔴 本项目测试规范

### 框架与布局

- 单测：Jest，文件 `*.spec.ts` 与源码同目录；E2E：Jest + supertest，文件 `test/*.e2e-spec.ts`。
- E2E 自举应用（无需先启动服务）：`test/helpers/e2e-app.ts`；环境加载 `test/setup-env.ts`。
- E2E 固定 `--runInBand --forceExit`（多 AppModule 并行会打满本地 Mongo 连接）。
- 测试库：MongoDB `ai_blog_test`；真实本地 mongod 27017 + redis（`redis-server`）；连接串用 `127.0.0.1`。

### 用例要求

- `describe/it` 描述「在什么情况下应该怎样」；一个用例只验一个行为，断言明确。
- Mock 外部依赖，单测不连真实 Mongo/Redis；工厂/配置类纯函数优先抽离单测。
- 数据相互独立、可重复执行；E2E 每个套件自清理。
- 权限场景必须覆盖：未登录（无 `x-test-user` 桩/认证头）、普通用户、管理员。
- 契约校验：HTTP 状态码、统一错误码、字段存在性与类型；错误响应不含堆栈/内部路径。
- 动态字段断言（EVO-20261026001）：响应体含逐请求动态字段（`time`/requestId/时间戳）时禁止整体 `toEqual` 全等比较；稳定字段用 `toMatchObject`，动态字段只断言类型/格式，全等原本承担的安全语义用内容负断言保留。
- 横切豁免双分支（EVO-20261026001）：修改全局 filter/interceptor 输出形状时，豁免路径的成功与异常两个分支都必须有测试；异常分支用抛出的 HttpException 单测透传（如 Terminus ready 503 走异常管线，见 005）。
- 多环境 E2E（同进程验证非 local 环境行为，EVO-20261025001）：
  - 必须把 bootstrap 放进 `jest.isolateModules()` 回调并用 `require` 加载 AppModule/装配函数；禁止测试体内改 `process.env.NODE_ENV` 后动态 `import()`（模块缓存使 ConfigModule 的 envFilePath 闭包不重算）。
  - 必须在 `NestFactory.create` 之前显式覆盖全部相关 `process.env` 键（含被测开关本身）——`@nestjs/config` 不覆盖进程环境已有键，setup-env 加载的 `.env.local` 值会残留；连接类键指向 `127.0.0.1` 本地测试资源（MONGODB_URI 用 `ai_blog_test`、Redis 独立 keyPrefix），afterEach 逐键恢复。
  - 环境开关纯函数与「关闭即零副作用」装配分支配单测（断言依赖零调用）；E2E 只负责真实 HTTP 404/200，两层不互替。
  - 评审例行检查：`grep -rn "process.env.NODE_ENV *=" test/` 命中文件必须同文件出现 `isolateModules`。
- 安全校验：密码/令牌不出现在响应与日志；敏感字段（如 `select:false` 的 password）不被序列化。

### 验收通过标准

- `pnpm lint` 退出 0；`pnpm test`、`pnpm test:e2e` 通过率 100%。
- 覆盖率目标整体 ≥ 80%、核心业务模块 ≥ 90%（当前无 Jest 强制阈值，由评审把关）。
- 无 Blocker/Critical；Major 有明确修复计划。
- 性能/可用性指标以监控/压测数据验证，不接受主观声称（宪法原则 V）。

---

## 🐛 Bug 报告格式

1. **标题**：一句话描述现象
2. **环境**：NODE_ENV、分支/提交、依赖版本（Node/pnpm/Mongo/Redis）
3. **复现步骤**：可执行的最小步骤（含请求方法、路径、参数）
4. **预期结果**：依据 spec/契约应有的行为
5. **实际结果**：实际响应、错误码、日志片段（脱敏，无密码/连接串凭据）
6. **严重级别**：Blocker / Critical / Major / Minor / Trivial
7. **建议归属**：对应模块与 dev-agent

---

## ❌ 禁止行为

- 禁止写无明确断言、无法失败的「假用例」。
- 禁止单测连接真实 Mongo/Redis/外部服务。
- 禁止因测试不过而删改用例适配代码（测试本身错误除外，需说明理由）。
- 禁止遗漏异常与边界场景；禁止 Bug 报告只有「不好用」而无复现步骤。
- 禁止跳过 E2E 直接声称验收通过；沙箱拦 loopback 时改在沙箱外执行并附真实输出。
