#【ai-blog-backtend】

> 本项目以 NestJS + TypeScript 为核心技术栈，融合 Harness Engineering 的工程实践，面向 Backfront 协同开发与持续交付场景，构建一套兼具架构约束、开发体验与交付质量的工程体系。

> 它不只是一个“能跑起来”的项目模板，更是一套强调工程闭环的研发基座：让接口有契约，让模块有边界，让质量有护栏，让交付有反馈，让系统可持续演进。

---

## 核心理念

- TypeScript-first：类型即契约，降低沟通、联调与维护成本。

- NestJS-native：模块化、依赖注入、可测试、可扩展。

- Harness Engineering：以自动化、可观测、可验证、可迭代为主线，构建工程反馈闭环。

- Backfront 协同：连接 Backend 与 Frontend，统一工程规范与交付流程。

---

## 工程亮点

- 以 NestJS + TypeScript 构建强类型、模块化、可测试的服务端基座。

- 将 Harness Engineering 理念贯穿开发、测试、构建、发布与观测全流程。

- 通过自动化护栏、质量门禁与反馈回路，让问题更早暴露、更快修复。

- 支持从工程模板到业务平台、从模块化单体到微服务的平滑演进。

- 强调可复制、可度量、可持续改进的研发工作方式。

---

## 📚 项目结构 & 文档导航

| 文档                                                                        | 说明                 |
| --------------------------------------------------------------------------- | -------------------- |
| 文档总入口见 [docs/index.md](docs/index.md)                                 | 文档总索引           |
| 详细架构请见 [docs/architecture/overview.md](docs/architecture/overview.md) |
| 运维手册 [docs/runbooks/README.md](docs/runbooks/README.md)                 | 部署、回滚等运维手册 |

---

## 🛠️ 开发指南

- 代码风格：ESLint + Prettier
- 提交规范：Conventional Commits
- 分支策略：Trunk Based / Git Flow
- CI/CD：GitHub Actions / Harness Pipeline
- 部署与回滚见 [docs/runbooks/](docs/runbooks/)

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18 LTS
- Pnpm >= 9.x
- Cursor
- MongoDB >= 6.x
- Redis >= 7.x
- Docker + Docker Compose（推荐）

### 安装依赖

```bash
$ pnpm install
```

### 运行项目

```bash
# development
$ pnpm run start:local

# uat
$ pnpm run start:uat

# production
$ pnpm run start:prod
```

### 内置模版快速生成

```bash
# 通过prompts可以自己选择创建类型，定义在script/new.js里面
pnpm run new
```

## 执行测试用例

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## 打包构建

```bash
# development
$ pnpm run build:local

# uat
$ pnpm run build:uat

# production
$ pnpm run build:prod
```

## 提交代码

```bash
# cmd
$ pnpm commit
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。  
贡献前请阅读 [README.md](README.md)。

---

## 📄 许可证

私有 / 待定 © 2026 简单博客系统
