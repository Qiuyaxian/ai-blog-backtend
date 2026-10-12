# Caveman 使用指南

> Caveman 是一个让 AI 编程助手用“穴居人风格”回答的插件。  
> 它通过删除冠词、填充词、客套话，在保持技术准确性的同时，**平均减少 65% 的输出 Token**。  
> 本目录是 Caveman 文档入口，供团队成员和 AI 助手参考。

## AI 阅读指引

- 涉及 Caveman 时，先读本文件。
- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 按需阅读

| 当任务涉及                               | 读取文件                                   |
| ---------------------------------------- | ------------------------------------------ |
| 安装、部署、依赖、验证                   | [installation.md](./installation.md)       |
| 命令、强度级别、自动清晰机制             | [usage.md](./usage.md)                     |
| 自动启用、always-on、规则文件、AGENTS.md | [auto-enable.md](./auto-enable.md)         |
| 效果对比、使用示例                       | [examples.md](./examples.md)               |
| 配套工具、Headroom                       | [tools.md](./tools.md)                     |
| 注意事项、限制                           | [notes.md](./notes.md)                     |
| 报错、排错、FAQ                          | [troubleshooting.md](./troubleshooting.md) |
| 外部链接                                 | [reference.md](./reference.md)             |

## 快速开始

### 安装（一行命令）

**macOS / Linux / WSL / Git Bash：**

```bash
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash
```

**Windows（PowerShell 5.1+）：**

```powershell
irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex
```

### 仅安装到 Cursor

```bash
npx skills add JuliusBrussee/caveman -a cursor
```

### 验证

在 Cursor 聊天面板输入：

```text
/caveman
```

如果 Caveman 已正确安装，AI 回复风格会切换为压缩模式。

## 核心逻辑

> why use many token when few token do trick  
> Brain still big. Mouth small.

Caveman 支持 Claude Code、Cursor、Codex、Gemini、Windsurf、Cline、Copilot 等 30 多个 AI 编码代理。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
