# pnpm 使用约定

项目统一使用 pnpm，禁止混用 npm、yarn。

## 版本要求

- Node >= 20（见 `.nvmrc` 与 `package.json` engines）
- pnpm >= 9

推荐使用 Corepack：

```bash
corepack enable
corepack prepare pnpm@9 --activate
```

## 常用命令

```bash
pnpm install          # 安装全部依赖
pnpm add <pkg>        # 添加生产依赖
pnpm add -D <pkg>     # 添加开发依赖
pnpm remove <pkg>     # 移除依赖
pnpm up               # 在 semver 范围内更新
pnpm up --latest      # 更新到最新版本
pnpm dlx <pkg>        # 执行一次性命令
```

> 项目脚本见 [开发指南 §6 常用命令](../../development/development.md#6-常用命令)，如 `pnpm run start:local`、`pnpm test`，本文不重复。

## 锁文件

- 必须提交 `pnpm-lock.yaml`。
- 不允许提交 `package-lock.json`、`yarn.lock`。
- CI 使用 `pnpm install --frozen-lockfile` 保证锁文件一致。

## 依赖分类

| 类型                   | 说明                        |
| ---------------------- | --------------------------- |
| `dependencies`         | 运行时依赖                  |
| `devDependencies`      | 构建、测试、lint 等开发依赖 |
| `peerDependencies`     | 插件、库对外要求的宿主依赖  |
| `optionalDependencies` | 可选依赖                    |

## 约定

- 禁止使用 `npm install`、`yarn add`。
- 新增依赖需说明用途；禁止引入无维护、无许可证或来源不明的包（见 [架构编码规范 §2](../development-standards.md#2-依赖与技术选型)）。
- 升级依赖后运行 `pnpm lint && pnpm test` 验证。
- 依赖统一用 pnpm 命令增删改，不要手改 `package.json`；`.env.local/.uat/.production` 按 AGENTS.md §7 允许提交，其余密钥仍禁止入库。
- 不提交 `node_modules`。

> 当前为单包项目，没有 `pnpm-workspace.yaml`，不使用 monorepo / `pnpm -F` 工作流。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：按仓库真实状态重写——单包项目，删除 monorepo workspace 章节与无关命令示例。
