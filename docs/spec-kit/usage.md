# Spec-Kit 入门指南

> Spec Kit 是 GitHub 开源的规范驱动开发（Spec-Driven Development）工具包。  
> 它通过 `specify` CLI 和 `/speckit.*` 斜杠命令，将需求、计划、任务和实现串联成可执行的工程流程。  
> 本文件是安装与使用指南，供团队成员和 AI 助手参考。

---

## 1. 什么是 Spec Kit

Spec-Driven Development（SDD）将“规范”从编码前的临时脚手架，转变为贯穿整个开发周期的可执行产物。Spec Kit 是 GitHub 对这一理念的开源实现，支持 Claude Code、GitHub Copilot、Cursor、Gemini CLI 等 AI 编码助手[reference:0]。

核心产出物：

| 产出物            | 命令                    | 说明                       |
| ----------------- | ----------------------- | -------------------------- |
| `constitution.md` | `/speckit.constitution` | 项目治理原则与开发准则     |
| `spec.md`         | `/speckit.specify`      | 需求规格，定义“做什么”     |
| `plan.md`         | `/speckit.plan`         | 技术实现计划，定义“怎么做” |
| `tasks.md`        | `/speckit.tasks`        | 可执行的任务拆解           |
| 源代码            | `/speckit.implement`    | 按任务生成实现代码         |

---

## 2. 前置条件

- **操作系统**：Linux / macOS / Windows（PowerShell 脚本已支持，无需 WSL）
- **Python**：3.11 及以上
- **包管理**：推荐 [uv](https://docs.astral.sh/uv/)，也可使用 pipx 或 pip
- **AI 编码助手**：Claude Code、GitHub Copilot、Cursor、Gemini CLI、CodeBuddy CLI 等
- **Git**：可选，仅在启用 git 扩展时需要

---

## 3. 安装 Specify CLI

Spec Kit 通过两个官方渠道分发：GitHub 源码和 PyPI 上的 `specify-cli` 包。两条路线提供相同的 `specify` CLI。

### 方式一：从 PyPI 安装（推荐）

Spec Kit 已发布到 PyPI，包名为 `specify-cli`，可直接用 Python 包管理器安装：

```bash
# 使用 uv（推荐）
uv tool install specify-cli

# 或使用 pipx
pipx install specify-cli

# 或使用 pip
pip install specify-cli
```

安装指定版本时锁定版本号，例如：

```bash
uv tool install specify-cli==0.12.11
pipx install specify-cli==0.12.11
pip install specify-cli==0.12.11
```

### 方式二：从 GitHub 源码安装（持久化）

将 `vX.Y.Z` 替换为最新的发布标签，注意保留开头的 `v`（例如 `v1.0.6`，不是 `1.0.6`）：

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
```

最新发布标签见 [GitHub Releases](https://github.com/github/spec-kit/releases)。

### 方式三：一次性使用（不安装）

```bash
uvx --from git+https://github.com/github/spec-kit.git specify init my-project
```

或使用 npx：

```bash
npx speckit init
```

### 验证安装

```bash
specify version
```

该命令确认 `specify` 命令可用并报告版本，但不能区分安装来源是 PyPI 还是 GitHub。

---

## 4. 初始化项目

### 新建项目

```bash
specify init my-project --integration copilot
cd my-project
```

`--integration` 参数指定 AI 编码助手类型，可选值包括 `copilot`、`claude`、`cursor`、`gemini` 等。执行后生成标准目录结构[reference:8]：

```text
my-project/
├── .github/
│   ├── agents/
│   └── prompts/
├── .specify/
│   ├── memory/
│   │   └── constitution.md
│   ├── scripts/
│   └── templates/
├── specs/
│   └── (feature directories will go here)
```

### 在现有项目中初始化

```bash
specify init --here
```

使用 `--here` 进行就地初始化，不会新建目录。

### 非交互模式（CI / AI Agent 环境）

```bash
specify init my-project --non-interactive --integration copilot
```

在非空目录中初始化时，可配合 `--force`：

```bash
specify init --here --force --non-interactive --integration claude
```

[reference:11]

---

## 5. 核心命令

Spec Kit 提供两类命令：**终端命令**（在 shell 中执行）和**斜杠命令**（在 AI 助手聊天界面中执行）。

### 终端命令

| 命令                   | 用途                     |
| ---------------------- | ------------------------ |
| `specify init <name>`  | 初始化项目结构           |
| `specify check`        | 检查环境与配置           |
| `specify version`      | 查看 CLI 版本            |
| `specify self check`   | 检查是否有新版本（只读） |
| `specify self upgrade` | 升级到最新版本           |

### 斜杠命令

| 命令                    | 产出              | 说明                                 |
| ----------------------- | ----------------- | ------------------------------------ |
| `/speckit.constitution` | `constitution.md` | 建立项目治理原则                     |
| `/speckit.specify`      | `spec.md`         | 从自然语言生成需求规格               |
| `/speckit.clarify`      | 澄清问题          | 识别规格中的漏洞和歧义（可选）       |
| `/speckit.plan`         | `plan.md`         | 生成技术实现计划                     |
| `/speckit.tasks`        | `tasks.md`        | 将计划拆解为可执行任务               |
| `/speckit.analyze`      | 一致性报告        | 验证规范、计划、任务是否对齐（可选） |
| `/speckit.implement`    | 源代码            | 按任务逐步实现代码                   |

[reference:14]

---

## 6. 工作流程

完整的工作流遵循以下顺序，每个命令基于上一个命令的产出继续推进：

### 第 1 步：制定项目原则

在 AI 助手的聊天界面中执行：

```text
/speckit.constitution
```

建立项目治理原则，例如：

```text
/speckit.constitution Create principles focused on code quality, testing standards, user experience consistency, and performance requirements
```

生成的 `constitution.md` 包含技术标准、安全要求、性能预期、编码约定等内容[reference:16]。

### 第 2 步：定义需求规格

```text
/speckit.specify Create an RSS Feed Reader application that allows users to subscribe to feeds by URL, view articles sorted newest-first, and track read/unread status.
```

AI 根据描述生成 `spec.md`，包含用户故事、验收标准、边界条件等。

### 第 3 步：（可选）澄清歧义

```text
/speckit.clarify
```

识别规格中的漏洞，提出需要明确的问题[reference:19]。

### 第 4 步：生成实现计划

```text
/speckit.plan
```

生成 `plan.md`，定义技术方案、任务拆解和风险点。

### 第 5 步：拆解可执行任务

```text
/speckit.tasks
```

生成 `tasks.md`，将计划拆解为可逐项执行的任务列表。

### 第 6 步：（可选）验证一致性

```text
/speckit.analyze
```

验证规范、计划和任务之间是否对齐，确保没有遗漏或冲突[reference:20]。

### 第 7 步：执行实现

```text
/speckit.implement
```

按 `tasks.md` 逐步生成代码，完成实现。

---

## 7. 升级 CLI

```bash
# 检查是否有新版本
specify self check

# 预览升级操作（不实际执行）
specify self upgrade --dry-run

# 升级到最新稳定版
specify self upgrade

# 升级到指定版本
specify self upgrade --tag v1.0.6
```

对于 uv tool 安装，升级会在底层执行 `uv tool install specify-cli --force --from <git ref>`[reference:21]。

---

## 8. 故障排查

| 问题                      | 可能原因                  | 解决方案                                                      |
| ------------------------- | ------------------------- | ------------------------------------------------------------- |
| `command not found: uv`   | 未安装 uv                 | 先安装 uv：`curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `specify init` 卡在选择器 | 非交互环境                | 添加 `--non-interactive` 参数                                 |
| 非空目录初始化失败        | 目录已有文件              | 添加 `--force` 参数                                           |
| 找不到 `specify` 命令     | PATH 未配置               | 重新打开终端，或检查 uv/pipx 的 bin 路径                      |
| 斜杠命令不生效            | AI 助手未加载 prompt 文件 | 确认 `--integration` 参数与所用助手匹配                       |

---

## 9. 参考链接

- [Spec Kit GitHub 仓库](https://github.com/github/spec-kit)
- [Spec Kit 官方文档](https://github.github.com/spec-kit/)
- [PyPI specify-cli](https://pypi.org/project/specify-cli/)
- [GitHub Releases](https://github.com/github/spec-kit/releases)
- [安装指南](https://github.github.com/spec-kit/installation.html)
- [PyPI 安装指南](https://github.github.com/spec-kit/install/pypi.html)
