# codebase-memory-mcp 核心概念与工具

> 返回入口：[Codebase-memory-mcp 使用指南](./README.md)

## 1. 什么是 codebase-memory-mcp

codebase-memory-mcp 将代码库索引成一张**持久化知识图谱**，让 AI 编程助手不用再逐文件翻。

### 核心特性

| 特性               | 说明                                                            |
| ------------------ | --------------------------------------------------------------- |
| **持久化知识图谱** | 索引一次存入本地 SQLite，跨会话重启和上下文压缩后依然存在       |
| **亚毫秒级查询**   | 符号与关系查询响应达到亚毫秒级                                  |
| **Token 高效**     | 仅返回相关结构化切片，相较加载整文件降低约 99% 上下文成本       |
| **零运行时依赖**   | 单一静态二进制，无 Docker、无外部数据库、无 API Key             |
| **多语言支持**     | tree-sitter 驱动，覆盖 158 种语言                               |
| **广泛兼容**       | 适配 Claude Code、Codex、Cursor、Windsurf、Aider、Gemini CLI 等 |
| **内置图可视化**   | 可选 3D 交互式 UI，在 localhost:9749 探索代码关系               |

### 与其他方案的区别

| 维度       | grep         | RAG            | codebase-memory-mcp    |
| ---------- | ------------ | -------------- | ---------------------- |
| 数据形态   | 文本         | embedding 向量 | 代码事实图谱           |
| 抽象层     | 字符匹配     | 文本相似       | 结构/语义关系          |
| 适合       | 找 TODO 注释 | 模糊语义搜索   | 调用链、影响分析、重构 |
| Token 消耗 | 高           | 中             | 极低                   |

grep 和 RAG 都在“文本窗口里挑东西”，而 codebase-memory-mcp 做的是“把代码变成可以问关系的图”。

## 5. 可用工具

codebase-memory-mcp 暴露 14 个 MCP 工具，覆盖搜索、追踪、架构分析、影响评估等场景：

| 工具                 | 功能                                                            |
| -------------------- | --------------------------------------------------------------- |
| `search_graph`       | 在图谱中搜索符号、关系（支持 Cypher 风格查询）                  |
| `search_code`        | 搜索代码内容（大小写不敏感）                                    |
| `trace_call_path`    | 追踪调用链，可附加风险分类标签                                  |
| `get_architecture`   | 返回语言、包、入口点、路由、热点、边界、分层等架构概览          |
| `detect_changes`     | 将未提交的变更映射到受影响的图谱符号，并评估影响范围            |
| `manage_adr`         | 持久化架构决策记录（PURPOSE、STACK、ARCHITECTURE、PATTERNS 等） |
| `index_codebase`     | 索引或重新索引代码库                                            |
| `get_index_status`   | 查看索引状态和覆盖范围                                          |
| `find_dead_code`     | 检测无调用者的函数（排除入口点）                                |
| `execute_cypher`     | 对图谱执行 Cypher 风格查询                                      |
| `find_http_links`    | 发现跨服务 HTTP 调用与路由匹配                                  |
| `get_call_graph`     | 获取函数调用图                                                  |
| `get_file_structure` | 获取文件级结构信息                                              |
| `get_symbol_info`    | 获取符号详细信息                                                |

## 8. 与其他工具的配合

codebase-memory-mcp 与 Headroom、Caveman 可以同时使用：

| 工具                | 作用         | 压缩方向                   |
| ------------------- | ------------ | -------------------------- |
| codebase-memory-mcp | 代码结构查询 | 减少探索阶段的 Token 消耗  |
| Headroom            | 上下文压缩   | 压缩发送给模型的输入 Token |
| Caveman             | 输出压缩     | 减少模型写回的 Token       |

三者互补，分别从“减少探索”“减少输入”“减少输出”三个维度降低 Token 消耗。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
