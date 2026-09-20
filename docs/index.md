# 文档总索引

> 本文件是【ai-blog-backtend】的文档总入口。

## 📚 文档导航

| 文档区域      | 路径                                                 | 说明                         |
| ------------- | ---------------------------------------------------- | ---------------------------- |
| 项目根 README | [../README.md](../README.md)                         | 项目简介、快速开始、目录概览 |
| 系统架构      | [architecture/README.md](architecture/README.md)     | 整体架构、模块划分、关键流程 |
| 架构概览      | [architecture/overview.md](architecture/overview.md) | 系统上下文、容器视图、技术栈 |
| 运维手册      | [runbooks/README.md](runbooks/README.md)             | 部署、回滚、故障处理         |

---

## 🗂️ 目录结构

```text
ai-blog-backtend/
├── README.md                 # 本文件
├── docs/
│   ├── index.md              # 文档总索引
│   ├── architecture/         # 系统架构
│   │   ├── README.md
│   │   ├── overview.md       # 架构概览
│   └── runbooks/             # 运维手册
│       ├── README.md
│       ├── deploy.md
│       └── rollback.md
├── src/                      # 源代码
├── test/                     # 测试
├── scripts/                  # 辅助脚本
├── package.json              # 包管理
├── .husky/                   # 代码提交拦截
├── .gitignore                # git 提交忽略
├── tsconfig.json             # typescript 配置
├── tsconfig.build.json       # typescript 打包配置
├── nest-cli.json             # nestjs 打包
├── README.md                 # 项目说明文档
├── .prettierrc               # prettier 格式化配置
├── .eslintrc.js              # eslint 格式化配置
├── .lintstagedrc.json        # lint-staged 格式化配置
├── commitlint.config.js      # cz-git & commitizen 配置
├── .env.local                # 本地环境配置 配置
├── .env.uat                  # uat测试环境配置 配置
├── .env.production           # 生产环境配置 配置
├── _templates                # 模版快速生成
└── LICENSE                   # 开源协议

```

---

## 📌 文档维护规则

- 本索引 `docs/index.md` 是文档总入口，新增文档后必须更新本文件。
- 每个子目录都有自己的 `README.md` 作为局部索引。

---

## 📅 更新记录

| 日期       | 变更           | 负责人 |
| ---------- | -------------- | ------ |
| 2026-09-21 | 创建文档总索引 | 架构组 |
