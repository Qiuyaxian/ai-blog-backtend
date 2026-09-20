# 【ai-blog-backtend】架构设计

> 本文档描述 【ai-blog-backtend】 的整体架构设计，包括系统上下文、模块划分、技术选型、数据流、部署拓扑、工程化约束等内容。
> 相关技术文档统一在对应章节或文末链接。
> 文档导航与项目概述见 [index.md](./index.md)。

## 1. 系统上下文

## 2. 总体架构

```text
+----------------+
|   Client/UI    |
+--------+-------+
         |
+--------v-------+
|   API/网关      |
+--------+-------+
         |
+--------v-------+
|   业务服务层    |
+--------+-------+
         |
+--------v-------+
| 数据/存储/外部  |
+----------------+
```

## 3. 模块划分

| 模块 | 职责 | 关键依赖 |
| ---- | ---- | -------- |

## 4. 技术选型

| 类别     | 技术                     | 版本          | 说明             |
| -------- | ------------------------ | ------------- | ---------------- |
| 前端     | Vue 3 / React            | 最新稳定版    | 按团队熟悉度选择 |
| 后端     | NestJS                   | 提供 REST API |
| 数据库   | MongoDB                  | 6.x           | 主数据存储       |
| 缓存     | Redis                    | 7.x           | 会话、缓存、限流 |
| 消息队列 | RabbitMQ / Kafka         | 规划中        | 异步通知         |
| 邮件     | Nodemailer / SendGrid    | 规划中        | 邮件发送         |
| 部署     | Docker + Docker Compose  | 最新          | 本地与生产       |
| CI/CD    | GitHub Actions / Harness | 最新          | 自动化构建与部署 |
| 监控     | Prometheus + Grafana     | 最新          | 指标与告警       |
| 包管理器 | pnpm                     | 9.15.9        | node >= 18       |

## 5. 数据流与存储

## 6. 部署拓扑

## 7. 安全与可观测性

### 7.1 安全与权限

### 7.2 可观测性

## 8. 工程化

### 8.1 内置工具

### 8.1.1 Git Hooks：Husky

Husky 用于管理 Git hooks，在提交、推送等阶段执行本地校验，避免不符合规范的代码进入仓库。

- 官方文档：[Husky - Git hooks](https://typicode.github.io/husky/)
- 项目内配置：`.husky/`
- 相关脚本：`package.json` 中 `prepare`、`lint-staged` 等
- 说明：外部文档仅作为参考，具体以项目配置为准。

常见 hooks：

| Hook         | 作用                                | 项目内配置          |
| ------------ | ----------------------------------- | ------------------- |
| `pre-commit` | 提交前运行 lint、格式化、类型检查等 | `.husky/pre-commit` |
| `commit-msg` | 校验提交信息格式                    | `.husky/commit-msg` |
| `pre-push`   | 推送前运行测试或轻量检查            | `.husky/pre-push`   |

相关外部文档：

- [Husky 官方文档](https://typicode.github.io/husky/)
- [Husky GitHub 仓库](https://github.com/typicode/husky)
- [lint-staged 官方文档](https://github.com/lint-staged/lint-staged)
- [Commitlint 官方文档](https://commitlint.js.org/)

> 说明：Husky 属于开发阶段的工程化工具，不直接影响运行时架构。此处的目的是记录它带来的开发约束、配置入口和外部参考文档。

### 8.1.2 template create: hygen

hygen 用于快速初始化生成指定格式的文档，如 docs 文档，nestjs 模块代码

- 官方文档：[hygen](https://github.com/jondot/hygen)
- 项目内配置：`npm run new`
- 相关脚本：`package.json` 中 `new` 等
- 说明：外部文档仅作为参考，具体以项目配置为准。

相关外部文档：

- [hygen 官方文档](https://github.com/jondot/hygen)

### 8.2 代码规范与格式化

- 代码规范：ESLint / Prettier
- 提交前检查：lint-staged
- 提交信息规范：@commitlint & commitizen & cz-git

### 8.3 CI/CD

- CI：GitHub Actions / GitLab CI / Jenkins
- 构建：
- 测试：
- 部署：

### 8.4 本地开发命令

## 9. 关键设计决策

| 决策 | 背景 | 选择 | 影响 |
| ---- | ---- | ---- | ---- |

## 相关文档

- [项目概述与导航](./index.md)
- [Husky 官方文档](https://typicode.github.io/husky/)

## 变更记录

| 日期 | 版本 | 变更人 | 说明 |
| ---- | ---- | ------ | ---- |
