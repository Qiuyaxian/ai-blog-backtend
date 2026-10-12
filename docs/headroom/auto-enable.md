# Headroom 自动启用配置（AGENTS.md 集成）

> 返回入口：[Headroom 使用指南](./README.md)
> 基础命令见 [usage.md](./usage.md)。

Headroom 提供多种方式将自动启用规则写入 `AGENTS.md`，确保每次 Cursor 会话都加载压缩配置。

## 方式一：`headroom wrap cursor` 自动注入（推荐）

这是 Headroom 官方提供的一键包装命令。执行后，它会启动本地代理，并向项目的 `.cursorrules` 文件注入必要的 rtk 指令。

```bash
headroom wrap cursor
```

执行后：

1. Headroom 代理在本地启动（默认端口 8787）。
2. 向 `.cursorrules` 注入 rtk 指令（文件存在时）。
3. 终端打印 Cursor 的手动配置步骤。

**注意**：Cursor 与 CLI Agent 不同，它仍然需要你在 Cursor 的设置中手动将 OpenAI Base URL 指向 `http://localhost:8787/v1`。Headroom 无法完全自动修改 Cursor 的应用内设置[reference:1]。

## 方式二：`headroom learn` 自动写入 AGENTS.md

`headroom learn` 命令会挖掘失败的 Agent 会话，分析根因，并自动将修正规则写入 `AGENTS.md`、`CLAUDE.md` 等文件[reference:2]。

```bash
headroom learn --agent cursor
```

这会在你的 `AGENTS.md` 中自动生成类似以下的段落：

```markdown
## Headroom Learnings

- 不要在内联样式里使用 `!important`，会导致 Tailwind 优先级冲突。
- 修改 `src/config/` 下的文件前，先读取 `src/config/README.md`。
```

这种方式是**自动的**，你不需要手动编写规则，Headroom 会根据实际会话失败情况动态补充。

## 方式三：手动在 AGENTS.md 中声明

如果你希望更主动地声明 Headroom 的使用规范，可以在 `AGENTS.md` 的“通信风格”或“工具”章节中手动加入以下内容：

```markdown
## Headroom 上下文压缩

本项目使用 Headroom 压缩 Agent 上下文。Headroom 已在本地后台运行，
所有通过 Cursor 的请求会自动经过压缩层。

Agent 行为约束：

- 不要绕过 Headroom 代理直接调用 LLM API。
- 如遇压缩导致的信息缺失，可调用 `headroom_retrieve` MCP 工具还原原始内容。
- 详细配置见 [README.md](./README.md)。
```

Cursor 会自动读取项目根目录下的 `AGENTS.md`，并在每次会话启动时加载其中的规则。

## 方式四：通过 `.cursor/rules/` 规则文件实现

如果你希望规则有更高的优先级和更稳定的生效机制，可以在 `.cursor/rules/` 目录下创建一个专用的 `.mdc` 规则文件。Headroom 的 Cursor memory writer 也支持将记忆导出到 `.cursor/rules/*.mdc` 文件，并自动生成 `alwaysApply` 规则。

创建 `.cursor/rules/headroom.mdc`：

```markdown
---
description: 启用 Headroom 上下文压缩
alwaysApply: true
---

本项目使用 Headroom 压缩 Agent 上下文。
不要绕过 Headroom 代理直接调用 LLM API。
详细配置见 docs/headroom.md。
```

`alwaysApply: true` 会让 Cursor 在每次会话中自动加载此规则。

## 方式五：持久化后台运行（可选）

如果希望 Headroom 始终在后台运行，被所有支持的 Agent 复用：

```bash
headroom install apply --preset persistent-service --providers auto
```

Docker-native 持久化：

```bash
headroom install apply --preset persistent-docker
```

安装后，`headroom wrap` 会自动复用已运行的后台服务。

## 推荐组合

| 场景     | 推荐方式                                             |
| -------- | ---------------------------------------------------- |
| 快速启用 | `headroom wrap cursor` + 手动声明 AGENTS.md          |
| 自动学习 | `headroom learn --agent cursor` 定期运行             |
| 团队协作 | `.cursor/rules/headroom.mdc`（alwaysApply: true）    |
| 长期后台 | `headroom install apply --preset persistent-service` |

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
