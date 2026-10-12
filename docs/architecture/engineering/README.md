# 工程化概览

> 本文档描述开发阶段的工具链与规范。
> 上级文档：[overview.md](../overview.md)

## 1. 工具清单 & 用途 & 文档

| 工具                | 用途                               | 详细文档                                       |
| ------------------- | ---------------------------------- | ---------------------------------------------- |
| Husky               | Git hooks 管理                     | [git-hooks.md](./git-hooks.md)                 |
| lint-staged         | 提交前对暂存文件执行 lint / 格式化 | [git-hooks.md](./git-hooks.md)                 |
| Commitlint + cz-git | 提交信息规范                       | [commit-convention.md](./commit-convention.md) |
| ESLint + Prettier   | 代码规范与格式化                   | [code-style.md](./code-style.md)               |
| hygen               | 生成 NestJS 模块、文档模板         | [hygen.md](./hygen.md)                         |
| GitHub Actions      | CI/CD                              | [ci-cd.md](./ci-cd.md)                         |
| pnpm                | 包管理                             | [package-manager.md](./package-manager.md)     |

## 2. 要点

- 提交前由 lint-staged 自动执行暂存文件的 eslint --fix 与 prettier。
- 提交信息遵循约定式提交（枚举以 `commitlint.config.cjs` 为准），便于生成变更日志。
- 使用 hygen（`pnpm run new`）快速生成文档骨架。
- CI 规划覆盖 lint、测试、构建（当前 workflow 尚未落地，见 [ci-cd.md](./ci-cd.md)）；部署按环境分阶段。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
