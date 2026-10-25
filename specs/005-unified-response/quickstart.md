# Quickstart: 全局统一响应外壳（005-unified-response）

**Date**: 2026-10-26 | **Status**: Draft

## 1. 自动化验证

```bash
# 前置：本地 redis-server 与 mongod（127.0.0.1:27017，库 ai_blog_test）
pnpm lint
pnpm test                       # 单测：常量纯函数、拦截器、filter
pnpm test:e2e                   # 真实 HTTP 契约（--runInBand）
pnpm build:local
```

### 新增/改动单测

- `response.constants.spec.ts`：`isEnvelopeExcludedPath` 边界（`/`、`/health`、`/health/live`、`/health/ready` 豁免；`/healthx`、`/health-2`、`/users`、`''` 不豁免）。
- `transform-response.interceptor.spec.ts`：mock ExecutionContext + CallHandler：
  - 业务路径返回值被包成五字段，`code=SUCCESS`、`message=ok`、`data===原对象`、`path` 取自 req.path、`time` 为 ISO；
  - 豁免路径直接透传，不包裹；
  - 异常不被拦截器吞掉（不传 `catchError`，异常继续流向 filter）。
- `http-exception.filter.spec.ts`（改写）：四种旧用例断言新五字段（`data:null`、无 `statusCode`）；新增豁免路径透传 Terminus `ServiceUnavailableException` 原 body 用例。

### E2E 断言迁移

- 成功：`res.body.data.*`；错误：`res.body.code` 仍在顶层，并断言 `data===null`、无 `statusCode`。
- 顶层键集合契约用例：`expect(Object.keys(body).sort()).toEqual(['code','data','message','path','time'])`。
- 全等体比较（登录锁定用例）改为 `toMatchObject({ code, data:null, path })` + `typeof time`（time 逐请求不同，禁止整体 toEqual）。
- `app.e2e-spec.ts`、`redis-health.e2e-spec.ts` 不改（豁免路径）。

## 2. 手工冒烟（local:3000）

```bash
pnpm run start:local
```

1. 注册：`POST /users` → 201，顶层五字段，用户在 `data`。
2. 登录：`POST /auth/login` → 200，`data.token/data.user`。
3. 本人：`GET /users/me` 带 Bearer → 200，`data` 为 6 字段用户视图。
4. 登出：`POST /auth/logout` → 200，`data.success===true`。
5. 错误：错误密码 → 401 `code=INVALID_CREDENTIALS,data=null`；重复注册 → 409；普通用户 `GET /users` → 403；非法 id `GET /users/detail?id=zzz` → 400 INVALID_ID。
6. 任一错误响应确认无 `statusCode`、无堆栈。
7. 豁免：`GET /` 返回纯文本 `Hello World!`；`GET /health/live` → `{status:'up'}`；`GET /health/ready` → Terminus 原生 JSON，均无外壳。
8. 文档：`http://127.0.0.1:3000/api-docs`，登录接口成功模型外层五字段、`data` 内 token/user；错误模型无 statusCode。

## 3. 回滚

单 PR、无 DB 变更。回滚 = revert「拦截器注册 + filter body 改动」提交，≤5 分钟；探针因豁免设计在两个方向上都不受影响。
