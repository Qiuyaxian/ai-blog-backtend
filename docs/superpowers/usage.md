# Superpowers 使用指南

> Superpowers 是一套面向 AI 编程代理的完整软件开发方法论，由 Jesse Vincent（obra）维护。  
> 它建立在 14 个可组合的「技能（Skill）」和一组初始指令之上，确保 AI 代理在合适时机自动调用它们。  
> 核心理念是 **Process over Prompt（流程大于提示词）** ——不给 AI 更多提示，而是给 AI 套上软件工程的纪律与护栏。  
> 本文件是安装与使用指南，供团队成员和 AI 助手参考。

---

## 1. 什么是 Superpowers

Superpowers 不是让 AI 变得更聪明，而是强制 AI 遵循经过验证的软件工程方法论。它把从需求调研 → 设计方案 → 代码编写 → Debug → 代码测试 → 代码评审 → 生产部署的完整流程，提炼成 AI 可以使用的技能。

### 解决的核心问题

| 问题                   | 说明                                                  |
| ---------------------- | ----------------------------------------------------- |
| **跳过设计直接写代码** | AI 拿到需求就开始生成代码，没有经过需求澄清和方案设计 |
| **为了快而跳步骤**     | 不写测试，直接改一大堆代码，然后说“搞定了”            |
| **为了自洽而编结果**   | 命令没跑、日志没看，就拍脑袋说通过了                  |
| **代码质量参差不齐**   | 缺乏系统性的测试和评审，bug 频发                      |

Superpowers 用一套“流程护栏”把上述偷懒路径堵住，让 AI 回到成熟团队里那套可靠的交付方式。

### 项目规模

截至 2026 年 5 月，Superpowers 已积累 204K GitHub Stars、18.2K Forks，在 Anthropic 官方插件市场的安装量超过 68 万次，是 Claude Code 生态里增长最快的插件。

---

## 2. 核心技能（14 个 Skill）

Superpowers 由 14 个技能组成，按软件开发阶段分为六类。

### 2.1 规划与设计

| 技能            | 触发时机               | 核心功能                                                       |
| --------------- | ---------------------- | -------------------------------------------------------------- |
| `brainstorming` | 写代码之前             | 通过 Socratic 对话完成需求澄清和设计文档，防止 AI 直接跳入编码 |
| `writing-plans` | 多文件重构或复杂迁移前 | 将规格拆解为可执行的实施步骤，建立清晰的执行蓝图               |

### 2.2 实现与调试

| 技能                      | 触发时机             | 核心功能                                                               |
| ------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `executing-plans`         | 计划就绪后           | 按计划逐步执行实现                                                     |
| `test-driven-development` | 实现逻辑复杂的功能时 | 强制红-绿-重构循环：先写测试 → 让测试失败 → 实现功能 → 测试通过 → 重构 |
| `systematic-debugging`    | 遇到错误或异常行为时 | 强制根因分析，而非猜测式调试                                           |

### 2.3 质量与评审

| 技能                             | 触发时机         | 核心功能                                       |
| -------------------------------- | ---------------- | ---------------------------------------------- |
| `verification-before-completion` | 声称“修好了”之前 | 基于证据的完成确认，确保测试通过、命令执行成功 |
| `requesting-code-review`         | 提交代码前       | 发起代码评审预检查                             |
| `receiving-code-review`          | 收到评审反馈后   | 系统化处理评审意见                             |
| `finishing-a-development-branch` | 功能分支完成时   | 最终化并合并功能分支                           |

### 2.4 版本控制

| 技能                  | 触发时机   | 核心功能                            |
| --------------------- | ---------- | ----------------------------------- |
| `using-git-worktrees` | 设计批准后 | 使用 Git Worktrees 管理多个并行分支 |

### 2.5 高级代理控制

这些技能用于在支持的 IDE 中编排复杂的元执行模式。

### 2.6 入门技能

| 技能                | 触发时机       | 核心功能                                 |
| ------------------- | -------------- | ---------------------------------------- |
| `using-superpowers` | 任何对话开始时 | 技能系统入门，告诉 AI 如何发现和使用技能 |

---

## 3. 安装

Superpowers 支持 Claude Code、Cursor、Codex、Gemini CLI、OpenCode、Windsurf 等主流 AI 编码工具。

### 3.1 Cursor 安装（推荐）

Cursor 通过内置插件市场提供最简化的安装体验。

**前置条件：**

- Cursor IDE 已安装并运行
- 网络连接可访问插件市场

**安装步骤：**

1. 打开 Cursor Agent 聊天界面（快捷键 `Cmd+L` / `Ctrl+L`，或点击侧边栏 Agent 图标）
2. 在 Agent 聊天中执行插件安装命令：

```text
/plugin-add superpowers
```

3. Cursor 会自动下载并激活插件
4. 开启新的 Agent 会话，验证安装：

```text
Do you have superpowers?
```

如果 Agent 确认安装并列出可用技能，说明安装成功。

### 3.2 Claude Code 安装

在 Claude Code 终端中执行：

```bash
# 方式1：官方市场安装（推荐）
/plugin install superpowers@claude-plugins-official

# 方式2：社区市场安装
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

安装完成后，输入 `/reload` 让技能生效。验证安装：

```bash
/find-skills
/superpowers:brainstorm
```

### 3.3 MCP Server 安装（通用方案）

如果使用支持 MCP 的客户端（Cursor、Windsurf、Gemini、Claude Desktop 等），可以通过 MCP Server 接入 Superpowers。

**方式一：npx（推荐）**

在 `.cursor/mcp.json` 中添加：

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

**方式二：从源码构建**

```bash
git clone https://github.com/erophames/superpowers-mcp.git
cd superpowers-mcp
npm install
npm run build
```

然后在 MCP 配置中添加：

```json
{
  "mcpServers": {
    "superpowers": {
      "command": "node",
      "args": ["/absolute/path/to/superpowers-mcp/build/index.js"]
    }
  }
}
```

MCP Server 暴露以下工具：

| 工具                     | 功能                                       |
| ------------------------ | ------------------------------------------ |
| `list_skills`            | 列出所有可用技能                           |
| `use_skill`              | 按名称加载技能，返回完整内容作为指令       |
| `get_skill_file`         | 加载技能的支撑文件（参考文档、模板、脚本） |
| `recommend_skills`       | 基于语义排序 + 工作流策略推荐技能          |
| `compose_workflow`       | 为目标构建有序的多技能工作流               |
| `validate_workflow`      | 验证所选技能是否符合工作流护栏             |
| `semantic_search_skills` | 跨 SKILL.md 和支撑文件进行语义搜索         |

---

## 4. 自动启动教程

Superpowers 的核心价值在于**自动触发**——你不需要记命令，它会在合适的时机自动介入。以下介绍三种让 Superpowers 在 Cursor 中自动生效的方式。

### 4.1 自动启动原理：SessionStart Hook

Superpowers 在 Cursor 中通过 **SessionStart Hook** 实现自动启动。该 Hook 在每次会话开始时运行，自动将 `using-superpowers` 技能的内容注入到 Agent 的上下文中。[reference:0]

`using-superpowers` 技能的作用是告诉 Agent：

- **先查技能，再行动**：在处理任务前，先检查是否有适用的 Superpowers 技能。
- **技能自动触发**：当 Agent 决定写代码时，会先检查是否应该先使用 `brainstorming` 技能。[reference:1]

Hook 的输出包含 `additional_context` 字段，用于 Cursor Hook 兼容性。[reference:2]

**安装插件后，SessionStart Hook 自动生效**，无需额外配置。

### 4.2 方式一：Cursor 插件（推荐，自动生效）

使用 Cursor 插件市场安装后，SessionStart Hook 会自动注入 `using-superpowers` 技能，Agent 在每次会话开始时都会自动加载技能系统。[reference:4]

**验证自动启动是否生效：**

```text
Let's design a new feature for user profiles
```

如果 Agent 自动调用 `brainstorming` 或 `writing-plans` 技能，说明自动启动已生效。[reference:5]

**如果自动启动未生效：**

开启新的 Agent 会话（`Cmd+L` / `Ctrl+L`），或显式请求技能：`use the brainstorming skill`。[reference:6]

### 4.3 方式二：AGENTS.md 声明（增强自动触发）

如果希望更可靠地强制 Agent 在每个会话中检查技能，可以在 `AGENTS.md` 中添加声明。社区经验表明，添加自定义规则可以强制模型在每次聊天中始终应用 Superpowers 技能，不受模型差异影响。[reference:7]

在 `AGENTS.md` 的“工具”或“工作流”章节中加入以下声明：

```markdown
## Superpowers

本项目使用 Superpowers 工作流框架，强制 AI 代理遵循软件工程纪律。

**自动启动规则：**

- 每次响应前，检查是否有适用的 Superpowers 技能，即使只有 1% 的可能性。
- 可用技能位于 `.cursor/skills/superpowers/` 目录下。
- 在响应前，读取相关技能文件以了解可用的工作流程。

**Agent 行为约束：**

- 写代码前必须先执行 brainstorming 技能，完成需求澄清。
- 实现功能时必须遵循 test-driven-development 技能（红-绿-重构）。
- 声称任务完成前必须执行 verification-before-completion 技能。
- 遇到错误时必须使用 systematic-debugging 技能进行根因分析。

详细配置见 [docs/superpowers.md](docs/superpowers.md)。
```

### 4.4 方式三：MCP 一键配置（自动写入全局配置）

`superpowers-mcp` 提供一键配置命令，自动将 Superpowers MCP 服务器写入 Cursor 的全局配置文件中，无需手动编辑 `mcp.json`。[reference:8][reference:9]

```bash
npx -y superpowers-mcp setup --target cursor
```

该命令会：

1. 自动检测 Cursor 配置位置（`~/.cursor/mcp.json`）。
2. 将 Superpowers MCP 服务器写入配置文件。
3. 使用原子写交换，不影响已有的 MCP 服务器配置。[reference:10]

**适用平台：** macOS / Windows / Linux。[reference:11]

配置完成后，重启 Cursor 即可生效。

### 4.5 方式四：`.cursor/rules/` 规则文件（最高优先级）

创建 `.cursor/rules/superpowers.mdc`，使用 `alwaysApply: true` 让规则在每次对话中自动加载。[reference:12]

```markdown
---
description: 启用 Superpowers 工作流
alwaysApply: true
---

本项目使用 Superpowers 工作流框架。
每次响应前，检查是否有适用的 Superpowers 技能。
写代码前先 brainstorming，实现时用 TDD，完成前必须 verification。
详细配置见 docs/superpowers.md。
```

### 4.6 推荐组合

| 场景                 | 推荐方式                                    | 说明                    |
| -------------------- | ------------------------------------------- | ----------------------- |
| 快速启用             | Cursor 插件 + SessionStart Hook             | 安装即自动生效          |
| 增强可靠性           | AGENTS.md 声明                              | 强制 Agent 每次检查技能 |
| 一键配置             | `npx superpowers-mcp setup --target cursor` | 自动写入全局 MCP 配置   |
| 规则优先级最高       | `.cursor/rules/superpowers.mdc`             | alwaysApply 自动加载    |
| 全局安装（所有项目） | `npx @zasuo/agentic-superpowers`            | 自动生成 AGENTS.md 引导 |

---

## 5. 完整接入流程

### 5.1 步骤概览

```text
步骤 1：安装 Superpowers 插件
        → 在 Cursor Agent 中执行 /plugin-add superpowers

步骤 2：验证安装
        → 开启新会话，询问 "Do you have superpowers?"
        → Agent 应确认并列出可用技能

步骤 3：测试自动技能激活
        → 输入 "Let's design a new feature for user profiles"
        → Agent 应自动调用 brainstorming 或 writing-plans 技能

步骤 4：增强自动触发（可选）
        → 在 AGENTS.md 中添加 Superpowers 声明
        → 或创建 .cursor/rules/superpowers.mdc（alwaysApply: true）

步骤 5：配置 MCP Server（可选）
        → npx -y superpowers-mcp setup --target cursor
```

### 5.2 在 AGENTS.md 中声明（完整版）

```markdown
## Superpowers

本项目使用 Superpowers 工作流框架，强制 AI 代理遵循软件工程纪律。

**自动启动规则：**

- 每次响应前，检查是否有适用的 Superpowers 技能。
- 可用技能位于 `.cursor/skills/superpowers/` 目录下。
- 在响应前，读取相关技能文件以了解可用的工作流程。

**Agent 行为约束：**

- 写代码前必须先执行 brainstorming 技能，完成需求澄清。
- 实现功能时必须遵循 test-driven-development 技能（红-绿-重构）。
- 声称任务完成前必须执行 verification-before-completion 技能。
- 遇到错误时必须使用 systematic-debugging 技能进行根因分析。

详细配置见 [docs/superpowers.md](docs/superpowers.md)。
```

### 5.3 完整 MCP 配置示例（`.cursor/mcp.json`）

```json
{
  "mcpServers": {
    "superpowers": {
      "command": "npx",
      "args": ["-y", "superpowers-mcp"]
    },
    "codebase-memory-mcp": {
      "command": "codebase-memory-mcp",
      "args": [],
      "env": {
        "CBM_CACHE_DIR": ".codebase-memory"
      }
    },
    "headroom": {
      "command": "headroom",
      "args": ["mcp", "serve"]
    }
  }
}
```

---

## 6. 常用工作流

### 6.1 新功能开发

```text
用户：Let's design a new feature for user profiles
（Agent 自动加载 brainstorming 技能，引导需求澄清和方案设计）

用户：Now create an implementation plan
（Agent 自动加载 writing-plans 技能，生成分步实施计划）

用户：Implement it with TDD
（Agent 自动加载 test-driven-development 技能，先写测试再实现）

用户：Verify everything works
（Agent 自动加载 verification-before-completion 技能，运行测试套件）
```

### 6.2 紧急修复

```text
用户：Debug this error
（Agent 自动加载 systematic-debugging 技能，进行根因分析）

用户：Write a failing test for the bug and fix it
（Agent 自动加载 TDD 技能，先写失败测试再修复）

用户：Validate the fix
（Agent 自动加载 verification-before-completion 技能）
```

### 6.3 自然语言触发

直接用大白话描述需求即可，无需输入斜杠指令：

```text
用 Superpowers 帮我拆解一个待办小程序的开发任务
帮我用 Superpowers 排查代码报错
```

---

## 7. 更新与维护

### Cursor 中更新

```text
/plugin-update superpowers
```

Cursor 可能会提示重启 Agent 以使更新生效。[reference:14]

### Claude Code 中更新

```bash
/plugin update superpowers
```

### MCP Server 更新

```bash
npm update superpowers-mcp
```

### 手动更新（从源码安装时）

```bash
cd ~/.config/opencode/superpowers
git pull
```

---

## 8. 与其他工具的配合

Superpowers 与 Headroom、Caveman、codebase-memory-mcp 可以同时使用：

| 工具                    | 作用                     | 与 Superpowers 的关系                          |
| ----------------------- | ------------------------ | ---------------------------------------------- |
| **Superpowers**         | 提供开发工作流和工程纪律 | 定义“做什么、按什么顺序做”                     |
| **codebase-memory-mcp** | 代码结构查询             | 为 brainstorming 和 debugging 提供代码图谱信息 |
| **Headroom**            | 上下文压缩               | 压缩 Superpowers 技能产生的上下文              |
| **Caveman**             | 输出压缩                 | 压缩技能执行后的输出                           |

四者互补：Superpowers 管“流程”，codebase-memory-mcp 管“探索”，Headroom 管“输入”，Caveman 管“输出”。

---

## 9. 注意事项

- **Superpowers 在 Cursor Agent 中效果最佳**：Cursor Composer 和 Agent 是不同的界面，Superpowers 针对 Agent 聊天界面优化。[reference:15]
- **Workspace 上下文自动传递**：Cursor Agent 会自动向 Superpowers 技能提供 workspace 上下文，因此 brainstorming 和 writing-plans 技能可以引用现有代码库结构。[reference:16]
- **自动技能激活**：技能根据上下文自动加载，无需手动选择。例如输入“帮我设计一个新功能”会自动触发 brainstorming。
- **强制 TDD**：`test-driven-development` 技能是铁律技能，强制红-绿-重构循环，不可跳过。
- **常用技能入口**：`brainstorming` 是最常用的入口技能，建议在写任何代码之前先使用它。
- **Windows 兼容性**：部分功能在 Windows + Git Bash 下可能存在问题，可尝试使用 `--foreground` 模式运行可视化伴侣服务器。[reference:17]

---

## 10. 故障排查

| 问题                               | 可能原因                   | 解决方案                                                                                                    |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/plugin-add superpowers` 执行失败 | 网络问题或 Cursor 版本过旧 | 检查网络连接，更新 Cursor（Help → Check for Updates），重启 IDE                                             |
| 技能未自动加载                     | Agent 会话未刷新           | 开启新的 Agent 会话（Cmd+L / Ctrl+L），或显式请求：“use the brainstorming skill”                            |
| 命令无法识别                       | 不在 Agent 聊天界面        | 确保在 Agent 聊天中操作，而非 Composer 或内联聊天[reference:18]                                             |
| 安装后 Agent 行为无变化            | 插件未正确加载             | 重启 Agent 会话，尝试触发技能的任务（如“help me debug this”），询问“what skills do you have?”[reference:19] |
| MCP 连接失败                       | 路径错误或依赖缺失         | 确认 `npx` 或 `node` 路径正确，检查 `mcp.json` 格式                                                         |
| Visual companion 在 Windows 下失败 | Git Bash 守护进程问题      | 使用 `--foreground` 模式运行服务器[reference:20]                                                            |
| Skills 未生效（Windsurf）          | 目录或 frontmatter 问题    | 确认 `.windsurf/skills/` 目录存在且包含有效 YAML frontmatter 的 `SKILL.md`                                  |
| SessionStart Hook 未触发           | Hook 脚本路径问题          | 检查 `.cursor/hooks/session-start.sh` 是否存在且可执行                                                      |

### 卸载

在 Cursor Agent 中执行：

```text
/plugin-remove superpowers
```

重启 Agent 会话使更改生效。[reference:21]

---

## 11. 参考链接

- [Superpowers GitHub 仓库](https://github.com/obra/superpowers)
- [Superpowers 官方文档](https://mintlify.wiki/obra/superpowers)
- [Install on Cursor - Superpowers](https://mintlify.wiki/obra/superpowers/installation/cursor)
- [Install on Claude Code - Superpowers](https://mintlify.wiki/obra/superpowers/installation/claude-code)
- [Superpowers MCP Server (npm)](https://www.npmjs.com/package/superpowers-mcp)
- [superpowers-mcp GitHub 仓库](https://github.com/erophames/superpowers-mcp)
- [superpowers-cursor GitHub 仓库](https://github.com/chauchakching/superpowers-cursor)
- [Superpowers 中文版（社区）](https://github.com/dxc-danny/superpowers-cn)
- [GitHub Trending 霸榜！深度解析 Superpowers](https://developer.cloud.tencent.cn/article/2644020)
- [Superpower + Claude Code：保姆级教程](https://cloud.tencent.com.cn/developer/article/2671288)
