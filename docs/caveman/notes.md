# 注意事项

> 返回入口：[Caveman 使用指南](./README.md)

## 注意事项

- **只压缩输出 Token**：Caveman 减少的是模型写回给你的 Token，不影响你发送的输入 Token。如需节省输入 Token，使用 `caveman-compress` 压缩记忆文件。
- **技术准确性不压缩**：代码块、文件路径、URL、版本号、错误信息、警告和注意事项均原样保留。
- **默认按会话激活**：Cursor 中每次新会话需要输入 `/caveman`。如需始终开启，使用 `--with-init` 或 `/caveman:init`。
- **可随时关闭**：输入 `stop caveman` 即可恢复正常模式。
- **规则冲突**：如果 `.cursor/rules/` 下已有其他规则文件，注意不要让通信风格规则互相覆盖。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
