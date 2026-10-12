# 开发指南

## 1. 安装依赖

```bash
pnpm install
```

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
