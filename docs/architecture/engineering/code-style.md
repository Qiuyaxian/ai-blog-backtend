# 团队代码规范（ESLint + Prettier）

> 本文只讲工具链配置与格式化；编码层约定（命名、分层、DTO、错误处理）见
> [开发规范](../../development/coding-style.md)，横切规范见
> [架构编码规范](../development-standards.md)。

## 职责划分

- ESLint：代码质量与潜在错误。
- Prettier：只负责格式化，不参与质量判断（通过 `eslint-config-prettier` 关闭与格式冲突的规则）。
- 保存时由编辑器自动格式化；提交时由 lint-staged 对暂存文件再跑一遍（见 [git-hooks.md](./git-hooks.md)）。

## 依赖

已在 `devDependencies` 中，无需新增：

- `eslint@8` + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
- `eslint-plugin-prettier` + `eslint-config-prettier` + `prettier@2`

## ESLint 配置

仓库使用旧式配置文件 `.eslintrc.js`（非 flat config）：

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
```

> 配置以仓库根目录 `.eslintrc.js` 实际内容为准，修改规则直接改该文件，本文不复制第二份。

## Prettier 配置

`.prettierrc`（以文件实际内容为准）：

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

Prettier 只格式化 TS 源码与测试目录，命令见 `package.json`：

```bash
pnpm run format    # prettier --write "src/**/*.ts" "test/**/*.ts"
pnpm run lint      # eslint "{src,apps,libs,test}/**/*.ts" --fix
```

## VSCode 推荐配置

`.vscode/settings.json`

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## 约定

- 禁止提交未格式化的代码（pre-commit 会自动处理，处理不了的报错需修掉）。
- 禁止绕过 ESLint 错误；确需关闭某条规则时，行内注释写明原因。
- 新增/放宽规则前先团队讨论，避免大面积格式化噪音。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：按仓库真实配置重写（旧式 .eslintrc.js、prettier@2、实际 scripts），删除前端/Vue 模板残留。
