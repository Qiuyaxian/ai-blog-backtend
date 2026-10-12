# Ponytail

> 让 AI 编程 Agent 像“房间里最懒的资深工程师”一样思考。  
> 最好的代码，是你根本没写的代码。  
> ~54% 更少代码（最高 94%）· ~20% 更便宜 · ~27% 更快 · 100% 安全。

## AI 阅读指引

- 涉及 Ponytail 时，先读本文件。
- 不要预读本目录下所有文件。
- 根据任务，按下表只读取相关子文件。
- 本文件已能回答时，不要继续读子文件。

## 按需阅读

| 当任务涉及                     | 读取文件                                   |
| ------------------------------ | ------------------------------------------ |
| 安装、验证、支持的 Agent 平台  | [installation.md](./installation.md)       |
| 命令、模式、七级阶梯、工作流   | [usage.md](./usage.md)                     |
| 六个 Skill 的详细说明          | [skills.md](./skills.md)                   |
| Before/After 示例、量化收益    | [examples.md](./examples.md)               |
| 常见问题、安全边界、Agent 适配 | [troubleshooting.md](./troubleshooting.md) |
| 项目背景、基准数据、外部链接   | [reference.md](./reference.md)             |

## 快速开始

### 前置条件

- Node.js 需在 PATH 中（Claude Code / Codex 插件依赖 Node 生命周期钩子）
- 一个支持插件或 Skill 的 AI 编码 Agent（Claude Code、Codex 等）

### 安装（Claude Code）

第一条，注册插件市场：

```text
/plugin marketplace add DietrichGebert/ponytail
```

等它执行完，新起一轮再发第二条：

```text
/plugin install ponytail@ponytail
```

> 两条命令必须分两次发送，写在同一 prompt 里会失败。

### 验证

```text
/ponytail-help
```

能列出六个命令即安装成功。

### 基本使用

```text
/ponytail              # 默认 full 模式
/ponytail lite         # 轻量提示替代方案
/ponytail ultra        # YAGNI 极端主义
stop ponytail          # 关闭
```

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
