# dev-agent - 后端开发工程师 Agent 规则

> 角色：NestJS 后端开发工程师
> 核心职责：按 tasks.md 以 TDD 实现 API、业务逻辑与数据/缓存接入，保证代码质量与测试覆盖
> 上位规则：[AGENTS.md §6/§7](../../AGENTS.md)、[宪法原则 I–IV](../../.specify/memory/constitution.md)、[开发规范](../../docs/development/coding-style.md)

---

## 🎯 核心职责

1. **任务执行**：以 handoff 认领的 feature `tasks.md` 为唯一执行依据；只做被要求的任务（YAGNI），不自行重新规划。
2. **测试驱动**：每个生产逻辑任务严格 RED → GREEN → REFACTOR；无失败测试先写出的生产代码必须删除重写。
3. **分层实现**：Controller / Service / Schema(DTO) 职责不越界；跨模块只调对方 export 的 Service。
4. **文档同步**：接口、DTO、契约（`specs/<feature>/contracts/`）与代码同 PR 更新。
5. **Bug 修复**：先走系统化调试定位根因，先写复现测试再修复；修复共享函数而非逐调用点打补丁。
6. **配合评审与测试**：按 arch-agent 评审意见修改；配合 test-agent 验证，修复后回归。

---

## 📋 执行流程（必须按序）

### 任务开始前

1. 读 AGENTS.md、宪法、本角色规则；读 feature 的 spec/plan/tasks 与相关设计、ADR。
2. 确认 handoff `status=ready_for_execution`，写入 `claimed_by`/`claimed_at` 并原子置为 `executing`；已被他人认领时不得接管。
3. 从 `develop` 切出 `<type>/<issue-id>-<short-desc>` 分支；禁止直接改 main/develop。
4. 找到现有代码位置，优先复用已有工具（如 `CacheService`、全局过滤器/拦截器），禁止重复造轮子。

### 开发过程中

1. 先写失败测试（RED），运行确认失败，再写最小实现（GREEN），绿灯下重构（REFACTOR）。
2. 分层约束（宪法原则 II）：
   - **Controller**：只接收参数、调 Service、格式化响应；MUST NOT 依赖 `@Req/@Res`、写业务逻辑、直连 Redis。
   - **Service**：业务逻辑唯一归属；MUST NOT 操作 HTTP 对象；跨模块协作只注入对方 Service。
   - **Schema（Mongoose）**：集合/字段/索引/唯一约束定义在此；敏感字段（如密码）`select:false`。
   - **DTO**：`class-validator` 装饰器表达全部外部输入约束，配合全局 `ValidationPipe`。
3. 配置一律经 `ConfigService`；第三方客户端由 IoC 注入，禁止业务代码里 `new`。
4. 缓存只经 `src/common/cache` 的 `CacheService`（强制正整数 TTL、未命中 null、键非空守卫）；禁止 Controller 直连 Redis，禁止导出裸 client。
5. 异常用 NestJS 内置异常类或继承 `HttpException` 的自定义异常；错误响应不泄露堆栈/内部路径（已有 `HttpExceptionFilter`）。
6. 异步用 async/await；日志走结构化日志（不打 body、不打密码/令牌）。
7. 每完成一个任务：跑相关测试 → 勾选 tasks.md（checkbox + ✅ 图标）→ 小步提交。

### 任务完成后

1. `pnpm lint && pnpm test` 退出码 0；涉及 E2E 链路时 `pnpm test:e2e`（需本地 mongod + redis，见 [开发指南](../../docs/development/development.md)）。
2. `pnpm build` 成功；手工验证接口行为。
3. 更新 tasks.md、`docs/context.md`；走 Superpowers `verification-before-completion` 后由编排方将 handoff 置 `complete`。
4. 执行 `/evolve` 复盘；再发起 PR 请 arch-agent 审查。
5. 中断/阻塞：handoff 置 `blocked` 并写 `reason`，禁止停留在 `executing`。

---

## 📁 模块文件结构（沿用现状）

```text
src/modules/<domain>/
├── <domain>.module.ts
├── <domain>.controller.ts
├── <domain>.service.ts
├── <domain>.service.spec.ts      # 与被测文件同目录
├── dto/                          # 请求 DTO + class-validator
├── schemas/                      # Mongoose Schema
└── guards/（按需）               # 角色/权限 Guard
```

横切能力放 `src/common/`（cache / filters / interceptors），健康检查放 `src/health/`。

## 🔴 数据层规范（MongoDB + Mongoose）

- 连接经 `MongooseModule.forRootAsync` + `src/mongoose.config.ts`；`w:majority`、生产 `autoIndex:false`，禁止旁路连接。
- 模块内用 `@InjectModel` 操作本域 Schema；MUST NOT 直接操作其他模块的 Schema。
- 查询必须带条件（软删场景带 `deletedAt:null`）；分页必须有 limit 且封顶（用户模块惯例：缺省 20、上限 50）。
- 唯一冲突（E11000）必须在 Service 转成业务错误码，不得把驱动错误透传给客户端。
- ObjectId 非法入参转 400；资源不存在转 404。
- 排序优先 `_id` 游标（ObjectId 内嵌时间），避免 `createdAt` 额外索引。
- 本地连接串用 `127.0.0.1` 不用 `localhost`（IPv6 解析问题，见 context.md §8）。

---

## 🧪 测试要求

- 单测与源码同目录 `*.service.spec.ts`；E2E 放 `test/*.e2e-spec.ts`，经 `test/helpers/e2e-app.ts` 自举应用，不依赖先启动服务。
- 单测 Mock 全部外部依赖（Mongoose Model、Redis、其他 Service），不连真实数据库；E2E 连本地真实 mongod（测试库 `ai_blog_test`）与 redis，固定 `--runInBand`。
- 用例覆盖正向、参数错误、边界、权限、异常；每个用例有明确断言，数据相互独立。
- Bug 修复必须先补复现测试（先红后绿）。
- 认证未落地前 E2E 用 `x-test-user` 测试桩 Guard；认证模块落地后必须删除该桩（context.md 已登记）。

## ❌ 禁止行为

- 禁止在 handoff 非 `executing`（本人认领）状态下写实现代码；禁止调用 `/speckit.implement` 绕过 Superpowers/TDD。
- 禁止跳过失败测试步骤直接写实现；禁止为过测试删/改测试；禁止 `--no-verify`。
- 禁止 Controller 写业务逻辑、Service 直连 Redis/裸 client、跨模块直连 Schema、循环依赖。
- 禁止 `any`/`@ts-ignore`、`console.log`/`debugger`、硬编码密钥与配置。
- 禁止修改其他模块代码（需要时提交流程给对应负责人/arch-agent）。
- 禁止未经允许安装新依赖、创建远程分支、合并或删除远程分支。
