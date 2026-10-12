# Skills 详解

> 返回入口：[Ponytail 使用指南](./README.md)

Ponytail 的本体是 6 个 Skill，安装后在 `~/.claude/plugins/cache/ponytail/skills/` 下可以看到六个目录，每个对应一条 `/ponytail-*` 命令。

## ponytail

**描述：** 强制使用最懒、最简单、最短、最小化的可行方案。YAGNI、标准库优先、不做未被要求的抽象。

**适用：** 任何编码任务——写、加、重构、修、审查、设计代码、选择库或依赖。

**触发词：** `ponytail`、`be lazy`、`shortest path`

**关闭：** `stop ponytail` / `normal mode`

**不适用：** 非编码请求（通用知识、散文、翻译、摘要、食谱）。

## ponytail-review

**描述：** 专注于过度工程的代码审查。找出该删除的内容：重新发明标准库、不必要的依赖、投机性抽象、无用的灵活性。

**输出格式：** 每条发现一行——位置、该切什么、用什么替代。

## ponytail-audit

**描述：** 扫描整个仓库，找出所有过度工程的地方。

## ponytail-debt

**描述：** 管理技术债。

## ponytail-gain

**描述：** 量化收益记分板。显示代码行数、成本、时间相对无 Skill 基线的变化。

## ponytail-help

**描述：** 所有 Ponytail 模式、Skill 和命令的快速参考卡。一次性显示，不是持久模式。

**触发：** `/ponytail-help`、`ponytail help`、`what ponytail commands`、`how do I use ponytail`

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
