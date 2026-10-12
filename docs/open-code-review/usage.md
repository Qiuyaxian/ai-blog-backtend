# 使用

> 返回入口：[Open Code Review 使用指南](./README.md)

## CLI 命令概览

```
Usage: ocr [command]

Commands:
  review, r         运行代码审查并输出评论
  scan, s           扫描完整文件（不需要 Git diff）
  rules             检查和调试审查规则
  config            管理配置设置
  llm               LLM 工具命令
  viewer            启动 WebUI 会话查看器（localhost:5483）
  session, sessions 列出和检查已保存的审查会话
  version           显示版本信息
```

## 常用示例

```bash
ocr review --from master --to dev          # 审查分支差异
ocr review --commit abc123                 # 审查单个提交
ocr review --background "Focus on auth"    # 带上下文审查
ocr review -B ./docs/requirements.md       # 从文件读取上下文
ocr config provider                        # 交互式 Provider 配置
ocr config model                           # 交互式模型选择
ocr llm test                               # 测试 LLM 连通性
ocr llm providers                          # 列出内置 Provider
ocr session list                           # 列出已保存会话
ocr version                                # 显示版本信息
```

## 审查模式

### 工作区模式（默认）

审查所有暂存、未暂存和未跟踪的变更：

```bash
ocr review
```

### 分支范围模式

比较两个引用之间的差异：

```bash
ocr review --from main --to feature-branch
```

### 单提交模式

审查单个提交：

```bash
ocr review --commit abc123
```

### 完整文件扫描

扫描完整文件，不需要 Git diff，用于审计不熟悉的代码库或没有有意义 diff 的目录：

```bash
ocr scan
```

## 参数详解

| 参数                              | 说明                                     |
| --------------------------------- | ---------------------------------------- |
| `--from <ref>`                    | 起始引用                                 |
| `--to <ref>`                      | 目标引用                                 |
| `--commit <hash>` / `-c`          | 审查单个提交                             |
| `--background "焦点"`             | 带上下文审查                             |
| `--background-file <path>` / `-B` | 从文件读取上下文                         |
| `--format json`                   | JSON 格式输出                            |
| `--audience agent`                | 抑制进度行，适合 Agent 集成              |
| `--max-tools <n>`                 | 提高工具调用上限（默认 100，可设为 150） |
| `--preview`                       | 零成本查看五道过滤门的结果与原因         |
| `--repo <path>`                   | 指定仓库路径                             |
| `--rule <path>`                   | 覆盖规则文件                             |
| `--color <auto\|always\|never>`   | 控制 ANSI 颜色输出                       |

## 辅助命令

### 验证 LLM 连通性

```bash
ocr llm test
```

### 列出内置 Provider

```bash
ocr llm providers
```

### 检查文件适用的规则

```bash
ocr rules check <file>
```

显示给定文件路径适用的规则及其来源层级。

### 查看已保存的会话

```bash
ocr session list
ocr session show <id>
ocr session comments <id>
```

### 启动 WebUI 查看器

```bash
ocr viewer
```

在 `localhost:5483` 启动本地 Web UI，查看历史审查会话。

## Delegation 模式

Delegation 模式下，OCR 不调用 LLM 端点，而是由宿主 Agent 使用自身的 LLM 能力执行审查。OCR 仅提供确定性工程（文件选择、规则解析）。

**适用场景：**

- 使用 Cursor CLI 等外部 Agent 进行审查推理
- 不想在 OCR 侧配置 LLM 端点
- 希望复用宿主 Agent 的模型和工具链

**工作流：**

```bash
# 1. 预览确定需要审查的内容
ocr delegate preview --format json

# 2. 获取文件适用的规则
ocr delegate rule --format json <path1> <path2> ...

# 3. 基于 preview 输出的 ref 信息，用 git 获取 diff
# 4. 逐文件审查，使用宿主 Agent 的能力
# 5. 按标准格式输出评论（path、content、start_line、severity 等）
```

## Agent 集成

所有集成方式要求 Git ≥ 2.41，且需先安装 `ocr` CLI。

### Claude Code

```text
/plugin marketplace add alibaba/open-code-review
/plugin install open-code-review@open-code-review
```

安装后获得 `/open-code-review:review` 和 `/open-code-review:delegate-review` 斜杠命令。

### Codex

```bash
codex plugin marketplace add alibaba/open-code-review
codex /plugins
```

安装并启用插件后，在新会话中通过 `@Open Code Review` 调用：

```text
@Open Code Review review my current changes
@Open Code Review review this branch against main
@Open Code Review review and fix high-confidence issues
```

### Cursor

将 `plugins/open-code-review/` 目录复制到：

```text
~/.cursor/plugins/local/open-code-review/
```

重启 Cursor 或运行 **Developer: Reload Window**。

### 通用 Skill 安装

```bash
npx skills add alibaba/open-code-review --skill open-code-review
```

## 委托模式，通过 MCP 走 Cursor 的网络连接，使用 code plan

委托模式让 OCR 仅负责确定性工程（文件筛选、规则解析），实际的代码审查由 Cursor 使用自身 LLM 完成。无需在 OCR 端配置 LLM。

```bash
npx skills add alibaba/open-code-review --skill open-code-review-delegate --agent cursor
```

成功后会在 cursor 等 skills 里面看到 open-code-review-delegate 了

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
