# Git Hooks

本项目使用 Husky + lint-staged + commitlint 管理 Git Hooks，保证提交时代码格式与提交信息规范。

## 依赖与安装

依赖已在 `devDependencies`：`husky`、`lint-staged`、`@commitlint/cli`、`@commitlint/config-conventional`。

`package.json` 中 `"prepare": "husky"`，执行 `pnpm install` 后自动启用 hooks。

## 实际启用的 hooks

仓库 `.husky/` 目录当前只有两个 hook：

### `.husky/pre-commit`

```bash
npx lint-staged
```

### `.husky/commit-msg`

```bash
npx --no -- commitlint --edit "$1"
```

> 没有启用 pre-push。全量检查在提 PR 前手动执行：`pnpm lint && pnpm test`（见 AGENTS.md §6.3）。

## lint-staged 配置

配置文件为仓库根目录 `.lintstagedrc.json`（不在 package.json 内）：

```json
{
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

只处理暂存区文件，不跑全量测试。

## commitlint 配置

规则与交互式选择由 `commitlint.config.cjs` 定义，type 枚举以该文件的 `promptTypes` 为唯一事实源，详见 [commit-convention.md](./commit-convention.md)。

## 约定

- 不要使用 `git commit --no-verify` 绕过钩子（AGENTS.md §6.3 明令禁止）。
- hook 脚本保持轻量，耗时任务（全量测试、构建）放 CI 或手动执行。
- 新增 hook 后必须提交 `.husky/` 目录内对应文件。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：按仓库真实状态重写——仅 pre-commit/commit-msg 两个 hook，lint-staged 配置在 .lintstagedrc.json，删除 vitest/Vue/pre-push 等模板残留。
