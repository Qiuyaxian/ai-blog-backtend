# Headroom 故障排查

> 返回入口：[Headroom 使用指南](./README.md)

| 问题                              | 可能原因              | 解决方案                                                  |
| --------------------------------- | --------------------- | --------------------------------------------------------- |
| `headroom: command not found`     | PATH 未更新           | 运行 `uv tool update-shell`，或重新打开终端               |
| 代理启动失败                      | 端口被占用            | 换端口：`headroom proxy --port 9999`                      |
| Cursor 请求未经过压缩             | Base URL 未覆盖       | 检查 Cursor Settings > Models > Override Base URL         |
| `headroom wrap cursor` 未注入指令 | `.cursorrules` 不存在 | 手动在 `AGENTS.md` 中添加声明                             |
| MCP 工具不可用                    | Cursor 未加载 MCP     | 重启 Cursor，确认 `mcp.json` 格式正确                     |
| 压缩后答案质量下降                | 压缩过于激进          | 切换到 `cache` 模式，或使用 `audit` 模式观察              |
| 持久化服务未启动                  | 未执行 install apply  | 运行 `headroom install apply --preset persistent-service` |

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
