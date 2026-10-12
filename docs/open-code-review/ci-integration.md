# CI 集成

> 返回入口：[Open Code Review 使用指南](./README.md)

## CI/CD 集成工作原理

所有 CI 集成遵循同一模式：

1. **触发**：PR/MR 事件或手动评论 `/open-code-review` 触发任务。
2. **安装 ocr**：在 runner 中运行 `npm install -g @alibaba-group/open-code-review`（runner 是临时的，每次运行都需要安装）。
3. **配置 LLM**：通过 CI secrets 用 `ocr config set` 配置端点、token、模型（没有持久化的 `~/.opencodereview` 可依赖）。
4. **运行审查**：使用分支范围模式 + 机器可读输出：

   ```bash
   ocr review \
     --from "origin/<base-branch>" \
     --to "origin/<head-branch>" \
     --format json \
     --audience agent
   ```

   `--format json` 提供可解析的 payload；`--audience agent` 抑制进度行。

5. **解析 JSON**：遍历 `comments[]` 获取每条评论。
6. **回帖**：通过 PR/MR 的 Review API 发布行级评论。没有有效行信息的条目折叠到摘要注释中。

## 核心命令

```bash
ocr review \
  --from "origin/main" \
  --to "<commit_sha>" \
  --format json
```

- `--from` 接受分支引用（如 `origin/main`）或 commit SHA 作为基线。
- `--to` 接受 commit SHA 或分支引用作为头部。CI 环境中建议对 `--to` 使用 commit SHA，以正确处理 fork PR。
- `--format json` 输出机器可读结果，每条发现携带 `category` 和 `severity` 结构化字段，便于 CI 脚本排序、分组、过滤或门禁构建。

## 凭据说明

CI 中始终涉及两种凭据：

- **LLM 凭据**：OCR 用于生成发现结果。
- **PR/MR 写权限 Token**：回帖步骤用于发布评论。

GitHub 通过 `GITHUB_TOKEN` 自动获取写权限 Token。GitLab 推荐使用 `GITLAB_API_TOKEN`，fork MR 场景下回退到内置的 `CI_JOB_TOKEN`。

## GitHub Actions

### 方式一：使用 composite Action（推荐）

本仓库在根目录提供即用型 composite Action（`action.yml`），直接引用即可完成完整流程——checkout、OCR 安装、运行审查、发布行内和摘要评论、上传 artifacts、重试/幂等处理：

```yaml
- uses: alibaba/open-code-review@main
  with:
    llm_url: ${{ secrets.OCR_LLM_URL }}
    llm_auth_token: ${{ secrets.OCR_LLM_AUTH_TOKEN }}
    llm_model: ${{ vars.OCR_LLM_MODEL }}
```

### 方式二：使用示例工作流

```bash
mkdir -p .github/workflows
curl -o .github/workflows/ocr-review.yml \
  https://raw.githubusercontent.com/alibaba/open-code-review/main/examples/github_actions/ocr-review.yml
```

工作流功能：

- **触发条件**：`pull_request_target`（opened）和 `issue_comment` 事件，且评论内容以 `/open-code-review` 或 `@open-code-review` 开头。后者允许审查者在 PR 上评论以重新运行 OCR。
- **安装与配置**：通过 `npm install -g @alibaba-group/open-code-review` 安装，用 `ocr config set` 写入配置，然后在分支范围模式下运行核心命令。
- **回帖**：解析 JSON envelope，通过 GitHub Pull Request Review API 将每条发现作为行级评论发布。没有行信息的评论折叠到摘要中。批量提交失败时回退到逐条发布。

### 配置 Secrets

在仓库的 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称          | 说明                    |
| -------------------- | ----------------------- |
| `OCR_LLM_AUTH_TOKEN` | LLM API Key             |
| `OCR_LLM_URL`        | LLM 端点 URL            |
| `OCR_LLM_MODEL`      | 模型名称                |
| `OCR_USE_ANTHROPIC`  | 是否使用 Anthropic 协议 |

### 手动触发审查

在 PR 评论中输入：

```
/open-code-review
```

或

```
@open-code-review
```

## GitLab CI

### 安装模板

将 `examples/gitlab_ci/.gitlab-ci.yml` 中的模板复制到你的仓库。

### 触发条件

- 新建 MR
- MR 更新
- 手动评论 `/open-code-review`

### 配置变量

在 GitLab 项目的 **Settings → CI/CD → Variables** 中添加：

| 变量名               | 说明                     |
| -------------------- | ------------------------ |
| `OCR_LLM_AUTH_TOKEN` | LLM API Key              |
| `OCR_LLM_URL`        | LLM 端点 URL             |
| `OCR_LLM_MODEL`      | 模型名称                 |
| `OCR_USE_ANTHROPIC`  | 是否使用 Anthropic 协议  |
| `GITLAB_API_TOKEN`   | GitLab API Token（推荐） |

## 参考文件

- GitHub Actions 工作流：[examples/github_actions/ocr-review.yml](https://github.com/alibaba/open-code-review/blob/main/examples/github_actions/ocr-review.yml)
- GitLab CI 模板：[examples/gitlab_ci/.gitlab-ci.yml](https://github.com/alibaba/open-code-review/blob/main/examples/gitlab_ci/.gitlab-ci.yml)

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
