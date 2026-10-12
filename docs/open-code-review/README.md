# Open Code Review (OCR)

> 阿里巴巴开源的 AI 代码审查 CLI 工具，采用“确定性工程 + LLM Agent”混合架构。CLI 命令为 `ocr`。本仓库使用其**委托模式**：CLI 只负责圈定文件与解析规则，审查由当前 AI 代理完成，不需要给 OCR 配置 LLM。

## AI 阅读指引

- 涉及 OCR 时，先读本文件。
- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 按需阅读

| 当任务涉及                                           | 读取文件                                   |
| ---------------------------------------------------- | ------------------------------------------ |
| 安装、升级、卸载、六种安装方式、支持平台             | [installation.md](./installation.md)       |
| LLM 配置、Provider、环境变量、配置优先级             | [configuration.md](./configuration.md)     |
| CLI 命令、审查模式、参数详解、Delegation、Agent 集成 | [usage.md](./usage.md)                     |
| 内置规则、自定义规则、include/exclude                | [rules.md](./rules.md)                     |
| GitHub Actions、GitLab CI、PR 自动审查               | [ci-integration.md](./ci-integration.md)   |
| 常见错误、FAQ、性能与隐私问题                        | [troubleshooting.md](./troubleshooting.md) |
| 项目背景、核心架构、基准数据、外部链接               | [reference.md](./reference.md)             |

## 本仓库的使用方式：委托模式（Delegation）

本仓库已安装委托模式 skill（`.agents/skills/open-code-review-delegate/SKILL.md`）。该模式下 **OCR 不调用任何 LLM**：`ocr` CLI 只做确定性工程（圈定待审文件、解析规则），实际审查由当前 AI 代理用自身能力完成，因此**无需配置 LLM API Key**。

委托工作流（详见 skill 文件）：

```bash
ocr delegate preview --format json          # 圈定待审文件 / 模式 / ref
ocr delegate rule --format json <path...>   # 按文件取审查规则
# diff 用 git 直接取，审查与报告由 AI 代理完成
```

> 状态：skill 已就位，但当前环境尚未检测到 `ocr` 二进制（`ocr --version` 不可用）。需要使用时按下文安装 CLI；不装 CLI 时无法跑 `ocr delegate` 子命令。

## CLI 安装（仅委托模式需要）

前置条件：Git ≥ 2.41。注意 CLI 自身要求 Node ≥ 22.5，与本仓库运行时基线 Node 20 不同——安装 CLI 需另备 Node 22 环境（如 nvm 切换），不影响项目本身。

本仓库统一使用 pnpm，用 pnpm 安装全局 CLI（不要用 npm）：

```bash
pnpm add -g @alibaba-group/open-code-review
ocr --version
```

其他安装方式（Homebrew / 安装脚本 / 二进制）见 [installation.md](./installation.md)。完整命令与参数见 [usage.md](./usage.md)。

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
