# 快速验证指南：用户模块

> Phase 1 产物。描述如何端到端验证功能；不含完整实现代码，具体字段见 [data-model.md](./data-model.md)，接口见 [contracts/user-api.md](./contracts/user-api.md)。

## 前置

1. Node 20+、pnpm 9。
2. MongoDB 运行在 27017（`mongod --dbpath ... --port=27017`），`.env.local` 配置好 `MONGODB_URI`。
3. 已安装依赖（含人工评审后新增的 `bcrypt`、`class-validator`、`class-transformer`）。
4. 库中存在至少一名管理员种子用户（用于管理员接口）。

## 自动化验证（主路径）

```bash
pnpm lint
pnpm test          # 单元：Service / Guard / DTO
pnpm test:e2e      # 自举应用，无需手动启动服务
```

通过标准：退出码 0，无失败。关键用例（与设计文档 §10 对齐）：

- 注册成功且 `isAdmin=false`；密码以 bcrypt 存储、明文不落库不出参。
- 重复用户名/邮箱分别得到对应 409；大小写/空格归一后仍判重。
- 出参不含 `password`/`usernameLower`/`deletedAt`。
- 注册 DTO 传入 `isAdmin` 被拒/剥离，无法提权。
- 弱密码、非法邮箱、非法 ObjectId → 400。
- 未认证 401；普通用户访问管理员接口 403。
- 取消/删除唯一管理员 → 409；存在多名管理员时可降权/删除。
- 软删后：列表不可见、只读详情返回 200 + `data:null`（005 T031；原 404 仅保留给写操作）、记录仍在、同名不能再注册、重复删除返回 404。

## 手动冒烟（可选，服务启动后）

```bash
pnpm run start:local
```

1. 注册：`POST /users` 合法 body → 200。
2. 同名再注册 → 409 `USERNAME_EXISTS`。
3. （登录模块就绪后）带用户态 `GET /users/me` → 200 且无密码字段。
4. 管理员 `GET /users?page=1&pageSize=10` → 200，`data` 为 `{total,list,page,pageTotal,index}`（005 T031 页码分页）。
5. 管理员 `GET /users/detail?id=...` → 200；不存在/已软删的 id → 200 + `data:null`；非法 id → 400。
6. 管理员 `POST /users/admin` `{id,isAdmin:false}`：唯一管理员 → 409。
7. 管理员 `POST /users/delete` `{id}` → 200 且 `data:null`，随后 detail 返回 200 + `data:null`、列表消失；重复删除 → 404。

> 登录/令牌尚未在本模块实现；E2E 通过 `test/helpers/e2e-app.ts` 的测试桩（`x-test-user` 头注入 `request.user`）验证 Guard（tasks T035），手动冒烟的带态请求需待认证模块。
