# 规则自定义

> 返回入口：[Open Code Review 使用指南](./README.md)

## 内置规则

OCR 内置了一套针对代码审查优化的规则体系，包括：

- 空指针风险（NPE）
- SQL 注入
- XSS 漏洞
- 线程安全问题
- 参数校验缺失
- Mapper SQL 配置错误

## 规则文件层级

OCR 支持三层规则覆盖，优先级从高到低：

1. **CLI `--rule` 参数**（最高优先级）
2. **项目级规则**：`<repo>/.opencodereview/rule.json`
3. **用户级规则**：`~/.opencodereview/rule.json`

## 规则文件格式

```json
{
  "include": ["src/**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "rules": [
    {
      "id": "custom-rule-1",
      "description": "检查 console.log 是否遗留",
      "severity": "warning",
      "content": "确保提交前删除所有 console.log 语句"
    }
  ]
}
```

### 字段说明

| 字段      | 必填 | 说明                                                                          |
| --------- | ---- | ----------------------------------------------------------------------------- |
| `include` | 否   | Glob 模式列表，作用是**跳过内建默认排除模式**（如测试文件排除）。它不是白名单 |
| `exclude` | 否   | OCR 不应审查的文件的 Glob 模式                                                |
| `rules`   | 是   | 自定义规则列表                                                                |

### 规则文件限制

- 文件必须通过验证：扩展名在白名单内
- 文件大小 ≤ 512 KB
- 解析后的符号链接目标也必须在白名单扩展名内
- 规则文件支持引用 `.md` / `.txt` 路径

## include / exclude 优先级

文件过滤按以下优先级链执行：

1. **用户自定义 exclude 模式** —— 丢弃。显式 exclude 始终优先于显式 include。
2. **用户自定义 include 模式** —— 如果已定义且匹配，立即保留文件，跳过后续默认模式检查。
3. **内建默认 exclude 模式** —— 过滤测试文件等。

`include` 和 `exclude` 遵循与审查规则相同的优先级链：`--rule` > 项目配置 > 全局配置。

## 检查文件适用的规则

```bash
ocr rules check <path>
```

打印命中的层级和适用的规则。

## 自定义规则示例

### 禁止使用 `var`

```json
{
  "rules": [
    {
      "id": "no-var",
      "description": "禁止使用 var 声明变量",
      "severity": "error",
      "content": "使用 let 或 const 替代 var"
    }
  ]
}
```

### 强制函数注释

```json
{
  "rules": [
    {
      "id": "require-jsdoc",
      "description": "公共函数必须有 JSDoc 注释",
      "severity": "warning",
      "content": "为导出的函数添加 JSDoc 注释"
    }
  ]
}
```

## 常见问题

### 自定义规则未生效

1. 确认规则文件路径正确
2. 运行 `ocr rules check <file>` 查看命中的层级
3. 检查是否有更高优先级的规则文件覆盖
4. 确认 `include` / `exclude` 模式是否匹配目标文件

### Brace expansion 不工作

OCR 的 Glob 模式不支持 Bash 风格的 brace expansion。使用 `src/**/*.{ts,tsx}` 格式。

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
