# Headroom 效果与示例

> 返回入口：[Headroom 使用指南](./README.md)

## 官方效果数据

- 编码 Agent 减少 20% Token
- JSON 类内容减少 60–95% Token
- 答案质量不变

## Python SDK 示例

```python
from headroom import HeadroomClient
from openai import OpenAI

client = HeadroomClient(
    original_client=OpenAI(),
    default_mode="optimize",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)

stats = client.get_stats()
print(f"Tokens saved: {stats['session']['tokens_saved_total']}")
```

## 与 Caveman 配合的效果

Caveman 压缩的是**模型输出**（写回给你的内容），Headroom 压缩的是**模型输入**（你发给模型的上下文）。两者互补，可以同时启用：

| 工具     | 压缩方向   | 效果                               |
| -------- | ---------- | ---------------------------------- |
| Caveman  | 输出 Token | 回复更短，减少 65% 输出 Token      |
| Headroom | 输入 Token | 上下文更小，减少 20–95% 输入 Token |

## 典型使用场景

- 编码 Agent：减少长文件、日志、工具输出占用。
- JSON / 日志：`SmartCrusher` 对 JSON 类内容压缩收益高。
- 长会话：使用 `cache` 模式保留前缀缓存稳定性。
- 需要可逆还原：使用 CCR / `headroom_retrieve` 按需检索原始内容。

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
