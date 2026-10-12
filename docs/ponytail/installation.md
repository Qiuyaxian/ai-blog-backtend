# 安装

> 返回入口：[Ponytail 使用指南](./README.md)

## 前置条件

- **Node.js** 必须在 PATH 中（Claude Code、Codex 插件以及 Cursor hooks 依赖两个小型 Node.js 生命周期钩子）
- Nix/nvm 用户注意：`node` 必须在**非交互式 shell 的 PATH** 中。如果不在，Skill 仍能工作，但 always-on 激活会静默失效，而不会在每个 prompt 上报错
- 一个支持插件或 Skill 的 AI 编码 Agent

## Claude Code

在 Claude Code 中执行两条 `/plugin` 命令，**必须分两次发送**：

```text
/plugin marketplace add DietrichGebert/ponytail
```

等待第一条执行完成后，新起一轮再发送：

```text
/plugin install ponytail@ponytail
```

两条命令写在同一个 prompt 里会失败——`/plugin install` 需要市场注册先完成才能解析 `ponytail@ponytail` 这个来源。

**Claude Code Desktop App：** 在 Code 标签页的 prompt 框中输入上述两条命令，或点击 **+** 按钮 → **Plugins** → **Add plugin** 浏览已配置的市场。市场管理在侧边栏的 **Customize** 中。

安装后文件位于：

```text
~/.claude/plugins/cache/ponytail/
```

## Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

安装后运行 `codex`，打开 `/hooks`，审核并信任两个生命周期钩子，然后开一个新线程。

**Codex Desktop App：** 安装后重启应用即可自动加载插件。

## GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

在交互式 Copilot CLI 会话中，使用斜杠命令等价形式：

```text
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI 会按插件名命名空间化命令，例如：

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

## Pi agent harness

```bash
pi install git:github.com/DietrichGebert/ponytail
```

## OpenCode

在 `opencode.json` 中添加：

```json
{
  "plugin": ["@dietrichgebert/ponytail"]
}
```

也可以从 checkout 安装（插件复用 `hooks/` 和 `skills/`）：

```json
{
  "plugin": ["./.opencode/plugins/ponytail.mjs"]
}
```

`./` 路径相对于项目的 `opencode.json` 解析。如果要跨项目共享同一个 checkout，将其指向 `.mjs` 的绝对路径（插件会相对于自身查找 `hooks/` 和 `skills/`）。

## Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

将规则集加载为每次会话的 always-on 上下文，并注册 `/ponytail` 命令。`skills/` 也会一并安装，在任务需要时激活。

## Antigravity

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

复用仓库的 `gemini-extension.json`。Antigravity 将 `/ponytail` 命令转换为 skills，在聊天中输入即可（如 `/ponytail-review`）。

截至 2026 年 6 月 18 日左右，`gemini extensions install` 仍然可用。若要作为 always-on 规则运行，将规则集放入 `.agents/rules/`。

## Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

安装后重启 Hermes。插件在每次 LLM 调用前注入当前 Ponytail 模式。

## Kimi Code CLI

在 Kimi Code CLI 中执行：

```text
/plugins install https://github.com/loneyclown/ponytail-kimi
/reload
```

首次安装第三方插件会出现信任确认提示，选择信任后完成安装。也可以从本地目录或 zip URL 安装[reference:11]。

## Cursor

Cursor 使用原生 hooks 方式：

```bash
git clone https://github.com/DietrichGebert/ponytail
node ponytail/scripts/cursor-hooks.js install
```

这会将两个原生钩子合并到 `~/.cursor/hooks.json`（添加 `--project` 则写入 `<project>/.cursor/hooks.json`），并保留你已有的钩子。

Cursor 在保存时重新加载文件；打开新聊天，默认级别的规则集通过 `sessionStart` 到达。发送 `/ponytail lite`、`/ponytail full`、`/ponytail ultra` 或 `/ponytail off` 作为普通消息，可在当前对话中切换级别。

**注意：** Cursor 的 `subagentStart` 无法注入上下文，因此子 Agent 运行时不带规则集；cloud agents 从不触发 `sessionStart`。`.cursor/rules/ponytail.mdc` 和 hooks 是互斥的：当工作区中存在该规则文件时，hooks 不注入任何内容。

卸载：

```bash
node ponytail/scripts/cursor-hooks.js uninstall
```

## Grok Build

```bash
grok plugin install DietrichGebert/ponytail --trust
```

安装后启用[reference:15]。

## Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

## OpenClaw

```bash
clawhub install ponytail
```

## 通用 Skill 方式

适用于任何支持 Skill 的 Agent：

```bash
npx skills add https://github.com/DietrichGebert/ponytail --skill ponytail
```

需要 `npx`（随 Node.js 一起安装）[reference:16]。

也可以让 Agent 自己安装——直接对 Claude Code 或 Codex 说“install the ponytail skill”，它会从聊天中获取并写入[reference:17]。

## 手动规则文件（无插件机制的工具）

Cursor（rule-only 替代方案）、Windsurf、Cline、GitHub Copilot Chat（VS Code / JetBrains / Visual Studio 编辑器扩展）、Aider、Kiro 等工具没有插件机制，走纯指令模式：将仓库中对应的规则文件复制进项目规则目录，或直接并入 `AGENTS.md`。

相关规则文件路径：

| 工具           | 规则文件路径                      |
| -------------- | --------------------------------- |
| Cursor         | `.cursor/rules/ponytail.mdc`      |
| Windsurf       | `.windsurf/rules/ponytail.md`     |
| Cline          | `.clinerules/ponytail.md`         |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Qoder          | `.qoder/rules/ponytail.md`        |

缺少会话级强制注入，效果弱一些，但七级阶梯照样起作用。

## 验证安装

```text
/ponytail-help
```

能列出六个命令即安装成功。

## 支持的 Agent 平台总览

| Agent                                          | 安装方式                      | 效果                                        |
| ---------------------------------------------- | ----------------------------- | ------------------------------------------- |
| Claude Code                                    | 插件市场（两条命令）          | 完整：会话激活、模式追踪、命令、状态栏      |
| Codex                                          | 插件市场 + 信任钩子           | 完整                                        |
| GitHub Copilot CLI                             | 插件市场                      | 完整，命令命名空间为 `/ponytail:ponytail-*` |
| Pi                                             | `pi install git:`             | 完整                                        |
| OpenCode                                       | `opencode.json` 插件          | 完整                                        |
| Gemini CLI                                     | `gemini extensions install`   | always-on 规则 + 命令                       |
| Antigravity                                    | `agy plugin install`          | 命令转为 skills                             |
| Hermes Agent                                   | `hermes plugins install`      | 每次 LLM 调用前注入                         |
| Kimi Code CLI                                  | `/plugins install`            | 完整                                        |
| Cursor                                         | 原生 hooks                    | 会话激活 + 级别切换，无子 Agent 注入        |
| Grok Build                                     | `grok plugin install --trust` | 显式或自动激活                              |
| Devin CLI                                      | `devin plugins install`       | 完整                                        |
| OpenClaw                                       | `clawhub install`             | 完整                                        |
| Windsurf / Cline / Copilot Chat / Aider / Kiro | 手动规则文件                  | 七级阶梯生效，无会话级强制注入              |

## 卸载

| Agent                                     | 命令                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Claude Code                               | `/plugin uninstall ponytail@ponytail`                                     |
| Codex                                     | `codex plugin remove ponytail`                                            |
| Devin CLI                                 | `devin plugins remove ponytail`                                           |
| Grok Build                                | `grok plugin uninstall ponytail`                                          |
| Pi                                        | `pi uninstall ponytail`                                                   |
| Cursor hooks                              | `node scripts/cursor-hooks.js uninstall`（加 `--project` 用于项目级安装） |
| Cursor rule / Windsurf / Cline / Qoder 等 | 删除复制的规则文件                                                        |

这些命令移除插件自身的文件。若要清理模式标志（`~/.claude/.ponytail-active` 或 `~/.cursor/.ponytail-active`）、`~/.config/ponytail/config.json`、`~/.cursor/hooks.json` 中 ponytail 的条目，以及 `~/.claude/settings.json` 中的 `statusLine` 条目，运行：

```bash
node scripts/uninstall.js
```

## 故障排查

### 安装后 `/ponytail` 命令无效

1. 确认 Node.js 在 PATH 中（Nix/nvm 用户需确认在非交互式 shell 中也可用）
2. 运行 `/ponytail-help` 检查钩子是否生效
3. Codex 用户需进 `/hooks` 将钩子设为信任

### 两条命令写在同一 prompt 里失败

`/plugin install` 需要市场注册先完成才能解析来源。分两次发送。

### Cursor 中效果弱

Cursor 的 `subagentStart` 不注入上下文，子 Agent 不带规则集；cloud agents 不触发 `sessionStart`。这是平台限制，非配置错误。

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
