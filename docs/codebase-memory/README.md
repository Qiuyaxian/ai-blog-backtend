# codebase-memory-mcp 使用指南

> codebase-memory-mcp 是一个用 C 编写的高性能 MCP 服务器，将整个代码库索引为持久化的知识图谱。  
> 它通过 tree-sitter 解析 AST，抽取函数、类、调用链、HTTP 路由等代码事实，让 AI Agent 从图谱回答结构问题，而非逐文件 grep。  
> 项目实测：五个结构查询约消耗 3,400 Token，而逐文件探索约消耗 412,000 Token——减少 99.2%。  
> 本目录是 codebase-memory-mcp 文档入口，供团队成员和 AI 助手参考。

## AI 阅读指引

- 涉及 codebase-memory-mcp 时，先读本文件。
- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 按需阅读

| 当任务涉及                                               | 读取文件                                   |
| -------------------------------------------------------- | ------------------------------------------ |
| 安装、部署、依赖、验证                                   | [installation.md](./installation.md)       |
| 索引存储位置、CBM_CACHE_DIR、跨平台配置、Cursor mcp.json | [configuration.md](./configuration.md)     |
| Cursor 集成、MCP 配置、自动配置、验证                    | [usage.md](./usage.md)                     |
| 自动启用、always-on、AGENTS.md、规则文件、持久化         | [auto-enable.md](./auto-enable.md)         |
| 使用示例、索引代码库、查询调用链、影响分析               | [examples.md](./examples.md)               |
| 核心特性、与 grep/RAG 区别、可用工具、与其他工具配合     | [tools.md](./tools.md)                     |
| 注意事项、限制                                           | [notes.md](./notes.md)                     |
| 报错、排错、FAQ                                          | [troubleshooting.md](./troubleshooting.md) |
| 外部链接                                                 | [reference.md](./reference.md)             |

## 一句话理解

codebase-memory-mcp 将代码库索引成一张**持久化知识图谱**，让 AI 编程助手不用再逐文件翻。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
