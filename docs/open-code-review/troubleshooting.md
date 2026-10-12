# 故障排查

> 返回入口：[Open Code Review 使用指南](./README.md)

## 常见错误

### `no valid LLM endpoint configured`

OCR 运行了完整的端点解析链，未找到完整的 `(URL, token, model)` 三元组。

**解决方案：**

1. 运行 `ocr config set llm.url … / llm.auth_token … / llm.model …` 填充配置文件
2. 或导出 `OCR_LLM_URL` / `OCR_LLM_TOKEN` / `OCR_LLM_MODEL`
3. 或导出 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL`
4. 然后运行 `ocr llm test` 验证连通性

### `ocr llm test` 显示了错误的来源

OCR 使用第一个完整的三元组，而非最后一个。如果配置文件中三个 `llm.*` 键都已设置，环境变量会被忽略。要让环境变量生效：

```bash
# 删除配置文件或手动取消设置
rm ~/.opencodereview/config.json

# 或使用 ocr config set 切换到新值
```

### 401 / 403 错误

Token 缺少权限、已过期或厂商错误。检查：

- **Anthropic**：URL 以 `/v1/messages` 结尾，`use_anthropic=true`
- **OpenAI / OpenAI 兼容**：URL 以 `/v1/chat/completions` 结尾，`use_anthropic=false`

### `not a git repository`

`ocr review` 对当前目录运行 `git diff`（以及 `git ls-files` 用于未跟踪文件）。如果不在 Git 工作树内，会提前退出。

**解决方案：** `cd` 进入仓库，或使用 `--repo /path/to/repo` 指定路径。

### `No tool calls parsed`（本地模型 / Ollama）

如果每次审查都循环出现 `No tool calls parsed` 重试，并以 `Max tool requests reached` 和零评论结束，问题在于模型而非配置。OCR 完全通过工具调用来驱动审查，模型必须支持原生工具调用（function calling）。仅能在文本输出中描述工具调用的模型（如 deepseek-r1）永远无法与 OCR 配合。支持原生工具调用的模型（如 qwen3）可以正常工作。

对于 Ollama，选择标记了 tools 支持的模型：https://ollama.com/search?c=tools

### 文件未被审查

可能原因：

- 文件被内建默认排除模式过滤（测试文件等）
- 文件被用户自定义 `exclude` 模式匹配
- 文件扩展名不在白名单内
- 文件是二进制文件

使用 `ocr review --preview` 零成本查看五道过滤门的结果与原因。

### 自定义规则未生效

1. 运行 `ocr rules check <path>` 查看命中的层级和来源
2. 检查是否有更高优先级的规则文件覆盖
3. 确认 `include` / `exclude` 模式是否匹配目标文件

### Brace expansion 不工作

OCR 的 Glob 模式不支持 Bash 风格的 brace expansion。使用 `src/**/*.{ts,tsx}` 格式。

### 评论 start_line 为 0 无法锚定行号

可能原因：

- 模型改写了 `existing_code`——没有从 diff 中原样复制，而是做了意译
- diff 格式异常——例如 CRLF 换行、tab/空格混用，导致滑动窗口匹配被打断

## 性能与成本排查

### CI 运行比本地慢得多

检查：

- Runner 网络延迟
- 是否安装了最新版本
- `--max-tools` 设置是否合理

### 审查耗时过长

使用 `--max-tools <n>` 提高工具调用上限（默认 100，可设为 150）。

### Token 花费定位

使用 `ocr session list` 查看历史会话，`ocr session show <id>` 检查单次会话的详细统计。

## 隐私与安全

- OCR 只读取 diff，不执行 PR 中的代码
- `pull_request_target` 用于确保 fork PR 也能获取 secrets
- 所有代码内容发送到配置的 LLM 端点，请确认端点可信

## 排查工具链

| 问题类型     | 排查工具                                     |
| ------------ | -------------------------------------------- |
| 连接问题     | `ocr llm test`（验证端点三元组与连通性）     |
| 文件没被审查 | `ocr review --preview`（查看五道过滤门结果） |
| 规则没生效   | `ocr rules check <path>`（打印命中的层级）   |
| 性能问题     | `ocr session show <id>`（检查会话详情）      |
| 查看历史     | `ocr viewer`（启动 WebUI）                   |

## 提交 Issue

如果问题不在上述列表中，请到 [GitHub Issues](https://github.com/alibaba/open-code-review/issues) 提交，附上运行的命令和完整输出。

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
