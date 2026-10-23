# Quickstart：Swagger 接口文档接入（004）

端到端验证指南。前置依赖与启动方式见 [AGENTS.md §2.3](../../AGENTS.md) 与 [development.md](../../docs/development/development.md)。

## 1. 前置

1. Node 20 + pnpm 9。
2. 安装新依赖：`pnpm install`（@nestjs/swagger ^7.4.2，Express 项目不装 @fastify/static）。
3. 本地依赖在运行：redis-server（6379）、mongod（27017，`--dbpath` 见 AGENTS.md §2.3）。
4. 三套 env 已含 `SWAGGER_ENABLED`：local/uat=true、production=false。

## 2. 自动化验证（证据驱动）

```bash
pnpm lint
pnpm test                                   # 新增 swagger 纯函数单测在内全部通过
pnpm test:e2e                               # 新增 swagger-docs.e2e-spec.ts 在内全部通过
pnpm build:local
```

### 2.1 单测：`src/common/swagger/swagger.spec.ts`

`isSwaggerEnabled` 纯函数，无外部依赖：

| 用例             | 输入                           | 期望                         |
| ---------------- | ------------------------------ | ---------------------------- |
| local 默认       | nodeEnv=`local`, override 未设 | true                         |
| uat 默认         | `uat`                          | true                         |
| production 默认  | `production`                   | false                        |
| undefined 默认   | undefined                      | true（非 production 即开放） |
| 显式开启生产     | `production`, override=`true`  | true                         |
| 显式关闭非生产   | `uat`, override=`false`        | false                        |
| 大写值           | override=`TRUE`                | true（大小写不敏感）         |
| 非法值 fail-fast | override=`ture`                | throw                        |

### 2.2 E2E：`test/swagger-docs.e2e-spec.ts`（--runInBand，真实本地依赖）

**A. local 配置（e2e-app 默认 NODE_ENV=local）**

1. `GET /api-docs` → 200，content-type 为 HTML，正文包含 swagger-ui 标记。
2. `GET /api-docs-json` → 200，JSON：
   - `info.title/version` 非空；
   - `paths` 含全部 9 个业务路径键：`/auth/login`、`/auth/logout`、`/users`、`/users/me`、`/users/detail`、`/users/admin`、`/users/delete`（含各方法）；
   - 受保护 operation（logout、users/me GET+POST、users GET、users/detail、users/admin、users/delete）`security` 含 Bearer；login 与 POST /users 无 security；
   - `components.schemas.LoginDto.properties.password` minLength=8/maxLength=64；`CreateUserDto.password.pattern` 非空；
   - `components.securitySchemes.Bearer.scheme=bearer`；
   - 全部 schema 与 example 中不出现 `passwordHash`、`usernameLower`、`deletedAt` 字段（断言 UserResponseDto 属性集合恰为 6 个）。
3. 调试链路走真实守卫（契约 §4 四态）：无 token 401、有效 token 200、普通用户访问管理员列表 403、登出后原 token 401。

**B. production 配置（独立 bootstrap，不污染默认 e2e-app）**

- 在套件内用 `NestFactory.create(AppModule, { logger:false })` 自建应用，设置 `process.env.NODE_ENV='production'` 与独立测试库 URI，走与 main.ts 相同的全局增强 + `setupSwagger`：
  - `GET /api-docs` → 404；`GET /api-docs-json` → 404；
  - 对照断言 `POST /auth/login` 仍正常响应错误/成功（业务行为不变，可用不存在的凭据断言 401 而非 404）；
  - 用例结束恢复 `process.env.NODE_ENV='local'` 并关闭应用。

> 注意：env 文件按 NODE_ENV 加载，production 用例依赖 `.env.production` 中 MONGODB_URI 指向可连的测试库；若其为占位远程地址，用例在 bootstrap 前以 `process.env.MONGODB_URI` 覆盖为本地测试库（与 e2e-app 同策略），Redis 同理覆盖。

## 3. 手工冒烟

```bash
pnpm run start:local
# 浏览器打开 http://127.0.0.1:3000/api-docs
```

1. 页面显示 auth/users/infra 三个分组与全部接口。
2. 在 `POST /auth/login` 点 Try it out，用已注册账号登录 → 复制响应 `token`。
3. 点页面右上 Authorize，粘贴 token → 调 `GET /users/me` 返回本人资料；调 `GET /users`（管理员）按角色返回 200/403。
4. 调 `POST /auth/logout` 后再调 `GET /users/me` → 401。
5. 关闭服务，以生产配置启动：

```bash
NODE_ENV=production pnpm run start:prod   # 本地冒烟用，需 .env.production 指向本地依赖
```

`curl -i http://127.0.0.1:3000/api-docs` 与 `/api-docs-json` 均为 404；冒烟后停服。

## 4. 验收对照

- spec FR-001/002/011 → §2.2 A1-2、B；FR-004/005/006/007/008 → §2.2 A2 + [契约文件](./contracts/api-contract.md)；FR-009/010 → §2.2 A3、§3.2-4；FR-012 → §2.2 B 业务对照 + 全量既有套件不回归；FR-013 → §2.2 A2 敏感字段断言；FR-014 → package.json 仅新增 1 个直接依赖、nest 版本不变；FR-015 → 本文件全部自动化项。

## 5. 回滚

还原 package.json/pnpm-lock.yaml、移除 `src/common/swagger/`、还原 main.ts/e2e-app.ts 与各 DTO/controller 注解、env 键；无数据变更，回滚 ≤ 5 分钟。
