# codebase-memory-mcp 自动启用配置

> 返回入口：[Codebase-memory-mcp 使用指南](./README.md)

codebase-memory-mcp 提供多种方式让它在 Cursor 中自动生效。

## 方式一：`codebase-memory-mcp install` 自动配置（推荐）

安装后运行以下命令，它会自动检测 Cursor 并完成 MCP 配置和技能安装：

```bash
codebase-memory-mcp install
```

该命令会：

1. 检测已安装的 Agent（Claude Code、Codex CLI、Cursor、Windsurf 等）。
2. 注册 MCP 服务器。
3. 安装 4 个任务专用技能（exploring、tracing、quality、reference）。
4. 对于 Cursor，自动配置 MCP 条目。

## 方式二：手动配置 `.cursor/mcp.json`

在项目 `.cursor/mcp.json` 中添加配置（见 [configuration.md](./configuration.md) 第 2.4 节），重启 Cursor 即可生效。

## 方式三：在 AGENTS.md 中声明

在 `AGENTS.md` 的“工具”章节中加入以下声明：

```markdown
## codebase-memory-mcp

本项目使用 codebase-memory-mcp 进行代码库索引和结构查询。  
MCP 服务器已配置，Agent 可通过以下工具查询代码图谱：

- `search_graph`：在图谱中搜索符号和关系
- `trace_call_path`：追踪调用链
- `get_architecture`：获取架构概览
- `detect_changes`：评估变更影响范围

Agent 行为约束：

- 优先使用图谱查询而非逐文件 grep。
- 索引会自动同步，无需手动触发。
- 详细配置见 [README.md](./README.md)。
```

## 方式四：`.cursor/rules/codebase-memory.mdc` 规则文件

创建 `.cursor/rules/codebase-memory.mdc`：

```markdown
---
description: 启用 codebase-memory-mcp 代码图谱查询
alwaysApply: true
---

本项目使用 codebase-memory-mcp 进行代码库结构查询。
优先使用图谱工具而非逐文件 grep。
详细配置见 docs/codebase-memory.md。
```

`alwaysApply: true` 会让 Cursor 在每次会话中自动加载此规则。

## 方式五：持久化后台运行（可选）

如果希望 codebase-memory-mcp 始终在后台运行，被所有支持的 Agent 复用：

```bash
codebase-memory-mcp install --preset persistent
```

安装后，Cursor 启动时会自动连接已运行的 MCP 服务器。

## 推荐组合

| 场景           | 推荐方式                                                 |
| -------------- | -------------------------------------------------------- |
| 快速启用       | `codebase-memory-mcp install`                            |
| 团队协作       | `.cursor/mcp.json` + `AGENTS.md` 声明                    |
| 规则优先级最高 | `.cursor/rules/codebase-memory.mdc`（alwaysApply: true） |
| 长期后台       | `codebase-memory-mcp install --preset persistent`        |

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
