# 故障排查

> 返回入口：[Ponytail 使用指南](./README.md)

## 常见问题

### 安装时两条命令写在同一 prompt 里失败

`/plugin install` 需要市场注册先完成才能解析来源。分两次发送。

### 安装后 `/ponytail` 命令无效

1. 确认 Node.js 在 PATH 中
2. 运行 `/ponytail-help` 检查钩子是否生效
3. Codex 用户需进 `/hooks` 把钩子设为信任

### Cursor / Windsurf / Cline 中效果弱

这些工具没有插件机制，走纯指令模式，少了会话级强制注入。把规则文件复制进项目规则目录或并入 `AGENTS.md`，七级阶梯照样起作用。

### Ponytail 是否会导致模型变差

不会。12 个边缘案例陷阱测试中，Ponytail 保持基线水平——不会比无约束模型产生更多错误答案。

### Ponytail 与 Caveman 的区别

Ponytail 管你**写什么代码**，Caveman 管你**怎么说话**。两者互补，可以同时使用。

### 什么时候 Ponytail 收益最大

存在“过度构建陷阱”时收益最大（如日期选择器、颜色选择器）。代码本身已经很精简时，收益接近零。

## 安全边界

Ponytail 的“懒”不是粗心。以下内容不能省略：

- 信任边界校验
- 数据丢失处理
- 安全
- 可访问性

## Agent 适配

| Agent                               | 安装方式                | 效果                                   |
| ----------------------------------- | ----------------------- | -------------------------------------- |
| Claude Code                         | 插件市场                | 完整：会话激活、模式追踪、命令、状态栏 |
| Codex                               | 插件市场 + 信任钩子     | 完整                                   |
| Kimi Code CLI                       | `/plugins install`      | 完整                                   |
| Devin                               | `devin plugins install` | 完整                                   |
| OpenCode                            | `opencode.json`         | 完整                                   |
| Cursor / Windsurf / Cline / Copilot | 手动规则文件            | 七级阶梯生效，无会话级强制注入         |

## 提交 Issue

如果问题不在上述列表中，请到 [GitHub Issues](https://github.com/DietrichGebert/ponytail/issues) 提交。

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
