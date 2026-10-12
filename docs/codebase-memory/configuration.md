# codebase-memory-mcp 索引文件位置与跨平台配置

> 返回入口：[Codebase-memory-mcp 使用指南](./README.md)

## 2.1 默认索引存储位置

codebase-memory-mcp 的索引默认存储在用户缓存目录下：

| 操作系统      | 默认路径                                                                             |
| ------------- | ------------------------------------------------------------------------------------ |
| macOS / Linux | `~/.cache/codebase-memory-mcp/`                                                      |
| Windows       | `%USERPROFILE%\.cache\codebase-memory-mcp\` 或 `%LOCALAPPDATA%\codebase-memory-mcp\` |

所有项目索引和配置都存储在此目录下，服务器内部按项目名称分区管理[reference:0]。每个项目的索引文件命名为 `<project>.db`，例如 `my-project.db`。

**配置文件也存储在同一目录下：**

| 文件                  | 用途                               |
| --------------------- | ---------------------------------- |
| `<project>.db`        | 项目知识图谱数据库                 |
| `_config.db`          | CLI 管理的运行时设置               |
| `config.json`         | UI 设置（`ui_enabled`、`ui_port`） |
| `logs/cbm-daemon.log` | 守护进程运行日志                   |

## 2.2 通过 `CBM_CACHE_DIR` 自定义存储位置

使用环境变量 `CBM_CACHE_DIR` 可以覆盖默认的数据库存储目录。所有项目索引和配置都将存储在此目录下[reference:4]。

### 方式一：使用相对路径（仓库本地存储，推荐团队共享）

将索引存储在仓库内的 `.codebase-memory/` 目录中，方便团队共享：

**macOS / Linux：**

```bash
export CBM_CACHE_DIR=".codebase-memory"
```

**Windows（PowerShell）：**

```powershell
$env:CBM_CACHE_DIR = ".\.codebase-memory"
```

**Windows（CMD）：**

```cmd
set CBM_CACHE_DIR=.\.codebase-memory
```

设置后，索引文件将写入 `<repo>/.codebase-memory/` 目录，该目录应加入 `.gitignore` 或通过 `persistence: true` 导出为可提交的 `graph.db.zst` 快照。

### 方式二：使用绝对路径（自定义存储目录）

**macOS / Linux：**

```bash
export CBM_CACHE_DIR=~/my-projects/cbm-data
```

**Windows（PowerShell）：**

```powershell
$env:CBM_CACHE_DIR = "$HOME\my-projects\cbm-data"
```

### 方式三：在 MCP 配置中直接指定（推荐，无需修改系统环境变量）

在 `.cursor/mcp.json` 中通过 `env` 字段设置，只对当前项目生效：

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "codebase-memory-mcp",
      "args": [],
      "env": {
        "CBM_CACHE_DIR": ".codebase-memory"
      }
    }
  }
}
```

前提是需要 headroom 配置全局路径，验证如下

```bash
#codebase-memory-mcp --version
codebase-memory-mcp 0.10.8
```

这种方式**无需修改系统环境变量**，且配置随项目文件一起提交，团队所有成员自动生效。

## 2.3 macOS 与 Windows 的配置差异

| 对比项           | macOS / Linux                             | Windows                                                                             |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| 默认缓存目录     | `~/.cache/codebase-memory-mcp/`           | `%USERPROFILE%\.cache\codebase-memory-mcp\`                                         |
| 环境变量设置命令 | `export CBM_CACHE_DIR=...`                | `$env:CBM_CACHE_DIR = ...`（PowerShell）                                            |
| 路径分隔符       | `/`                                       | `\`（PowerShell/CMD）/ `/`（Git Bash）                                              |
| 相对路径         | `.codebase-memory`                        | `.\.codebase-memory`（PowerShell）/ `.codebase-memory`（Git Bash）                  |
| 二进制文件       | `codebase-memory-mcp`                     | `codebase-memory-mcp.exe`                                                           |
| 配置检测路径     | `$HOME/Library/Application Support/Code/` | `%APPDATA%/Code/`[reference:5]                                                      |
| 安装脚本         | `setup.sh`                                | `setup-windows.ps1`                                                                 |
| 自更新机制       | 二进制可原地替换                          | 需通过 `install.ps1` 更新，因为 Windows 运行中的可执行文件无法替换自身[reference:6] |

**Windows 注意事项：**

- Windows 下 `CBM_CACHE_DIR` 中的非 ASCII 字符（如中文路径）会被错误解码，导致服务器静默使用不同的路径。建议使用纯 ASCII 路径[reference:7]。
- 如使用 Git Bash，路径分隔符使用 `/`，与 macOS/Linux 一致；PowerShell 和 CMD 中使用 `\`。
- 设置环境变量后需**重启 Cursor** 才能生效。

## 2.4 在 Cursor 中的完整配置示例

**项目级配置（`.cursor/mcp.json`）：**

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "codebase-memory-mcp",
      "args": [],
      "env": {
        "CBM_CACHE_DIR": ".codebase-memory"
      }
    }
  }
}
```

**Windows 项目级配置（`.cursor/mcp.json`）：**

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "C:\\Users\\username\\.local\\bin\\codebase-memory-mcp.exe",
      "args": [],
      "env": {
        "CBM_CACHE_DIR": ".codebase-memory"
      }
    }
  }
}
```

> Windows 下推荐使用绝对路径指定二进制文件，因为 GUI 应用（Cursor）不会继承 Shell 的 `PATH`。

**全局配置（`~/.cursor/mcp.json`）：**

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "codebase-memory-mcp",
      "args": [],
      "env": {
        "CBM_CACHE_DIR": "~/.cache/codebase-memory-mcp"
      }
    }
  }
}
```

Cursor 使用与 Claude Desktop 相同的 `mcpServers` schema，项目级配置优先于全局配置[reference:8]。

## 2.5 存储位置选择建议

| 场景         | 推荐 `CBM_CACHE_DIR`   | 说明                             |
| ------------ | ---------------------- | -------------------------------- |
| 个人开发     | 默认（不设置）         | 所有项目共享缓存，按项目自动分区 |
| 团队共享索引 | `.codebase-memory`     | 索引随仓库提交，队友无需重新索引 |
| 多项目隔离   | `~/cbm-data/<project>` | 每个项目独立目录，便于管理       |
| CI/CD 环境   | `/tmp/cbm-cache`       | 临时目录，构建完成后清理         |

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
