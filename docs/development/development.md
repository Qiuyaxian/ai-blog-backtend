# 开发指南

## 1. 安装依赖

```bash
pnpm install
```

> `bcrypt` 含原生构建脚本，安装后若 `require('bcrypt')` 报 `bcrypt_lib.node` 找不到，见 [§8 故障排查 · bcrypt 原生绑定](#81-bcrypt-原生绑定缺失--构建脚本被忽略)。

## 2. 启动基础服务

任选一种方式：**本地启动** 或 **Docker Compose 启动**。

### 方式一：本地启动

> 1. 启动 Redis

```bash
cd /usr/local/redis-4.0.11
redis-server
```

> 2. 启动 MongoDB

```bash
mongod --dbpath ~/Documents/Study/new-blogs/Harness_Engineering_demo/mongod-database --port=27017
```

### 方式二：Docker Compose 启动（前提：存在 docker-compose.yml）

> 当前仓库未提交 `docker-compose.yml`；若本地已自行编写或后续补入该文件，可在项目根目录执行：

```bash
docker compose up -d mongo redis
```

### 说明

- 本地启动：需已安装 Redis 和 MongoDB，且 MongoDB 的 `dbpath` 目录存在。
- Docker 启动：前提是存在 `docker-compose.yml`，执行后会后台启动 `mongo` 和 `redis` 两个服务。
- 两种方式任选其一即可。

## 3. 配置环境变量

无需复制 env 文件：应用按 `NODE_ENV` 自动加载 `.env.local` / `.env.uat` / `.env.production`（默认 local，见 `src/app.module.ts`）。首次启动只需确认 `.env.local` 中的 MongoDB / Redis 连接配置。

Redis 相关变量（详见 `docs/architecture/design/redis-integration-design.md` §3.1）：

| 变量               | 说明                                              | local 示例  |
| ------------------ | ------------------------------------------------- | ----------- |
| `REDIS_HOST`       | Redis 主机，必填，缺失则启动报错（不给默认地址）  | `127.0.0.1` |
| `REDIS_PORT`       | 端口                                              | `6379`      |
| `REDIS_PASSWORD`   | 密码；本地留空，uat/prod 由运维提供，不入库       | （空）      |
| `REDIS_DB`         | 逻辑库编号                                        | `0`         |
| `REDIS_KEY_PREFIX` | 键的环境前缀，缺省取 `${NODE_ENV}:`，用于环境隔离 | `local:`    |

认证相关变量（003-user-login）：

| 变量                     | 说明                                                                                                                       | local 示例 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `AUTH_TOKEN_TTL_SECONDS` | 登录令牌会话 TTL（正整数秒），缺省 `604800`（7 天）；非正整数启动 fail-fast。失败锁定阈值/时长为代码安全常量，不经环境变量 | `604800`   |

## 4. 启动开发服务

```bash
pnpm run start:local
```

<!-- 待处理：服务默认监听 `http://localhost:3000`，当前仅根路径 `GET /` 返回 Hello World，尚无 /health 健康检查路由。 -->

## 5. 打包生产构建

```bash
pnpm run build:prod
```

## 6. 常用命令

| 命令                   | 说明                      |
| ---------------------- | ------------------------- |
| `pnpm run start:local` | 启动本地服务              |
| `pnpm run start:uat`   | uat 环境模式              |
| `pnpm run start:prod`  | 生产模式                  |
| `pnpm run build:local` | 构建本地环境              |
| `pnpm run build:uat`   | 构建 uat 环境             |
| `pnpm run build:prod`  | 构建生产环境              |
| `pnpm run lint`        | ESLint 检查并修复         |
| `pnpm run format`      | Prettier 格式化           |
| `pnpm run test`        | 单元测试                  |
| `pnpm run test:e2e`    | 端到端测试                |
| `pnpm run test:cov`    | 覆盖率                    |
| `pnpm run new`         | 使用 hygen 生成模块或文档 |
| `pnpm run commit`      | 触发代码提交              |

## 7. 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-14：新增 §8 故障排查——记录 bcrypt 原生绑定/`ERR_PNPM_IGNORED_BUILDS`（pnpm ≥10 构建脚本白名单 `allowBuilds`）、沙箱内重装导致 `node_modules` 半损坏、Node 版本、MongoDB IPv6 四个已踩坑点及修复命令；§1 安装依赖加指针。

## 8. 故障排查

### 8.1 bcrypt 原生绑定缺失 / 构建脚本被忽略

**症状**

- `pnpm install` / `pnpm rebuild bcrypt` 末尾出现 `ERR_PNPM_IGNORED_BUILDS` 与 `Ignored build scripts: bcrypt@..., @nestjs/core@...`。
- 运行测试或启动时报：

  ```text
  Error: Cannot find module '.../bcrypt/lib/binding/napi-v3/bcrypt_lib.node'
  ```

**根因**

pnpm ≥10 出于供应链安全，默认不执行依赖包的 install 脚本。`bcrypt` 是原生模块，必须运行 install 脚本（`node-pre-gyp`）下载/编译 `bcrypt_lib.node`；脚本被跳过就缺二进制。

**已落实的配置（不要重复排查）**

- `pnpm-workspace.yaml` 的 `allowBuilds`（pnpm 10/12 读取）：

  ```yaml
  allowBuilds:
    bcrypt: true # 允许原生绑定构建
    '@nestjs/core': false # 仅捐赠提示脚本，禁止
  ```

- `package.json` 的 `pnpm.onlyBuiltDependencies: ["bcrypt"]`：pnpm 9 读取。两处并存以兼容 pnpm 9 与 10+。

**修复命令**

```bash
# Node 必须 >=20（项目 .nvmrc=20），先确认
node -v
# 批准后重编译 bcrypt
pnpm rebuild bcrypt
node -e "require('bcrypt'); console.log('BCRYPT_OK')"
```

> 仍报 `ERR_PNPM_IGNORED_BUILDS` 时，检查 `pnpm-workspace.yaml` 的值是否是 pnpm 自动写入的占位串
> （形如 `bcrypt: set this to true or false`）——占位串不是 `true`，需手动改成 `bcrypt: true` 再 rebuild。

### 8.2 pnpm install 报 `ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR`

**症状**：安装失败，提示 `Failed to remove .../node_modules/.pnpm ... Operation not permitted`，且随后本地 eslint/jest 出现 `Cannot find module 'glob-parent'` 等缺件（半损坏的 node_modules）。

**根因**：Cursor 沙箱拦截对 `node_modules/.pnpm` 的删除，pnpm 重装无法清虚拟仓，留下半装状态。

**修复**：在沙箱外（批准后）执行一次 `pnpm install`，再按 §8.1 `pnpm rebuild bcrypt`。不要直接调用 `node_modules/.bin/eslint|jest` 绕过 pnpm——半损坏仓下它们同样会缺依赖。

### 8.3 Node 版本不对

**症状**：`pnpm` 直接报 `This version of pnpm requires at least Node.js v18.12, The current version ... v16`。

**修复**：切到 Node 20（本机路径）：

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.1/bin:$PATH"
node -v   # v20.20.1
```

### 8.4 MongoDB 连 `localhost:27017` 偶发 ECONNREFUSED

mongod 以 `--bind_ip=127.0.0.1` 只监听 IPv4，而 Node 18+ 解析 `localhost` 优先 IPv6 `::1`。连接串固定用 `mongodb://127.0.0.1:27017/...`，不用 `localhost`。
