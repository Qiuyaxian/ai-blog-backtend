# codebase-memory-mcp 使用示例

> 返回入口：[Codebase-memory-mcp 使用指南](./README.md)

## 示例 1：索引代码库

在 Cursor Agent 面板中输入：

```text
Index this project
```

codebase-memory-mcp 会自动索引当前项目，生成知识图谱。

## 示例 2：查询调用链

```text
Trace the call path of createOrder
```

返回 `createOrder` 的完整调用链，包括调用者和被调用者。

## 示例 3：评估变更影响

```text
What will be affected if I modify the auth middleware?
```

返回受影响的图谱符号、影响范围（blast radius）和风险分类（CRITICAL/HIGH/MEDIUM/LOW）。

## 示例 4：架构概览

```text
Give me an architecture overview of this project
```

返回语言、包、入口点、路由、热点、分层等架构信息。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
