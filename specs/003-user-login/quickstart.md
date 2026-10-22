# 快速验证指南：用户登录鉴权

**Feature**：003-user-login | **Date**：2026-10-22

本文档只描述如何验证功能端到端可用；实现细节见 [research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/auth-api.md](./contracts/auth-api.md)。

## 1. 前置条件

1. Node 20 + pnpm 9；依赖已安装（本功能不新增依赖）。
2. 本地 MongoDB 7 与 Redis 4 已启动（AGENTS.md §2.3）：
   - Redis：`redis-server`（`/usr/local/redis-4.0.11`，127.0.0.1:6379）
   - Mongo：`mongod --dbpath <dbpath> --port=27017`
3. `.env.local` 含既有 Mongo/Redis 配置，并新增（缺省时用默认值，正整数校验）：
   - `AUTH_TOKEN_TTL_SECONDS=604800`

## 2. 自动化验证（门禁）

按序执行，退出码均须为 0：

```bash
pnpm lint
pnpm test          # 单测：auth.config/auth.service/auth.guard/login.dto
                   # + CacheService.incrWithTtl、UserService.getAuthPrincipal
pnpm test:e2e      # 真实 mongod + redis；含新增 auth-login.e2e-spec.ts
```

E2E 覆盖（对照 spec FR）：

- 用户名登录、邮箱登录（大小写/空格归一）成功，返回 `token/expiresAt/user`（FR-001/002/005）。
- 错误密码、不存在标识、已软删账号 → 统一 401 `INVALID_CREDENTIALS`（FR-006/007）。
- 无令牌/伪造/过期/已登出令牌访问 `/users/me` → 401（FR-008/010）。
- 普通用户访问 admin 接口 → 403；降权后旧令牌再访问 → 403；软删后旧令牌 → 401（FR-009/011）。
- 登出后同令牌 401；重复登出幂等；其他会话不受影响（FR-012/018）。
- 连续 5 次错误密码 → 第 6 次正确密码也返回统一 401（响应与密码错误不可区分；锁定事实只在服务端日志）；不存在标识反复失败不影响真实账号（FR-006/013）。
- 既有 2 个用桩的 user E2E 套件（user-profile、user-admin）改走真实登录，全部通过；`x-test-user` 桩不再存在；user-register 为公开注册链路，不用桩（FR-017/020）。

单元测试覆盖 fail-closed：Mock CacheService 抛错时 AuthGuard 返回 401（FR-015），Mock 用户存储不可用时同样不放行；锁定期满解除、成功登录清零、锁定期内外响应不可区分。

## 3. 手工冒烟（curl）

启动：`pnpm run start:local`。

```bash
# 1) 注册（公开）
curl -s -X POST localhost:3000/users -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@example.com","password":"abcd1234"}'

# 2) 登录（用户名）
LOGIN=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"alice","password":"abcd1234"}')
echo "$LOGIN"   # 含 token / expiresAt / user，无 password
TOKEN=$(echo "$LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 2b) 邮箱大小写不敏感也可登录
curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":" ALICE@EXAMPLE.COM ","password":"abcd1234"}'

# 3) 持令牌访问受保护接口
curl -s localhost:3000/users/me -H "Authorization: Bearer $TOKEN"

# 4) 无令牌 / 坏令牌 → 401
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/users/me
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/users/me -H 'Authorization: Bearer nope'

# 5) 登出后令牌立即失效
curl -s -X POST localhost:3000/auth/logout -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/users/me -H "Authorization: Bearer $TOKEN"
# 期望：200 后再访问为 401

# 6) 健康探针公开
curl -s localhost:3000/health/live
curl -s localhost:3000/health/ready
```

失败锁定冒烟（错误密码连打 5 次，第 6 次正确密码预期仍为 401 统一凭据错误；真实锁定原因看服务端日志，可在 Redis CLI 观察键）：

```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/auth/login \
    -H 'Content-Type: application/json' -d '{"identifier":"alice","password":"wrong9999"}'
done
# 全部为 401（前 4 次密码错，第 5 次起锁；对外无差异）
# 再用正确密码——仍 401，响应体与密码错误完全相同：
curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"alice","password":"abcd1234"}'
# 期望 {"code":"INVALID_CREDENTIALS",...,"statusCode":401}；服务端日志可见锁定命中

redis-cli KEYS 'local:auth:*'   # 可见 sess/fail/lock 三类键（带环境前缀）
```

> 锁定期满验证：单测中用伪造时钟/短 TTL 配置验证（不手工等 15 分钟）；本地冒烟可临时把锁定时长经常量调小后还原（仅限本地，不提交）。

## 4. 完成判定

- 上述自动化命令退出码 0，E2E 全绿；测试桩已删除。
- 手工冒烟响应码与契约一致；响应/日志无密码与完整令牌。
- ADR-004 随实现转 Pending，进入人工评审。
