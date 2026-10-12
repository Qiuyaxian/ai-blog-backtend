# 项目背景与参考链接

> 返回入口：[Open Code Review 使用指南](./README.md)

## 什么是 Open Code Review

Open Code Review 是一款 AI 驱动的代码审查 CLI 工具。它的前身是阿里集团内部官方 AI 代码审查助手，过去两年在内部服务了数万开发者，识别了数百万个代码缺陷。经过大规模充分验证后，孵化为开源项目（Apache-2.0）。

只需配置一个模型端点即可使用。OCR 读取 Git diff，将变更文件发送给可配置的 LLM（通过具备工具调用能力的 Agent），生成具有行级精度的结构化审查评论。Agent 可以读取完整文件内容、搜索代码库、检查其他变更文件以获取上下文，从而产生深度审查，而不仅仅是表面的 diff 反馈。

除 diff 审查外，`ocr scan` 还支持审查整个文件，用于审计不熟悉的代码库或没有有意义 diff 的目录。

## 核心架构：确定性工程 × Agent 混合

OCR 的核心设计是将确定性工程与 LLM Agent 结合，各司其职：

**确定性工程 — 硬约束**

对于绝对不能出错的审查步骤，由工程逻辑而非语言模型来保证正确性：

- **精确文件选择** — 确定哪些文件需要审查、哪些应被过滤
- **规则匹配** — 根据文件路径和内容匹配适用的审查规则
- **行号定位** — 确保评论锚定到准确的代码位置

**LLM Agent — 智能决策**

对于需要理解和判断的任务，由 Agent 处理：

- 读取完整文件内容，获取上下文
- 搜索代码库，探索相关代码
- 检查其他变更文件以理解变更意图
- 生成深度审查评论

**与传统 Agent 方案对比**

| 问题     | 通用 Agent（如 Claude Code + Skills） | Open Code Review         |
| -------- | ------------------------------------- | ------------------------ |
| 覆盖不全 | 大改动时只挑几个文件看                | 确定性文件选择保证全覆盖 |
| 位置漂移 | 行号对不上、文件指错                  | 工程化行号定位           |
| 质量不稳 | 提示词微调导致结果波动                | 规则与工程逻辑保证稳定性 |

## 核心能力

- **混合架构**：确定性管道 + LLM Agent，兼顾稳定性与覆盖率
- **精确文件选择**：确定性逻辑决定哪些文件需要审查，避免遗漏
- **行级精度**：工程化行号定位，评论锚定准确
- **内置规则集**：NPE、SQL 注入、XSS、线程安全、参数校验缺失等
- **多语言支持**：兼容 OpenAI 和 Anthropic 协议，内置 28+ LLM Provider
- **仓库级上下文**：Agent 可读取完整文件、搜索代码库、探索变更上下文
- **Delegation 模式**：OCR 提供确定性工程，由宿主 Agent 执行审查推理
- **CLI 全功能**：`review`、`scan`、`rules`、`config`、`llm`、`session`、`viewer` 等
- **Agent 集成**：Claude Code、Codex、Cursor、QCA Forward 专用插件
- **CI/CD 集成**：GitHub Actions、GitLab CI、GitFlic CI、Gerrit
- **WebUI 查看器**：`ocr viewer` 在 `localhost:5483` 启动本地界面查看历史会话

## 性能基准（AACR-Bench）

基于 50 个流行开源仓库、200 个真实 Pull Request、10 种编程语言构建的真实世界代码审查基准，由 80+ 高级工程师交叉验证（1,505 条标注的真实问题）。

与通用 Agent（Claude Code）相比，在相同底层模型下：

| 指标                    | Open Code Review 表现                                    |
| ----------------------- | -------------------------------------------------------- |
| **Precision（精确率）** | 显著更高，误报更少                                       |
| **F1 综合得分**         | 显著更高                                                 |
| **Token 消耗**          | 约 **1/9**                                               |
| **审查速度**            | 更快                                                     |
| **Recall（召回率）**    | 低于通用 Agent，这是有意为之的权衡——优先保证精度而非噪声 |

> AACR-Bench 数据集已在 Hugging Face 上公开。

## 官方资源

| 资源          | 链接                                                          |
| ------------- | ------------------------------------------------------------- |
| GitHub 仓库   | https://github.com/alibaba/open-code-review                   |
| 官方文档站    | https://open-codereview.ai                                    |
| Releases 页面 | https://github.com/alibaba/open-code-review/releases          |
| npm 包页面    | https://www.npmjs.com/package/@alibaba-group/open-code-review |
| Issues        | https://github.com/alibaba/open-code-review/issues            |

## 架构与文档

| 资源              | 链接                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| DeepWiki 架构文档 | https://deepwiki.com/alibaba/open-code-review                                                      |
| CLI Reference     | https://github.com/alibaba/open-code-review/blob/main/pages/src/content/docs/en/cli-reference.md   |
| Configuration     | https://github.com/alibaba/open-code-review/blob/main/pages/src/content/docs/en/configuration.md   |
| Review Rules      | https://github.com/alibaba/open-code-review/blob/main/pages/src/content/docs/en/review-rules.md    |
| CI/CD Integration | https://github.com/alibaba/open-code-review/blob/main/pages/src/content/docs/en/integrations/ci.md |
| FAQ               | https://github.com/alibaba/open-code-review/blob/main/pages/src/content/docs/en/faq.md             |

## 社区资源

| 资源                  | 链接                                                    |
| --------------------- | ------------------------------------------------------- |
| AACR-Bench 数据集     | https://huggingface.co/datasets/Alibaba-Aone/aacr-bench |
| Ollama tools 支持模型 | https://ollama.com/search?c=tools                       |

## 相关工具

| 工具                  | 说明                                                               |
| --------------------- | ------------------------------------------------------------------ |
| Claude Code           | Anthropic 官方 CLI AI 编程助手                                     |
| Codex                 | OpenAI 官方 CLI 编程助手                                           |
| Cursor                | AI 代码编辑器                                                      |
| OpenCode Review Skill | `npx skills add alibaba/open-code-review --skill open-code-review` |

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
