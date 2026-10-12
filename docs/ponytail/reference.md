# 项目背景与参考链接

> 返回入口：[Ponytail 使用指南](./README.md)

## 什么是 Ponytail

Ponytail 是一个开源的 AI 编码约束 Skill，在 AI 生成代码之前注入一套“最懒但正确”的决策规则，从源头压掉过度封装、多余依赖和没人要求的抽象层。

名字来自仓库首页那个扎马尾、戴椭圆眼镜的程序员形象。官方给这个角色的定位是 **laziest senior dev**：一个见过所有屎山、凌晨三点被叫起来修过的资深工程师，懒是效率不是敷衍。

它不改模型，也不是事后帮你删代码的 linter。它走规则注入：每轮对话前把规则集塞进上下文，让模型在选方案的那一刻就走窄路。

## 基准数据

### Agentic 基准

真实 Claude Code 会话编辑真实开源仓库（FastAPI + React），12 个功能任务，Haiku 4.5，n=4。

| vs 无 Skill 基线 | LOC      | Tokens   | Cost     | Time     | Safe     |
| ---------------- | -------- | -------- | -------- | -------- | -------- |
| **ponytail**     | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman          | -20%     | +7%      | +3%      | +2%      | 100%     |
| “YAGNI + 一行”   | -33%     | -14%     | -21%     | -30%     | 95%      |

### 单次生成基准（旧）

- **80-94% 更少代码**
- **3-6× 更快**
- **42-75% 更便宜**

在每个 Claude 模型上，相对无 Skill Agent。

## 核心能力

- **七级决策阶梯**：YAGNI → 复用 → 标准库 → 原生能力 → 已安装依赖 → 一行 → 最小实现
- **三档强度**：lite / full / ultra
- **六条命令**：`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`
- **100% 安全**：信任边界校验、数据丢失处理、安全、可访问性从不省略
- **跨 Agent**：覆盖 20+ AI 编码 Agent

## 官方资源

| 资源           | 链接                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| GitHub 仓库    | https://github.com/DietrichGebert/ponytail                                                    |
| 完整基准报告   | https://github.com/DietrichGebert/ponytail/blob/main/benchmarks/results/2026-06-18-agentic.md |
| 复现基准       | https://github.com/DietrichGebert/ponytail/tree/main/benchmarks                               |
| 示例目录       | https://github.com/DietrichGebert/ponytail/tree/main/examples                                 |
| Agent 适配文档 | https://github.com/DietrichGebert/ponytail/blob/main/docs/agent-portability.md                |
| Issues         | https://github.com/DietrichGebert/ponytail/issues                                             |

## 社区资源

| 资源                    | 链接                                                   |
| ----------------------- | ------------------------------------------------------ |
| 中文镜像（Gitee）       | https://gitee.com/mirrors/ponytail                     |
| Kimi Code CLI 移植版    | https://github.com/loneyclown/ponytail-kimi            |
| DeepSeek Harness 适配版 | https://github.com/hoyyang/dsh-best-ponytail           |
| Claude Code 完整教程    | https://www.v2code.ai/post/ponytail-claude-code-plugin |

## 相关工具

| 工具        | 说明                             |
| ----------- | -------------------------------- |
| Caveman     | 压缩输出 Token，与 Ponytail 互补 |
| Claude Code | Anthropic 官方 CLI AI 编程助手   |
| Codex       | OpenAI 官方 CLI 编程助手         |

## 许可证

MIT

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
