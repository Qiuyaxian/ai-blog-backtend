# 安装

> 返回入口：[Open Code Review 使用指南](./README.md)

## 前置条件

- Node.js ≥ 22.5
- Git ≥ 2.41
- 一个 OpenAI 兼容或 Anthropic 兼容的 LLM API Key

## 方式一：NPM 安装（推荐）

```bash
npm install -g @alibaba-group/open-code-review
```

安装后 `ocr` 命令全局可用。

安装指定版本：

```bash
npm install -g @alibaba-group/open-code-review@<version>
```

如果安装过程中遇到网络问题，可先配置 npm 代理：

```bash
npm config set proxy http://127.0.0.1:7890
npm config set https-proxy http://127.0.0.1:7890
```

OCR 使用 Node 内置 SQLite，没有原生模块需要编译，因此在 npm、pnpm 10+、yarn 下都能干净安装。

## 方式二：Homebrew（macOS / Linux）

```bash
brew install alibaba/tap/open-code-review
```

## 方式三：MacPorts

```bash
sudo port install open-code-review
```

## 方式四：一键安装脚本（macOS / Linux / WSL）

```bash
curl -fsSL https://raw.githubusercontent.com/alibaba/open-code-review/main/install.sh | sh
```

## 方式五：GitHub Release 二进制

从 [Releases 页面](https://github.com/alibaba/open-code-review/releases) 下载对应平台的二进制文件。

**Windows：**

将 `ocr.exe` 添加到 PATH 环境变量中。

**macOS / Linux：**

```bash
chmod +x ocr && sudo mv ocr /usr/local/bin/ocr
```

## 方式六：PowerShell 脚本（Windows）

```powershell
irm https://raw.githubusercontent.com/alibaba/open-code-review/main/install.ps1 | iex
```

## 验证安装

```bash
ocr version
```

应输出版本号、commit、平台、构建日期和 GitHub URL。

## 自动更新机制

OCR 默认会在后台检查更新。可通过以下环境变量控制：

| 环境变量              | 说明                         |
| --------------------- | ---------------------------- |
| `OCR_UPDATE_INTERVAL` | 更新检查间隔                 |
| `OCR_NO_UPDATE`       | 设为任意值可禁用自动更新检查 |

## 支持的平台

| 平台     | 状态 |
| -------- | ---- |
| Windows  | 支持 |
| macOS    | 支持 |
| Linux    | 支持 |
| WSL      | 支持 |
| Git Bash | 支持 |

## 升级

```bash
npm install -g @alibaba-group/open-code-review@latest
```

## 卸载

```bash
npm uninstall -g @alibaba-group/open-code-review
```

同时删除配置文件：

```bash
rm -rf ~/.opencodereview
```

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
