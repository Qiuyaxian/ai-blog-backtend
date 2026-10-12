# 自动启用配置

> 返回入口：[Caveman 使用指南](./README.md)

## 自动启用配置教程

Caveman 在 Cursor 中默认是**按会话激活**的。以下方式可以让它在每次会话中自动生效。

### 方式一：`--with-init` 生成常驻规则文件（推荐）

这是最简单的方式。安装时加上 `--with-init` 参数：

```bash
npx skills add JuliusBrussee/caveman -a cursor --with-init
```

执行后会向当前仓库写入：

```text
.cursor/rules/caveman.mdc
```

该文件来自 Caveman 的单一事实源 `rules/caveman-activate.md`，由 CI 自动注入 Cursor frontmatter（包括 `alwaysApply: true`），Cursor 会在每次会话中自动加载。

### 方式二：`/caveman:init` 命令（多 Agent 批量写入）

Caveman 提供 `/caveman:init` 命令，可以一次性把常驻精简规则写入当前仓库支持的多个 Agent 规则位置，覆盖 Cursor、Windsurf、Cline、GitHub Copilot、OpenCode、AGENTS.md 等[reference:5]。

在 Claude Code 中执行：

```text
/caveman:init
```

该命令底层调用 `caveman-init.js`，支持以下参数：

| 参数             | 效果                                            |
| ---------------- | ----------------------------------------------- |
| `--dry-run`      | 预览将要写入的文件，不做实际修改                |
| `--force`        | 覆盖已有规则文件（不加此参数时默认先 dry-run）  |
| `--only <agent>` | 只写入指定 Agent 的规则文件，如 `--only cursor` |

如果不在 Caveman 仓库内，脚本会自动从远程下载独立版本执行：

```bash
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/src/tools/caveman-init.js | node - --only cursor
```

### 方式三：手动创建 `.cursor/rules/caveman.mdc`

如果不使用安装脚本，也可以手动创建规则文件。先从远程拉取规则正文：

```bash
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/src/rules/caveman-activate.md \
  > .cursor/rules/caveman.mdc
```

然后在文件顶部添加 Cursor 所需的 frontmatter：

```markdown
---
description: 启用 Caveman 压缩输出模式
alwaysApply: true
---

（此处为 caveman-activate.md 的正文内容）
```

`alwaysApply: true` 会让 Cursor 在每次会话中自动加载此规则。

### 方式四：在 AGENTS.md 中声明

如果不想创建额外的规则文件，也可以在 `AGENTS.md` 的“通信风格”章节中直接声明：

```markdown
## 通信风格（始终启用）

Caveman 模式 `full` 为默认。每次响应、每次会话均启用。
删除：冠词、填充词（just/really/basically/actually/simply）、
客套话（sure/certainly/of course/happy to）、模糊限制语。
允许碎片句。使用短同义词。技术术语必须精确。代码块保持不变。
关闭方式：用户说 "stop caveman" 或 "normal mode"。

详细强度级别和示例见 [usage.md](./usage.md)。
```

这种方式依赖模型“自觉遵守”文本指令，稳定性不如 `.cursor/rules/` 规则文件，但胜在无需额外文件。

### 推荐组合

| 场景              | 推荐方式                             |
| ----------------- | ------------------------------------ |
| 快速启用          | `npx skills add ... --with-init`     |
| 多 Agent 统一管理 | `/caveman:init`                      |
| 手动精细控制      | 手动创建 `.cursor/rules/caveman.mdc` |
| 不想装额外文件    | 在 `AGENTS.md` 中声明规则            |

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
