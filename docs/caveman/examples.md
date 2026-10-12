# 使用示例与效果对比

> 返回入口：[Caveman 使用指南](./README.md)

## 效果对比

| 模式    | 回答示例                                                                                                                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正常 AI | “The reason your React component is re-rendering is likely because you are creating a new object reference on each render cycle. When you pass an inline object as a prop, React shallow comparison sees it as a different object every time, which triggers a re-render. I would recommend using useMemo to memoize the object.” |
| Caveman | “New object ref each render. Inline object prop = new ref = re-render. Wrap in useMemo.”                                                                                                                                                                                                                                          |

> 同样的修复方案，Token 减少约 75%。

## 示例 1：修复 Bug

```text
用户：/caveman
用户：Why is my Lambda timing out when calling S3?
```

**Caveman 回复：**

```text
Lambda times out because VPC has no NAT route. S3 calls hang until 30s limit.
Fix: add S3 gateway endpoint on subnet route table.
```

## 示例 2：正常模式对比

**正常 AI 回复：**

> Sure! I'd be happy to help. The timeout you're seeing is likely caused by a networking issue somewhere in your VPC configuration, possibly related to how your Lambda reaches S3...

**Caveman 回复：**

> Lambda times out because its VPC has no NAT route. S3 calls hang until the 30s limit.
> **Cause:** function sits in a private subnet; boto3 retries silently until timeout.
> **Fix:** add an S3 gateway endpoint (free) on the subnet route table.

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
