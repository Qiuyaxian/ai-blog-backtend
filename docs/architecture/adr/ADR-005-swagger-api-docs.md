# ADR-005：接入 @nestjs/swagger 在线接口文档（local/uat 开放、production 全 404）

## 状态

待确认（Pending）

> 状态枚举遵循 `AGENTS.md` §9。2026-10-25 随 004-swagger-docs 实现产出（Pending），待人工评审。

## 日期

2026-10-25

## 背景与约束

- 001 用户模块（7 接口）、003 登录鉴权（2 接口）与 infra（根/健康 3 接口）已落地，共 9 个业务操作；前后端/测试联调只能读 markdown 契约（`specs/*/contracts/`），无可交互文档。
- 需求指定 `@nestjs/swagger@^7.4.2`；本仓为 NestJS 9 + Express 平台。
- 规格 `specs/004-swagger-docs` 的硬约束：
  - FR-001/002 local/uat 暴露 `/api-docs` UI 与 `/api-docs-json` 文档源；production 两者与静态资源**全部 404**；
  - FR-004–008 全量 9 个业务接口 + infra 的请求/响应/错误模型注解，与真实契约一致，不得标注永不返回的错误码；
  - FR-009/010 文档页 Authorize 仅经 Bearer 头，调试请求必须走真实全局 AuthGuard（无旁路），不得出现 query/cookie 令牌入口；
  - FR-012 零运行时行为变更；FR-013 文档不泄露密码/哈希/内部字段；
  - FR-014 新增直接生产依赖恰好 1 个，不升级 NestJS 框架。

## 决策

1. **依赖**：仅新增 `@nestjs/swagger@7.4.2`（peer 支持 `@nestjs/common/core ^9||^10`，与 NestJS 9 兼容）；Express 平台不装 optional peer `@fastify/static`；其运行时自带 `swagger-ui-dist`（非 `swagger-ui-express`，7.x 包内集成 express loader）。
2. **开关纯函数** `isSwaggerEnabled(nodeEnv, override?)`：默认 `nodeEnv !== 'production'`（未设置 NODE_ENV 视为非生产）；`SWAGGER_ENABLED` 显式值大小写不敏感覆盖（仅接受 `true`/`false`，其他值 fail-fast）。三套 env 文件显式写值（local/uat=true、production=false），形成「默认规则 + 显式配置」双保险。
3. **production 404 机制**：`setupSwagger()` 判定关闭时直接 return，**不 `createDocument` 也不 `setup`**——路由与 swagger-ui 静态资源全部未注册，Express 对未注册路径天然 404，与普通拼错路径无差异，不暴露「文档存在但被禁」，生产启动也无文档构建开销。不采用「setup 后用 Guard/中间件拦截」（会注册路由、返回 403 暴露存在性，且需维护资产黑名单）。
4. **双入口同函数**：`src/common/swagger/swagger.ts` 导出唯一装配函数 `setupSwagger(app, config)`，`src/main.ts` 与 `test/helpers/e2e-app.ts` 两个调用点共用，保证 production-404 承诺在真实应用与 E2E 应用上行为一致。
5. **鉴权元数据与运行时守卫分离**：`DocumentBuilder.addBearerAuth({ type:'http', scheme:'bearer', bearerFormat:'Opaque', in:'header' }, 'Bearer')` 只影响文档展示与 UI 注入 `Authorization` 头；受保护操作逐方法标 `@ApiBearerAuth('Bearer')`（不做类级标注，避免新增公开接口被误标为需鉴权），公开操作（login/register）不标。运行时鉴权仍只由 003 的全局 APP_GUARD 决定，「调试无旁路」天然成立。
6. **注解防漂移**：6 个 DTO 手写 `@ApiProperty`，约束（minLength/maxLength/pattern/example）逐字对齐 class-validator，不引入 CliPlugin/额外生成库（YAGNI）；响应模型集中 `src/common/swagger/response-schemas.ts`（Login/UserListPage/Logout/Delete/Error）；错误响应只标真实会发生的状态码与业务码，统一错误体为既有 `HttpExceptionFilter` 的 `{code,message,statusCode}`。
7. **infra 粗粒度**：根路径与 health（live/ready）归 `infra` 分组，仅 `@ApiOperation` 摘要，不逐字段建 terminus 模型。
8. 版本号经 `require('../../../package.json')` 读取（tsconfig 未开 resolveJsonModule，commonjs 目标用 require 最小改动）；example 全部占位值（24 位 hex MongoId、example.com、abc12345）。

## 考虑的替代方案

- **降级 @nestjs/swagger 6.x**：仅支持 Nest 9 但需求明确指定 ^7.4.2，且 7.x 已兼容 9，无降级理由。否决。
- **升级 NestJS 10**：超出需求、放大回归面。否决。
- **production setup 后中间件拦截**：路由/静态资源仍注册，403/拦截页暴露文档存在性，需维护资产前缀黑名单。否决（见决策 3）。
- **只关 UI 保留 /api-docs-json**：违反 FR-002（文档源同样不可访问）。否决。
- **类级 @ApiBearerAuth + 公开方法 @ApiNoAuth**：默认值方向危险，login/register 漏标即文档错误；逐方法显式标注在评审中更显眼，与全局守卫「默认拒绝 + @Public 白名单」的显式风格一致。否决。
- **CliPlugin 编译期自动推断**：需改 nest-cli.json、引入隐式行为；6 个 DTO 手写量小。否决（YAGNI）。
- **全局 @ApiResponse 挂全套错误码**：产生大量永不返回的假契约（如 500/422）。否决，改为逐操作只标真实错误码。

## 后果

### 正面

- local/uat 可交互文档 + 在线 Bearer 调试，联调不再只靠 markdown；文档源 JSON 可做契约机器核对。
- production 不注册任何文档路由：404 无差异、无构建开销、无暴露面；双保险（NODE_ENV + 显式 env）。
- 注解对运行时零影响（纯元数据/装饰器），不新增守卫/中间件/依赖注入行为；无 DB/缓存/Schema 变更，回滚 = 还原依赖与注解（≤5 分钟，见 quickstart §5）。
- 防漂移哨兵：E2E 断言文档源关键 DTO 约束（LoginDto.password 8–64、CreateUserDto.password pattern）与 UserResponseDto 恰为 6 公开字段，约束被改动即测试失败。

### 负面

- DTO 约束在 class-validator 与 @ApiProperty 两处手写，存在漂移可能；靠 E2E 哨兵 + 评审清单控制，未做到编译期同源。
- 每新增接口需同步加注解，否则文档缺失；靠全量路径 E2E 断言（9 业务操作 + 3 infra）兜底。
- production 404 E2E 需独立 bootstrap（`jest.isolateModules` 隔离 envFilePath 闭包，并显式覆盖 SWAGGER_ENABLED/MONGODB_URI/Redis 到测试资源），测试基建比普通套件复杂。

### 中性

- swagger-ui-dist 静态资源随包进入 node_modules（传递依赖），生产构建包含但不注册路由。

## 重新评估条件

- 接口数量大幅增长、手写注解维护成本过高 → 评估 CliPlugin 或 validator→schema 自动生成方案。
- 需要对外发布正式 API 文档/多版本契约 → 引入文档版本化与独立文档站点，而非仅靠开发环境内嵌 UI。
- 多环境策略变化（如 production 对内网开放带鉴权文档）→ 改开关模型为基于配置的路径级 Guard，需另立规格。

## 相关文档

- 规格：[specs/004-swagger-docs/spec.md](../../specs/004-swagger-docs/spec.md)
- 研究：[research.md](../../specs/004-swagger-docs/research.md)（R1–R8）
- 契约：[api-contract.md](../../specs/004-swagger-docs/contracts/api-contract.md)
- 验证：[quickstart.md](../../specs/004-swagger-docs/quickstart.md)
- 上游：[ADR-002 用户模块数据模型与权限基线](./ADR-002-user-module.md)、[ADR-004 不透明令牌 + Redis 会话](./ADR-004-opaque-token-redis-session.md)
- 宪法原则：`.specify/memory/constitution.md` I / II / IV

## 更新记录

- 2026-10-25 @dev-agent + AI：初始版本（Pending），随 004-swagger-docs T025 产出；实现 T001–T024 完成（单测 10 项 swagger 纯函数/装配分支、E2E swagger 套件 10 项含四态调试与 production 404），待人工评审。
