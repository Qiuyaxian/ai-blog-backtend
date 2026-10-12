# Hygen 模板生成

项目使用 Hygen 生成重复文件，减少手写样板。当前只配置了**文档生成器**。

## 依赖

`hygen` 已在 `devDependencies`，无需额外安装。

## 使用方式

统一通过 npm script 进入交互式选择（入口为 `scripts/new.js`）：

```bash
pnpm run new
```

当前只有一个选项「文档 (docs)」，选择后等价于执行：

```bash
npx hygen docs new
```

生成位置与模板变量由 `_templates/docs/new/` 决定，输出到 `docs/<name>/README.md`。

## 模板目录

`_templates/` 当前内容：

| 路径                                        | 用途                               |
| ------------------------------------------- | ---------------------------------- |
| `_templates/docs/new/docs.ejs.t`            | 文档 README 模板                   |
| `_templates/docs/new/prompt.js`             | 生成时的交互提问                   |
| `_templates/init/`、`_templates/generator/` | hygen 自带的初始化示例，非业务模板 |

> 目前没有 NestJS 模块（module/controller/service）生成器。新增代码生成器时，在 `_templates/` 下添加对应模板，并同步在 `scripts/new.js` 的 choices 中注册，本文档同一 PR 更新。

## 约定

- 生成的文件必须符合 [代码规范](./code-style.md) 与 [开发规范](../../development/coding-style.md)。
- 模板变更需同步更新本文档。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：按仓库真实状态重写——当前仅文档生成器（`pnpm run new` → `scripts/new.js` → hygen docs new），删除 Vue 组件模板残留。
