# Headroom 安装

> 返回入口：[Headroom 使用指南](./README.md)

## 前置条件

- Python 3.10+（推荐 3.13）
- 推荐使用 `uv` 管理 Python 工具链
- Cursor 已安装并可用

## 方式一：uv 安装（推荐）

```bash
uv tool install --python 3.13 "headroom-ai[all]"
headroom --version
```

如果安装成功但 `headroom` 不在 PATH 中，运行：

```bash
uv tool update-shell
```

## 方式二：pip 安装

```bash
# 核心包
pip install headroom-ai

# 含代理服务器
pip install "headroom-ai[proxy]"

# 全部功能
pip install "headroom-ai[all]"
```

## 方式三：Docker-native（主机无需 Python/Node）

```bash
curl -fsSL https://raw.githubusercontent.com/chopratejas/headroom/main/scripts/install.sh | bash
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/chopratejas/headroom/main/scripts/install.ps1 | iex
```

## 方式四：TypeScript / Node.js

```bash
npm install headroom-ai
```

## 验证

```bash
headroom --version
```

启动代理后，可验证代理运行状态：

```bash
curl http://localhost:8787/health
```

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
