# Headroom 使用

> 返回入口：[Headroom 使用指南](./README.md)
> 自动启用、AGENTS.md、规则文件见 [auto-enable.md](./auto-enable.md)。  
> 完整效果与 SDK 示例见 [examples.md](./examples.md)。

## 在 Cursor 中使用

Headroom 支持四种集成方式，可以单独使用，也可以混用。

### 方式一：Agent Wrap（最简，推荐）

一条命令启动代理并输出 Cursor 配置指引：

```bash
headroom wrap cursor
```

该命令会：

1. 在本地启动 Headroom 代理（默认端口 8787）。
2. 向 Cursor 的 `.cursorrules` 注入 rtk 指令（如果存在）。
3. 打印 Cursor 设置步骤。

按照输出提示，在 Cursor 中配置：

```text
Settings > Models > OpenAI API Key > Advanced > Override Base URL
```

将 Base URL 设置为：

```text
http://localhost:8787/v1
```

自定义端口：

```bash
headroom wrap cursor --port 9999
```

仅启动代理、不注入上下文工具指令：

```bash
headroom wrap cursor --no-context-tool
```

撤销 wrap：

```bash
headroom unwrap cursor
```

### 方式二：Proxy 模式（零代码改动）

```bash
headroom proxy --port 8787
```

验证代理运行状态：

```bash
curl http://localhost:8787/health
```

在 Cursor 中，将 OpenAI Base URL 覆盖为：

```text
http://localhost:8787/v1
```

查看节省统计：

```bash
curl http://localhost:8787/stats
```

Proxy 模式支持两种运行模式：

| 模式    | 命令                                  | 适用场景                   |
| ------- | ------------------------------------- | -------------------------- |
| `token` | `headroom proxy --mode token`         | 短/中会话，最大化压缩      |
| `cache` | `headroom proxy --mode cache`（默认） | 长会话，保留前缀缓存稳定性 |

### 方式三：MCP Server（无代理，按需调用）

Headroom 的 MCP Server 暴露三个工具，供 Cursor 按需调用：

| MCP 工具            | 用途                        |
| ------------------- | --------------------------- |
| `headroom_compress` | 压缩给定内容                |
| `headroom_retrieve` | 检索被压缩的原始内容（CCR） |
| `headroom_stats`    | 查看压缩统计                |

在 `~/.cursor/mcp.json` 或项目 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "headroom": {
      "command": "headroom",
      "args": ["mcp", "serve"]
    }
  }
}
```

前提是需要 headroom 配置全局路径，验证如下

```bash
#headroom --version
headroom, version 0.5.4
```

### 方式四：Python SDK（编程集成）

见 [examples.md](./examples.md) 中的完整 Python SDK 示例。

## 模式说明

Headroom 提供三种运行模式，可在 SDK 或代理中指定：

| 模式       | 说明                         | 适用场景                 |
| ---------- | ---------------------------- | ------------------------ |
| `audit`    | 仅记录指标，不修改请求       | 观察压缩效果，不做变更   |
| `optimize` | 应用压缩变换，减少 Token     | 日常使用（默认）         |
| `simulate` | 预览压缩效果，返回预估节省量 | 评估压缩收益，不实际执行 |

## 常用命令速查

```bash
headroom wrap cursor
headroom unwrap cursor
headroom proxy --port 8787
headroom proxy --mode token
headroom proxy --mode cache
headroom mcp serve
headroom learn --agent cursor
headroom install apply --preset persistent-service --providers auto
```

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
