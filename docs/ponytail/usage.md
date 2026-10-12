# 使用

> 返回入口：[Ponytail 使用指南](./README.md)

## 核心机制：七级决策阶梯

Ponytail 的全部逻辑是一个七级阶梯，AI 写代码前从上往下走，停在第一个成立的台阶上：

| 级别 | 决策                         | 示例                                   |
| ---- | ---------------------------- | -------------------------------------- |
| 1    | 这东西真的需要存在吗？       | YAGNI，不需要就跳过                    |
| 2    | 这个仓库里已经有了吗？       | 有就复用，别重写                       |
| 3    | 标准库能做吗？               | `datetime` 而不是 moment.js            |
| 4    | 浏览器 / 操作系统原生能力？  | `<input type="date">` 而不是 flatpickr |
| 5    | 已安装的依赖里有吗？         | 检查 `node_modules` / `go.mod`         |
| 6    | 能一行搞定吗？               | 一行 if 而不是策略模式                 |
| 7    | 以上都不行，才写最少的新代码 | 最小实现                               |

## 强度级别

| 级别      | 命令                | 行为                                                          |
| --------- | ------------------- | ------------------------------------------------------------- |
| **lite**  | `/ponytail lite`    | 按需求实现，但额外用一行指出更懒的替代方案，由用户决定        |
| **full**  | `/ponytail`（默认） | 严格执行决策阶梯：YAGNI → 标准库 → 原生能力 → 一行 → 最小实现 |
| **ultra** | `/ponytail ultra`   | YAGNI 极端主义，先删除再添加                                  |

## 关闭 Ponytail

```text
stop ponytail
```

或

```text
normal mode
```

## 配套命令

| 命令               | 用途                                           |
| ------------------ | ---------------------------------------------- |
| `/ponytail`        | 默认 full 模式，激活懒人规则                   |
| `/ponytail-review` | 审查当前改动中的过度工程，给出“可以删掉”的清单 |
| `/ponytail-audit`  | 扫描整个仓库，找出所有过度工程的地方           |
| `/ponytail-debt`   | 管理技术债                                     |
| `/ponytail-gain`   | 量化收益记分板                                 |
| `/ponytail-help`   | 显示所有可用命令的快速参考卡                   |

## 工作流

### 写代码

```text
/ponytail
写一个日期选择器
```

Ponytail 会输出：

```html
<!-- ponytail: browser has one -->
<input type="date" />
```

而不是装 flatpickr、写 wrapper 组件、加样式表、讨论时区。

### 审查代码

```text
/ponytail-review
```

审查当前改动，输出每条发现一行：位置、该删什么、用什么替代。

### 审计仓库

```text
/ponytail-audit
```

扫描整个仓库，找出重新发明标准库、多余依赖、投机性抽象、无用灵活性等问题。

### 查看收益

```text
/ponytail-gain
```

显示量化收益记分板：代码行数、成本、时间相对无 Skill 基线的变化。

## 与其他 Skill 配合

Ponytail 管你**写什么**，不管你怎么**说话**。如果需要简洁的表达风格，可以搭配 [Caveman](https://github.com/JuliusBrussee/caveman)。

```text
/ponytail full
/caveman full
```

两者互补：Ponytail 压代码量，Caveman 压输出 Token。

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
