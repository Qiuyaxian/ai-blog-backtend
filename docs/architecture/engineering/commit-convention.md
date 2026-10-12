# 提交信息规范

项目采用 Conventional Commits，提交信息必须可读、可检索、可自动生成 changelog。

## 格式

```txt
<type>(<scope>): <subject>

<body>

<footer>
```

示例：

```txt
feat(auth): 增加手机号验证码登录

支持国内手机号验证码登录，并补充失败重试限制。

Closes #123
```

## type 类型

**type 枚举的唯一事实源是仓库根目录 `commitlint.config.cjs` 的 `promptTypes`**（commitlint 校验与 `pnpm commit` 的交互式选择共用这一份定义），本文不复制枚举表，避免两处漂移。

当前包含：`init`、`feat`、`fix`、`docs`、`refactor`、`perf`、`test`、`tool`、`style`、`revert`、`update`、`build`、`ci`、`chore`。新增或修改 type 时只改 `commitlint.config.cjs`。

## scope

可选，表示影响范围：

```txt
feat(user): ...
fix(cart): ...
docs(readme): ...
ci(github): ...
```

## subject

- 使用中文或英文均可，但项目内保持一致。
- 不以句号结尾。
- 使用祈使句或动宾结构。
- 建议不超过 50 个字符。

## body

- 可选。
- 说明为什么改，而不是简单重复改了什么。
- 每行建议不超过 100 个字符。

## footer

用于关联 issue、破坏性变更：

```txt
BREAKING CHANGE: 删除旧版登录接口
Closes #123
```

## 约定

- 一个提交只做一件事。
- 不要提交 `wip`、`update`、`fix bug` 这类无意义信息。
- 破坏性变更必须写 `BREAKING CHANGE`。
- 交互式提交用 `pnpm commit`（commitizen + cz-git）；提交时由 `.husky/commit-msg` 调用 commitlint 校验，见 [git-hooks.md](./git-hooks.md)。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：删除内嵌 type 枚举表与虚构的 commitlint.config.js 示例，枚举统一指向 commitlint.config.cjs 的 promptTypes。
