# codebase-memory-mcp 在 Cursor 中使用

> 返回入口：[Codebase-memory-mcp 使用指南](./README.md)
> 自动启用、AGENTS.md、规则文件、持久化见 [auto-enable.md](./auto-enable.md)。

## 方式一：自动配置（推荐）

安装后运行以下命令，它会自动检测 Cursor 并完成 MCP 配置：

```bash
codebase-memory-mcp install
```

该命令会自动检测 Claude Code、Codex CLI、Cursor、Windsurf 等 Agent，注册 MCP 服务器并安装任务专用技能。

## 方式二：手动配置 MCP

在项目的 `.cursor/mcp.json` 中添加配置（见 [configuration.md](./configuration.md) 第 2.4 节），将 `/path/to/codebase-memory-mcp` 替换为实际二进制路径。

## 方式三：通过 Claude Code 安装（间接支持 Cursor）

在 Claude Code 中输入：

```text
Install this MCP server: https://github.com/DeusData/codebase-memory-mcp
```

安装后，Cursor 也可以通过 MCP 协议复用已配置的服务器。

## 验证配置

重启 Cursor 后，在 Agent 面板中输入 `/mcp`，应看到包含 14 个工具的 `codebase-memory-mcp`。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
