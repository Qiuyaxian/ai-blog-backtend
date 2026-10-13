# Spec Kit 快速上手

> 这是一份导读入口。详细的安装选项、命令参数、工作流说明与故障排查，请见 [spec-kit 入门指南](./usage.md)。

---

## AI 阅读指引

- 涉及 spec-kit 时，先读本文件。
- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 是什么

Spec Kit 是 GitHub 开源的规范驱动开发（SDD）工具包。它用 `specify` CLI 和 `/speckit.*` 斜杠命令，把需求、计划、任务和实现串成一条可执行的工程流程。

核心产出物：

| 产出物            | 命令                    | 作用           |
| ----------------- | ----------------------- | -------------- |
| `constitution.md` | `/speckit.constitution` | 项目治理原则   |
| `spec.md`         | `/speckit.specify`      | 需求规格       |
| `plan.md`         | `/speckit.plan`         | 技术方案       |
| `tasks.md`        | `/speckit.tasks`        | 任务拆解       |
| 源代码            | `/speckit.implement`    | 按任务生成实现 |

---

## 前置条件

- Python 3.11+
- 包管理：推荐 [uv](https://docs.astral.sh/uv/)
- AI 编码助手：Claude Code、GitHub Copilot、Cursor、Gemini CLI 等

安装 uv 的最简命令：

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
winget install --id=astral-sh.uv -e
```

> 其他安装方式（pipx、pip）见 [spec-kit 入门指南](./usage.md#前置条件)。

---

## 安装 Specify CLI

最简安装（从 PyPI）：

```bash
uv tool install specify-cli
```

验证：

```bash
specify version
```

> 从 GitHub 源码安装、指定版本、一次性使用、升级方法，详见 [spec-kit 入门指南](./usage.md#安装-specify-cli)。

---

## 初始化项目

新建项目：

```bash
specify init my-project --integration copilot
cd my-project
```

在现有项目中初始化：

```bash
specify init --here
```

> `--integration` 可选值（`copilot`、`claude`、`cursor`、`gemini` 等）、非交互模式、强制覆盖等，详见 [spec-kit 入门指南](./usage.md#初始化项目)。

---

## 工作流（七步）

在 AI 助手聊天界面依次执行：

1. `/speckit.constitution` — 建立项目原则
2. `/speckit.specify` — 定义需求规格
3. `/speckit.clarify` — 澄清歧义（可选）
4. `/speckit.plan` — 生成技术方案
5. `/speckit.tasks` — 拆解可执行任务
6. `/speckit.analyze` — 验证一致性（可选）
7. `/speckit.implement` — 执行实现

> 每个命令的详细用法、参数、产出说明，见 [spec-kit 入门指南](./usage.md#工作流程)。

---

## 核心命令速览

### 终端命令

- `specify init <name>` — 初始化项目
- `specify check` — 检查环境
- `specify version` — 查看版本
- `specify self check` — 检查更新
- `specify self upgrade` — 升级 CLI

### 斜杠命令

- `/speckit.constitution`
- `/speckit.specify`
- `/speckit.clarify`
- `/speckit.plan`
- `/speckit.tasks`
- `/speckit.analyze`
- `/speckit.implement`

> 所有命令的完整参数、选项与示例，见 [spec-kit 入门指南](./usage.md#核心命令)。

---

## 常见问题

| 问题                      | 快速处理                            |
| ------------------------- | ----------------------------------- |
| `command not found: uv`   | 先安装 uv（见第 2 节）              |
| `specify init` 卡在选择器 | 加 `--non-interactive`              |
| 非空目录初始化失败        | 加 `--force`                        |
| 斜杠命令不生效            | 确认 `--integration` 与实际助手匹配 |

> 更多故障场景与解决方案，见 [spec-kit 入门指南](./usage.md#故障排查)。

---

## 参考

- [spec-kit 入门指南](./usage.md)
- [Spec Kit 仓库](https://github.com/github/spec-kit)
- [官方文档](https://github.github.com/spec-kit/)
- [PyPI specify-cli](https://pypi.org/project/specify-cli/)
- [Releases](https://github.com/github/spec-kit/releases)

---
