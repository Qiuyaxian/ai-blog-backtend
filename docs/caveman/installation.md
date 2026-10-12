# 安装

> 返回入口：[Caveman 使用指南](./README.md)

## 安装教程

### 方式一：一行命令（自动检测所有已安装的 Agent）

**macOS / Linux / WSL / Git Bash：**

```bash
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash
```

**Windows（PowerShell 5.1+）：**

```powershell
irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex
```

安装脚本会自动检测你机器上已安装的 AI 编码代理（Claude Code、Cursor、Codex 等），并为每个代理执行对应的原生安装路径。

### 方式二：仅安装到 Cursor

```bash
npx skills add JuliusBrussee/caveman -a cursor
```

默认情况下，Caveman 在 Cursor 中是**按会话激活**的，每次新会话需要输入 `/caveman` 来启用。  
如需**始终开启**，添加 `--with-init` 参数：

```bash
npx skills add JuliusBrussee/caveman -a cursor --with-init
```

`--with-init` 会向当前仓库写入一个 always-on 规则文件（`.cursor/rules/caveman.mdc`）。

### 方式三：MCP Server（无需分发文件）

通过 MCP 协议接入，一次注册即可在任何 MCP 兼容的代理中使用：

```bash
pip install caveman-mcp
```

然后在 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "caveman-mcp": {
      "command": "uvx",
      "args": ["caveman-mcp"]
    }
  }
}
```

### 验证安装

安装完成后，在 Cursor 的聊天面板中输入：

```text
/caveman
```

如果 Caveman 已正确安装，AI 的回复风格会切换为压缩模式。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
