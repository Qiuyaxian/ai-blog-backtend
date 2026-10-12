# CI/CD 流程

> 状态：Draft。仓库当前**没有** `.github/workflows/` 配置文件，本文记录规划中的门禁与流水线；workflow 落地后改为 Confirmed 并补实际配置链接。

## CI 规划

- 触发：push / pull request 到 `main`、`develop`。
- 阶段顺序与本地提 PR 前的全量检查一致（AGENTS.md §6.3）：

  1. 安装 pnpm 9 + Node 20
  2. `pnpm install --frozen-lockfile`
  3. `pnpm lint`
  4. `pnpm test`
  5. `pnpm run build:uat`（或对应环境构建）

- 任一阶段失败即终止；CI 未过不得合并。

> 当前没有独立的 `typecheck` script；类型错误由 `nest build`（构建阶段）暴露。后续如在 package.json 增加 `typecheck`，再把它插到 lint 之后。

## 部署阶段

CD 的发布策略（蓝绿 / 金丝雀）、灰度、回滚条件与步骤属于运维范畴，见 [部署与运行](../../operations/deployment.md)，本文不重复。

## 分支策略

分支命名、基线、合并策略以 [AGENTS.md §6.5](../../../AGENTS.md) 为唯一事实源，本文不再维护第二份分支表。

## 约定

- CI 必须使用 `pnpm install --frozen-lockfile`。
- 密钥统一放平台 Secrets，禁止写进 workflow 文件。
- 构建产物不提交到仓库。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：标记为 Draft（workflow 尚未落地），删除虚构的 ci.yml/deploy yml；流水线阶段与 AGENTS.md §6.3 对齐，分支策略改为引用 AGENTS.md。
