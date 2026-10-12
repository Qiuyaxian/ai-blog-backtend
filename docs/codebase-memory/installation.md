# codebase-memory-mcp 安装

> 返回入口：[Codebase-memory-mcp 使用指南](./README.md)

## 前置条件

- 支持的操作系统：macOS（arm64/amd64）、Linux（arm64/amd64）、Windows（amd64）
- 无需安装运行时环境（Go、Python、Node.js 均可选）

## 方式一：一键安装脚本（推荐）

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/scripts/setup.sh | bash
```

**Windows（PowerShell）：**

```powershell
irm https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/scripts/setup-windows.ps1 | iex
```

脚本会自动下载对应平台的二进制文件并完成安装。

## 方式二：npm 全局安装

```bash
npm install -g codebase-memory-mcp
```

安装后运行 `codebase-memory-mcp install`，它会自动检测并配置所有已安装的 Agent。

## 方式三：从源码构建

前提条件：C 编译器（gcc 或 clang）、C++ 编译器、zlib、Git。

```bash
git clone https://github.com/DeusData/codebase-memory-mcp.git
cd codebase-memory-mcp
scripts/build.sh          # 标准二进制
scripts/build.sh --with-ui  # 带图可视化
# 二进制位置：build/c/codebase-memory-mcp
```

## 方式四：Arch Linux（AUR）

```bash
yay -S codebase-memory-mcp-bin
# 或
paru -S codebase-memory-mcp-bin
```

## 验证安装

```bash
codebase-memory-mcp --version
```

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
