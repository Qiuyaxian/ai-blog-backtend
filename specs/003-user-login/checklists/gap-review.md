# 覆盖缺口复查 Checklist：用户登录鉴权（Requirements Gap Review）

**Purpose**：以"需求的单元测试"视角复查 003-user-login 的 spec/plan/contracts/tasks 是否存在**遗漏、歧义与跨工件不一致**；焦点是"有没有写清楚/写全"，不是验证实现。
**Created**：2026-10-22
**Feature**：[spec.md](../spec.md)（配合 plan.md / tasks.md / contracts/auth-api.md / research.md / data-model.md）

**Review Ownership**：本清单由 `/speckit-checklist` 按"查遗漏"诉求生成，归评审人所有。仅当评审人确认该**需求质量项**满足时才勾 `[x]`；`[x]` 不代表实现完成。
**Marker Semantics**：生成项一律未勾；发现真缺口先回 spec/plan/tasks 修补，再勾选。
**范围说明**：与内置 `requirements.md`（specify/clarify 维护）互补，不替代；本清单专做规划收口后的遗漏扫描。

## A. 鉴权面与默认拒绝

- [ ] CHK001 是否有需求枚举"默认拒绝"上线后**全部既有路由**的公开/受保护归类（含易漏的 `POST /users/me`），而非只列 5 个白名单点？[Completeness, Spec FR-008/FR-020；contracts §4]
- [ ] CHK002 每个白名单点是否给出"为何公开"的业务理由与安全接受条件（尤其 `/health/ready` 对外暴露 Mongo/Redis 依赖状态）？[Completeness, contracts §4]
- [ ] CHK003 是否明确令牌只能由服务端签发、拒绝客户端指定或携带自选会话标识（防 session fixation）？[Gap, Spec FR-004]

## B. 会话与令牌生命周期

- [ ] CHK004 令牌熵、长度、字符集是否在需求层量化（256-bit / 64 hex），可客观验收而非"随机不透明令牌"一句话？[Measurability, data-model §2.2]
- [ ] CHK005 是否明确 `expiresAt` 以服务端时钟为准、与 TTL 配置的关系，客户端时钟不参与有效性判定？[Clarity, Spec FR-004/FR-005]
- [ ] CHK006 "请求处理瞬间过期"在契约中是否有确定响应（401 `UNAUTHENTICATED`），与过期/伪造同形？[Clarity, Spec 边界；contracts §3]
- [ ] CHK007 登出幂等的对外语义是否无歧义：DEL 操作幂等 ≠ 对外幂等——已失效令牌登出应统一为 401 而非 200，三处表述（US3/状态机/契约）是否一致？[Consistency, Spec US3；data-model §3.1；contracts §2]
- [ ] CHK008 多会话并存（FR-018）是否在契约/用例层给出可验收点：同账号多令牌键隔离、吊销 A 不影响 B、数量无上限？[Coverage, Spec FR-018；tasks T030]
- [ ] CHK009 "会话负载刻意不含角色/签发时间"是否写成硬性约束，防止实现者回退为会话快照鉴权而架空 FR-011？[Consistency, data-model §2.1；ADR-004]

## C. 防爆破、账号枚举与时序

- [ ] CHK010 "三类失败完全相同"是否定义到可逐项比对的程度（状态码 + code + 响应字段集合 + 无剩余时间/锁定提示），而非"不可区分"形容词？[Measurability, Spec FR-006/SC-002]
- [ ] CHK011 时序均化的验收口径是否写明：只要求三类**失败**路径耗时均化（dummy/锁定也跑 bcrypt），并明确接受成功/失败路径的固有耗时差？[Clarity, research R5]
- [ ] CHK012 软删账号的失败尝试是否明确等同"标识不存在"：不计数、不置锁、不写任何 Redis 键？[Gap, Spec FR-007/FR-013]
- [ ] CHK013 锁定期满瞬间失败计数键的状态是否明确（fail 键与 lock 键同时过期=归零；若 fail 键残留，下次失败从几起算）？[Clarity, data-model §3.2]
- [ ] CHK014 是否把"任何人知道用户名即可连错 5 次造成该账号 15 分钟拒绝服务"这一**残余风险**显式登记为已知接受项并指明后续归属（FR-019 IP 维度限流）？现规格只论证了响应不泄露，未登记 DoS 本身。[Gap, Spec 边界/FR-019]
- [ ] CHK015 是否记录跨 feature 口径差异：注册接口仍区分 `USERNAME_EXISTS`/`EMAIL_EXISTS`（001 Confirmed 行为），与登录防枚举并存的安全 posture 是否被显式接受？[Consistency, Spec FR-006 vs 001 契约]
- [ ] CHK016 标识符理论双命中（同名 usernameLower 与 email）时的确定性归属是否写进契约（research R3 已定 email 优先，契约未写）？[Gap, contracts §1；research R3]
- [ ] CHK017 是否明确阈值 5 次 / 900s 为安全策略常量、不可经环境变量放宽；TTL env 配置失误有正整数 fail-fast？[Clarity, research R7；tasks T005]

## D. 故障安全（fail-closed）

- [ ] CHK018 Redis 不可用时两条路径的对外响应是否分别定义清楚：登录签发失败 →500 且不返回令牌；鉴权取会话失败 →401？[Completeness, Spec FR-015；contracts §1/§3；research R8]
- [ ] CHK019 "Mongo 账号回查失败（依赖异常）也 fail-closed"是否能从 spec FR-015 正文直接读出，并在契约 Guard 顺序与 T019 断言中双向追溯（区别于"查无此人返回 null"）？[Consistency, Spec FR-015；contracts §3；plan 阶段 D]
- [ ] CHK020 登录路径 bcrypt/Mongo 异常返回 500 时，是否明确错误体无堆栈/连接串/内部路径，且该次失败不写会话键、也不写计数/锁定键？[Completeness, contracts §1/§6]

## E. 输入校验与接口契约

- [ ] CHK021 logout "无 body，多余字段经白名单忽略/拒绝与其他 POST 一致"是否有确定结论？全局 ValidationPipe 只校验带 DTO 的入参，logout 无 DTO 时 body 实际不被校验——契约现表述仍有歧义。[Ambiguity, contracts §2]
- [ ] CHK022 Authorization 头畸形变体（无头 / scheme 大小写混合 / 多空格 / 令牌段空）是否穷举且与"无头"同一 401 响应？[Coverage, contracts §3；tasks T019]
- [ ] CHK023 登录 DTO 边界（identifier 2–254、password 8–64）是否与 001 注册 DTO 逐条核对一致（username 2–32、email ≤254），不存在"能注册不能登录"区间？[Consistency, contracts §1 vs 001 CreateUserDto]
- [ ] CHK024 bcrypt 72 字节截断与"64 字符"密码上限在多字节字符下的交互是否被显式确认（注册/登录同口径即可，但不能靠默认）？[Gap, Spec FR-003]
- [ ] CHK025 400 校验错误与 401 安全错误可区分（FR-016）是否反过来破坏防枚举：空字段直接 400、**不触发账号查询**这一前提是否写明？[Clarity, Spec FR-016/FR-006]
- [ ] CHK026 本期错误码（`INVALID_CREDENTIALS`/`UNAUTHENTICATED`/复用 `INTERNAL_ERROR`/`VALIDATION_ERROR`）是否有与既有过滤器及 001 错误码的无冲突登记？[Consistency, contracts §5；HttpExceptionFilter]

## F. 审计、可观测与非功能

- [ ] CHK027 FR-014 只要求"失败事件可审计"；**成功登录/登出**是否需要可关联 userId 的安全事件日志（现有 AccessLogInterceptor 仅请求级 requestId，无 userId），需求口径是否明确？[Gap, Spec FR-014]
- [ ] CHK028 "锁定命中"日志的最小字段集是否定义（requestId、账号标识、真实原因码），并明确不含密码、完整令牌？[Clarity, Spec FR-014/FR-006]
- [ ] CHK029 日志脱敏要求是否显式确认复用既有 AccessLogInterceptor"不打 body / 不打 Authorization 头"行为，而非假设其天然满足？[Consistency, Spec FR-014；contracts §6]
- [ ] CHK030 SC-007"90% 请求 2s 内反馈"的验收口径是否写明本期为手工冒烟观察、非压测 SLO，避免既被当作硬指标又无人验证？[Measurability, Spec SC-007/假设；tasks T035]

## G. 场景与测试基建覆盖

- [ ] CHK031 锁定期满自动解除的验证方式是否可执行且不依赖真实等待 15 分钟（mock 键消失的单测路径 + 不提交的本地短 TTL 冒烟），任务是否说清？[Measurability, tasks T031/T033；quickstart §3]
- [ ] CHK032 E2E 清理 Redis 临时键的途径是否写明（经 `app.get(CacheService)` 删 `auth:` 前缀逻辑键；禁止 flushdb）；T026/T033 中"或测试库观察"的措辞是否纠正——锁定/会话键在 Redis 而非 Mongo？[Clarity, tasks T026/T033；plan 风险 R4]
- [ ] CHK033 删桩改写两个用桩套件时，是否明确要求保留/补齐"无令牌、坏令牌"401 场景（防改写后只剩正向用例）？[Coverage, Spec FR-017；tasks T024/T025]
- [ ] CHK034 管理员造数（注册后直连测试库置 isAdmin）在真实登录下与套件软删清理的数据隔离是否说明（beforeEach 清 users + 清 auth 键的执行顺序）？[Coverage, tasks T025/T026]

## H. 跨工件一致性与执行前置

- [ ] CHK035 plan 结构树是否与 tasks 的新增文件清单一致？tasks T029 新增 `current-token.decorator.ts`，plan 结构树 `decorators/` 下未列（analyze LOW I3）。[Consistency, plan §Structure vs tasks T029]
- [ ] CHK036 tasks 是否包含从 `develop` 切 `feature/003-user-login` 分支的显式前置动作？dev 角色规则要求分支先行，Phase 1 当前无此任务。[Gap, tasks Phase 1；dev-agent AGENTS 任务开始前]
- [ ] CHK037 spec/ADR-004 保持 Draft 即进入执行，其转 Pending/Confirmed 的时点与批准人是否写明（T034 仅写"ADR 随实现转 Pending"）？[Clarity, tasks T034]
- [ ] CHK038 范围边界（FR-019 六项延后、密码喷洒、单 Redis/单应用实例假设）是否在 spec 与 plan 中均为**显式不做**且每条有后续承接位置，而非悬空搁置？[Completeness, Spec FR-019/假设；plan Constraints/Scale]

## Notes

- 共 38 项，全部以"需求质量问句"书写；标 `[Gap]` 为复查中新识别的候选遗漏，须回权威工件修补或显式记录接受理由后再勾选。
- 评审人逐项勾选；需要改规格时走 arch-agent 规划权（executing 中不得自行改 spec/plan/tasks）。
- `/speckit-implement` 在本仓库被禁止（AGENTS.md §7.5）；执行只读 tasks.md，不修改本清单标记。
- 与 `/speckit-analyze` 的关系：analyze 做机器化跨工件一致性比对；本清单承载其无法覆盖的"威胁/边界/残余风险"人工判断项（如 CHK014/015/024/027）。
