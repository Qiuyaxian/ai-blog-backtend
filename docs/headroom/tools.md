# Headroom 核心概念与配套工具

> 返回入口：[Headroom 使用指南](./README.md)

## 什么是 Headroom

Headroom 不是聊天摘要器，而是一个**上下文工程中间件**。它拦截 Agent 发给 LLM 的请求，在本地完成压缩后再转发，原始内容缓存在本地，可按需检索还原。

## 核心能力

| 能力                | 说明                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| **多形态集成**      | Library（Python/TS）、Proxy、Agent Wrap、MCP Server                              |
| **多类型压缩**      | JSON（SmartCrusher）、代码（CodeCompressor，AST 感知）、文本（Kompress-v2-base） |
| **可逆压缩（CCR）** | 原始内容本地缓存，模型可按需检索，不丢失信息                                     |
| **跨 Agent 记忆**   | Claude、Codex、Cursor 等共享同一记忆存储，自动去重                               |
| **输出 Token 削减** | 同时压缩模型“写回”的内容，不只是你发送的内容                                     |
| **headroom learn**  | 挖掘失败会话，自动生成修正规则写入 `AGENTS.md` 等文件                            |

## 压缩流水线

```text
你的请求 → CacheAligner → ContentRouter → CCR
                           ├─ SmartCrusher（JSON）
                           ├─ CodeCompressor（AST）
                           └─ Kompress-v2-base（文本）
                → 压缩后的 prompt + 检索工具 → LLM
```

`ContentRouter` 检测内容类型并选择压缩器，`CacheAligner` 标记易变内容以保护缓存前缀稳定性。

## 与 Caveman 的配合

Caveman 压缩的是**模型输出**（写回给你的内容），Headroom 压缩的是**模型输入**（你发给模型的上下文）。两者互补，可以同时启用：

| 工具     | 压缩方向   | 效果                               |
| -------- | ---------- | ---------------------------------- |
| Caveman  | 输出 Token | 回复更短，减少 65% 输出 Token      |
| Headroom | 输入 Token | 上下文更小，减少 20–95% 输入 Token |

## 相关组件

| 组件             | 作用                                                            |
| ---------------- | --------------------------------------------------------------- |
| CacheAligner     | 标记易变内容，保护缓存前缀稳定性                                |
| ContentRouter    | 检测内容类型并选择压缩器                                        |
| SmartCrusher     | JSON 类内容压缩                                                 |
| CodeCompressor   | AST 感知代码压缩                                                |
| Kompress-v2-base | 文本压缩                                                        |
| CCR              | 可逆压缩，本地缓存原始内容，可按需检索                          |
| MCP Server       | 暴露 `headroom_compress`、`headroom_retrieve`、`headroom_stats` |
| Proxy            | 零代码改动的本地代理                                            |

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
