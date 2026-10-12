# Headroom 使用指南

> Headroom 是一个本地运行的上下文压缩层，位于 AI Agent 和 LLM Provider 之间。  
> 它在你机器上压缩工具输出、日志、文件、RAG 片段和会话历史，再发送给模型。  
> 官方数据：编码 Agent 减少 20% Token，JSON 类内容减少 60–95% Token，答案质量不变。  
> 本目录是 Headroom 文档入口，供团队成员和 AI 助手参考。

## AI 阅读指引

- 涉及 Headroom 时，先读本文件。
- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 按需阅读

| 当任务涉及                               | 读取文件                                   |
| ---------------------------------------- | ------------------------------------------ |
| 安装、部署、依赖、验证                   | [installation.md](./installation.md)       |
| 命令、集成方式、运行模式                 | [usage.md](./usage.md)                     |
| 自动启用、always-on、规则文件、AGENTS.md | [auto-enable.md](./auto-enable.md)         |
| 效果对比、使用示例                       | [examples.md](./examples.md)               |
| 核心概念、压缩流水线、配套工具、Caveman  | [tools.md](./tools.md)                     |
| 注意事项、限制                           | [notes.md](./notes.md)                     |
| 报错、排错、FAQ                          | [troubleshooting.md](./troubleshooting.md) |
| 外部链接                                 | [reference.md](./reference.md)             |

## 一句话理解

Headroom 不是聊天摘要器，而是一个**上下文工程中间件**。它拦截 Agent 发给 LLM 的请求，在本地完成压缩后再转发，原始内容缓存在本地，可按需检索还原。

## 注意

只有安装了 headroom memory 才能起到优化输出效果（headroom memory 会从中提取关键事实并持久化存储）

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
