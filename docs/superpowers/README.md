# Superpowers 快速上手

> 这是一份导读入口。详细的安装选项、技能说明、自动启动配置与故障排查，请见 [Superpowers 使用指南](./usage.md)。
>
> Superpowers 是一套面向 AI 编程代理的软件开发方法论，核心理念是 **Process over Prompt（流程大于提示词）**——不给 AI 更多提示，而是给 AI 套上软件工程的纪律与护栏。

---

## AI 阅读指引

- 涉及 Superpowers 时，先读本文件。
- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 是什么

Superpowers 不是让 AI 更聪明，而是强制 AI 遵循经过验证的软件工程流程：需求调研 → 设计方案 → 编码 → Debug → 测试 → 评审 → 部署。它把整套流程提炼成 14 个可组合的「技能（Skill）」，在合适时机自动触发。

### 解决的核心问题

| 问题                   | 说明                                       |
| ---------------------- | ------------------------------------------ |
| **跳过设计直接写代码** | 拿到需求就生成代码，没经过澄清和方案设计   |
| **为了快而跳步骤**     | 不写测试，直接改一大堆代码，然后说“搞定了” |
| **为了自洽而编结果**   | 命令没跑、日志没看，就拍脑袋说通过了       |
| **代码质量参差不齐**   | 缺乏系统性测试与评审，bug 频发             |

---

## 前置条件

- 一个支持插件或 Skill 的 AI 编码代理（Cursor、Claude Code、Codex、Gemini CLI 等）
- **Node.js**（MCP 安装方式需要）
- 稳定的网络连接（访问插件市场）

---

## 安装

### Cursor（推荐）

打开 Cursor Agent 聊天界面（`Cmd+L` / `Ctrl+L`），执行：

```text
/plugin-add superpowers
```

### Claude Code

```bash
/plugin install superpowers@claude-plugins-official
```

### MCP 通用方案

支持 MCP 的客户端（Cursor、Windsurf、Gemini、Claude Desktop）可在 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "superpowers": {
      "command": "npx",
      "args": ["-y", "superpowers-mcp"]
    }
  }
}
```

> 各平台安装的详细步骤、源码构建方式、MCP 暴露的七个工具，见 [Superpowers 使用指南](./usage.md#安装)。

---

## 验证安装

开启新的 Agent 会话，输入：

```text
Do you have superpowers?
```

如果 Agent 确认安装并列出可用技能，说明安装成功。

---

## 核心技能（14 个）

按开发阶段分为六类，以下为常用技能速览：

| 阶段       | 技能                             | 触发时机         |
| ---------- | -------------------------------- | ---------------- |
| 规划与设计 | `brainstorming`                  | 写代码之前       |
| 规划与设计 | `writing-plans`                  | 多文件重构前     |
| 实现与调试 | `executing-plans`                | 计划就绪后       |
| 实现与调试 | `test-driven-development`        | 实现复杂功能时   |
| 实现与调试 | `systematic-debugging`           | 遇到错误或异常时 |
| 质量与评审 | `verification-before-completion` | 声称“修好了”之前 |
| 质量与评审 | `requesting-code-review`         | 提交代码前       |
| 质量与评审 | `receiving-code-review`          | 收到评审反馈后   |
| 质量与评审 | `finishing-a-development-branch` | 功能分支完成时   |
| 版本控制   | `using-git-worktrees`            | 设计批准后       |
| 入门       | `using-superpowers`              | 任何对话开始时   |

> 每个技能的详细说明、高级代理控制技能、支撑文件，见 [Superpowers 使用指南](./usage.md#核心技能)。

---

## 自动启动

Superpowers 的核心价值在于**自动触发**——你不需要记命令，它会在合适时机自动介入。

### 原理

Cursor 中通过 **SessionStart Hook** 实现。每次会话开始时，自动将 `using-superpowers` 技能注入 Agent 上下文，告诉 Agent：**先查技能，再行动**。

插件安装后 Hook 自动生效，无需额外配置。

### 验证自动启动

```text
Let's design a new feature for user profiles
```

如果 Agent 自动调用 `brainstorming` 或 `writing-plans`，说明自动启动已生效。

### 增强可靠性的方式

| 方式                        | 适用场景             |
| --------------------------- | -------------------- |
| Cursor 插件 + SessionStart  | 快速启用，安装即生效 |
| `AGENTS.md` 声明            | 强制 Agent 每次检查  |
| `npx superpowers-mcp setup` | 一键写入全局 MCP     |
| `.cursor/rules/` 规则文件   | 最高优先级，自动加载 |

> 各方式的完整配置示例与推荐组合，见 [Superpowers 使用指南](./usage.md#自动启动教程)。

---

## 常用工作流

### 新功能开发

```text
用户：Let's design a new feature for user profiles
       （自动加载 brainstorming）

用户：Now create an implementation plan
       （自动加载 writing-plans）

用户：Implement it with TDD
       （自动加载 test-driven-development）

用户：Verify everything works
       （自动加载 verification-before-completion）
```

### 紧急修复

```text
用户：Debug this error
       （自动加载 systematic-debugging）

用户：Write a failing test for the bug and fix it
       （自动加载 TDD 技能）

用户：Validate the fix
       （自动加载 verification-before-completion）
```

### 自然语言触发

直接用大白话描述需求即可，无需输入斜杠指令：

```text
用 Superpowers 帮我拆解一个待办小程序的开发任务
帮我用 Superpowers 排查代码报错
```

> 完整工作流与组合示例，见 [Superpowers 使用指南](./usage.md#常用工作流)。

---

## 更新与卸载

### 更新

```text
/plugin-update superpowers      # Cursor
/plugin update superpowers      # Claude Code
npm update superpowers-mcp      # MCP Server
```

### 卸载

```text
/plugin-remove superpowers
```

重启 Agent 会话使更改生效。

---

## 常见问题

| 问题                             | 快速处理                                                  |
| -------------------------------- | --------------------------------------------------------- |
| `/plugin-add` 执行失败           | 检查网络，更新 Cursor，重启 IDE                           |
| 技能未自动加载                   | 开新 Agent 会话，或显式请求 “use the brainstorming skill” |
| 命令无法识别                     | 确保在 Agent 聊天界面，而非 Composer                      |
| MCP 连接失败                     | 检查 `npx` / `node` 路径与 `mcp.json` 格式                |
| Windows 下 Visual companion 失败 | 使用 `--foreground` 模式运行服务器                        |

> 更多故障场景、Windsurf 适配、SessionStart Hook 排错，见 [Superpowers 使用指南](./usage.md#故障排查)。

---

## 参考

- [Superpowers GitHub 仓库](https://github.com/obra/superpowers)
- [官方文档](https://mintlify.wiki/obra/superpowers)
- [superpowers-mcp (npm)](https://www.npmjs.com/package/superpowers-mcp)
- [superpowers-mcp 仓库](https://github.com/erophames/superpowers-mcp)
- [Superpowers 中文版（社区）](https://github.com/dxc-danny/superpowers-cn)

---

> 本文档仅作导读。详细的安装选项、14 个技能完整说明、自动启动配置、与其他工具的配合方式、完整故障排查表，请统一查阅 [Superpowers 使用指南](./usage.md)。
