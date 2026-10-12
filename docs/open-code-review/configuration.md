# 配置

> 返回入口：[Open Code Review 使用指南](./README.md)

## 配置文件位置

```
~/.opencodereview/config.json
```

## 配置优先级

配置来源的优先级从高到低：

1. **环境变量**（最高优先级，推荐用于 CI）
2. **CLI 参数**
3. **项目级配置**（`<repo>/.opencodereview/rule.json`）
4. **全局配置**（`~/.opencodereview/config.json`）

OCR 使用第一个完整的 `(URL, token, model)` 三元组，而非最后一个。如果配置文件中三个 `llm.*` 键都已设置，环境变量会被忽略。要让环境变量生效，需要删除配置文件中的对应键或使用 `ocr config set` 切换。

## 方式一：交互式配置

```bash
ocr config provider   # 交互式选择 Provider
ocr config model      # 交互式选择模型
```

交互式流程：选择内置或自定义 Provider → 输入 API Key → 选择 Model → 保存到配置文件 → 运行 `ocr llm test` 验证端点。

## 方式二：命令行配置

```bash
ocr config set llm.url https://api.anthropic.com/v1/messages
ocr config set llm.auth_token your-api-key-here
ocr config set llm.model claude-opus-4-6
ocr config set llm.use_anthropic true
```

查看配置：

```bash
ocr config
```

## 方式三：环境变量（优先级最高，推荐用于 CI）

```bash
export OCR_LLM_URL=https://api.anthropic.com/v1/messages
export OCR_LLM_TOKEN=your-api-key-here
export OCR_LLM_MODEL=claude-opus-4-6
export OCR_USE_ANTHROPIC=true
```

如果已使用 Claude Code，可以复用其环境变量：

```bash
export ANTHROPIC_BASE_URL=https://api.anthropic.com
export ANTHROPIC_AUTH_TOKEN=your-api-key-here
export ANTHROPIC_MODEL=claude-opus-4-6
```

## 内置 Provider

OCR 内置 28+ LLM Provider，包括：

| Provider    | 协议                    | Base URL                    | 环境变量            |
| ----------- | ----------------------- | --------------------------- | ------------------- |
| `anthropic` | Anthropic               | `https://api.anthropic.com` | `ANTHROPIC_API_KEY` |
| `openai`    | OpenAI Chat Completions | `https://api.openai.com/v1` | `OPENAI_API_KEY`    |
| `bedrock`   | Anthropic Bedrock       | 由 AWS SDK 自动解析         | 环境凭据链          |
| `edenai`    | OpenAI Chat Completions | `https://api.edenai.run/v3` | `EDENAI_API_KEY`    |
| `dashscope` | OpenAI 兼容             | 阿里云百炼                  | `DASHSCOPE_API_KEY` |

列出所有内置 Provider：

```bash
ocr llm providers
```

## 自定义 Provider

通过 `ocr config set` 添加自定义 Provider：

```bash
ocr config set custom_providers.my-provider.url https://my-llm.example.com/v1
ocr config set custom_providers.my-provider.auth_token your-key
ocr config set custom_providers.my-provider.model my-model
ocr config set custom_providers.my-provider.protocol openai
```

删除自定义 Provider：

```bash
ocr config unset custom_providers.my-provider
```

## 验证配置

```bash
ocr llm test
```

发送一个小型聊天请求验证端点连通性。

## 常见配置错误

### `no valid LLM endpoint configured`

OCR 运行了完整的端点解析链，未找到完整的 `(URL, token, model)` 三元组。解决方案：

1. 运行 `ocr config set llm.url … / llm.auth_token … / llm.model …`
2. 或导出 `OCR_LLM_URL` / `OCR_LLM_TOKEN` / `OCR_LLM_MODEL`
3. 或导出 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL`

然后运行 `ocr llm test` 验证连通性。

### 401 / 403 错误

Token 缺少权限、已过期或厂商错误。注意 Anthropic 和 OpenAI 使用不同的认证头和 URL 格式：

- **Anthropic**：URL 以 `/v1/messages` 结尾，`use_anthropic=true`
- **OpenAI / OpenAI 兼容**：URL 以 `/v1/chat/completions` 结尾，`use_anthropic=false`

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
