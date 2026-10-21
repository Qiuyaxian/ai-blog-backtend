# 文档总索引

> 本文件是【ai-blog-backtend】的文档总入口。

## 📚 文档导航

- [项目根 README](../README.md)
- [项目上下文 context.md](./context.md)（跨会话动态记忆）
- [架构索引](./architecture/README.md)
- [架构总览](./architecture/overview.md)
- [ADR 索引](./architecture/README.md#adr-索引)
- [开发指南](./development/development.md)
- [开发规范](./development/coding-style.md)
- [运维手册](./operations/README.md)
- [问题记录](./issues/README.md)
- [Ponytail 手册](./ponytail/README.md)
- [Headroom 手册](./headroom/README.md)
- [Caveman 手册](./caveman/README.md)
- [Codebase-Memory 手册](./codebase-memory/README.md)
- [Open-Code-Review 手册](./open-code-review/README.md)
- [Harness 多 Agent 手册](./harness/README.md)（多角色协作、指令手册、自进化机制）

---

## 📌 文档维护规则

- 本索引 `docs/index.md` 是文档总入口，新增文档后必须更新本文件。
- 每个子目录都有自己的 `README.md` 作为局部索引。
- 每个文件需要维护文末「更新记录」，只记重要变更（最新在上），格式：`YYYY-MM-DD @负责人：变更说明`；完整历史见 Git。

---

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-22 @架构组：新增 Harness 多 Agent 手册（四角色、指令、工作流映射、自进化机制）。
- 2026-10-12 @架构组：文档去重与事实统一——monitoring.md 并入 observability.md；engineering/ 5 篇按真实配置重写；修复坏链/导航/ADR 索引；统一 Node 20、SLO 99.9%、env 自动加载等口径；清理 changelog 样板条目。
