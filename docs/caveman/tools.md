# 配套工具与 Headroom

> 返回入口：[Caveman 使用指南](./README.md)

## 配套工具

Caveman 生态还提供以下配套技能：

| 工具             | 命令                | 用途                                                |
| ---------------- | ------------------- | --------------------------------------------------- |
| caveman-commit   | `/caveman-commit`   | 生成简洁的 commit message，主题 ≤50 字符            |
| caveman-review   | `/caveman-review`   | 单行 PR 评论                                        |
| caveman-compress | `/caveman:compress` | 压缩 CLAUDE.md / memory 文件，节省约 46% 输入 Token |

## 与 Headroom 的配合

Caveman 压缩的是**模型输出**（写回给你的内容），Headroom 压缩的是**模型输入**（你发给模型的上下文）。两者互补，可以同时启用：

| 工具     | 压缩方向   | 效果                               |
| -------- | ---------- | ---------------------------------- |
| Caveman  | 输出 Token | 回复更短，减少 65% 输出 Token      |
| Headroom | 输入 Token | 上下文更小，减少 20–95% 输入 Token |

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
