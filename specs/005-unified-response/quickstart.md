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

- `response.constants.spec.ts`：`isEnvelopeExcludedPath` 边界（`/`、`/health`、`/health/live`、`/health/ready` 豁免；`/healthx`、`/health-2`、`/users`、`''` 不豁免）；`SUCCESS_CODE===200`（数字）。
- `transform-response.interceptor.spec.ts`：mock ExecutionContext + CallHandler：
  - 业务路径返回值被包成四字段，`code=200`、`message=ok`、`data===原对象`；
  - 豁免路径直接透传，不包裹；
  - 异常不被拦截器吞掉（不传 `catchError`，异常继续流向 filter）。
- `http-exception.filter.spec.ts`（改写）：错误体断言四字段、外壳 `code` 为数字 HTTP 状态（400/409/500）、`data:null`、无 `statusCode`；豁免路径透传 Terminus `ServiceUnavailableException` 原 body。

### E2E 断言迁移

- 成功：`res.body.data.*` 且 `res.body.code===200`；错误：`res.body.code` 等于 HTTP 状态数字，并断言 `data===null`、无 `statusCode`。
- 同状态细分原因断言 `message` 中文文案（如 409 区分「用户名已存在/邮箱已存在/最后一个管理员不可删除」）。
- 顶层键集合契约用例：`expect(Object.keys(body).sort()).toEqual(['code','data','message','success'])`。
- `app.e2e-spec.ts`、`redis-health.e2e-spec.ts` 不改（豁免路径）。

### T031 CRUD `data` 五形态断言（Phase 8 实现后生效）

- 列表：`data` 恰为 `{total,list,page,pageTotal,index}`；首页 `index===1`，第 2 页（pageSize=20）`index===21`，`pageTotal===Math.ceil(total/pageSize)`，空库 `{total:0,list:[],page:1,pageTotal:0,index:1}`；无 `items/nextCursor/cursor`。
- 删除：`POST /users/delete` 成功 `data===null`；只读单查不存在/已软删 200 + `data===null`（不断言 404），非法 id 仍 400；写操作（admin/delete）目标不存在仍 404。
- 创建/更新：`data` 为完整脱敏用户对象（6 字段）。

## 2. 手工冒烟（local:3000）

```bash
pnpm run start:local
```

1. 注册：`POST /users` → 200，四字段外壳，用户在 `data`。
2. 登录：`POST /auth/login` → 200，`data.token/data.user`。
3. 本人：`GET /users/me` 带 Bearer → 200，`data` 为 6 字段用户视图。
4. 登出：`POST /auth/logout` → 200，外壳 `code=200`、`data===null`（登出无数据）。
5. 错误：错误密码 → 401 `code=401,data=null,message=用户名或密码错误`；重复注册 → 409 `code=409`（用户名/邮箱冲突看 message）；普通用户 `GET /users` → 403；非法 id `GET /users/detail?id=zzz` → 400（message「无效的资源 ID」）；不存在的合法 id → 200 + `data:null`（T031 只读空结果）。
6. 任一错误响应确认 `code` 是数字、无 `statusCode`、无堆栈。
7. 豁免：`GET /` 返回纯文本 `Hello World!`；`GET /health/live` → `{status:'up'}`；`GET /health/ready` → Terminus 原生 JSON，均无外壳。
8. 文档：`http://127.0.0.1:3000/api-docs`，登录接口成功模型外层四字段、`data` 内 token/user；错误模型 `code` 为数字、无 statusCode。
9. CRUD 形态（T031）：管理员 `GET /users?page=1&pageSize=20` → `data={total,list,page,pageTotal,index}`（首页 index=1，无 items/nextCursor）；`POST /users/delete` `{id}` → 200 + `data:null`；`POST /users/me` 更新邮箱 → `data` 为更新后的完整用户。

## 3. 回滚

单 PR、无 DB 变更。回滚 = revert「拦截器注册 + filter body 改动」提交，≤5 分钟；探针因豁免设计在两个方向上都不受影响。
