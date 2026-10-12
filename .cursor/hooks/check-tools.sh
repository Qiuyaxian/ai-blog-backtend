#!/usr/bin/env bash
# scripts/check-tools.sh
# 在 Cursor sessionStart 时运行，检测各工具初始化状态。
# 输出写入 .cursor/rules/000-tool-status.mdc，由 alwaysApply 注入。

set -euo pipefail

RULES_DIR=".cursor/rules"
STATUS_FILE="$RULES_DIR/000-tool-status.mdc"
mkdir -p "$RULES_DIR"

# 收集状态
PONYTAIL="❌ 未初始化"
MEMORY="❌ 未初始化"
HEADROOM="❌ 未初始化"
CAVEMAN="❌ 未初始化"
OCR="❌ 未初始化"

# 1. Ponytail：检查规则文件是否存在且包含七级阶梯关键词
if [ -f ".cursor/rules/ponytail.mdc" ]; then
  if grep -q "YAGNI" ".cursor/rules/ponytail.mdc" 2>/dev/null; then
    PONYTAIL="✅ 已初始化"
  else
    PONYTAIL="⚠️ 规则文件存在但内容不完整"
  fi
fi

# 2. Codebase Memory：新版 Cursor 无 .cursorrules，以 MCP server 为准；
#    旧版回退到 .cursorrules 或 .cursor/rules/codebase-memory.mdc
if { command -v codebase-memory-mcp >/dev/null 2>&1 || \
     { [ -f ".cursor/mcp.json" ] && grep -q "codebase-memory" ".cursor/mcp.json"; }; } \
   && [ -d ".codebase-memory" ]; then
  MEMORY="✅ 已初始化（MCP server + .codebase-memory 数据目录）"
elif [ -f ".cursorrules" ] || [ -f ".cursor/rules/codebase-memory.mdc" ]; then
  MEMORY="✅ 已初始化（旧版文件规则）"
fi

# 3. Headroom：优先认 MCP 配置（headroom mcp serve），回退 CLI / 配置目录
if [ -f ".cursor/mcp.json" ] && grep -q '"headroom"' ".cursor/mcp.json" && command -v headroom >/dev/null 2>&1; then
  HEADROOM="✅ 已初始化（MCP 已配置）"
elif command -v headroom >/dev/null 2>&1; then
  HEADROOM="⚠️ CLI 已安装但 MCP 未配置"
elif [ -f ".headroom/config.json" ] || [ -f "$HOME/.config/headroom/config.json" ]; then
  HEADROOM="✅ 已初始化（配置文件）"
fi

# 4. Caveman：检查 rules 目录下是否有 caveman 规则
if [ -f ".cursor/rules/caveman.mdc" ]; then
  CAVEMAN="✅ 已初始化（always-on 模式）"
elif [ -f "$HOME/.claude/plugins/cache/caveman/rules/caveman-activate.md" ]; then
  CAVEMAN="⚠️ 已安装但未生成常驻规则（需 /caveman 手动激活）"
fi

# 5. Open Code Review：委托模式下 delegate skill 即可驱动，ocr CLI 非必需；
#    无 skill 时再检查独立 CLI 模式
if [ -e ".agents/skills/open-code-review-delegate" ]; then
  if command -v ocr >/dev/null 2>&1; then
    OCR="✅ 已初始化（delegate skill + ocr CLI）"
  else
    OCR="✅ 已初始化（delegate skill，委托模式无需 ocr CLI）"
  fi
elif command -v ocr >/dev/null 2>&1; then
  if [ -f ".cursor/mcp.json" ] && grep -q "open-code-review" ".cursor/mcp.json" 2>/dev/null; then
    OCR="✅ CLI 已安装 + MCP 已配置"
  else
    OCR="⚠️ CLI 已安装但 MCP 未配置"
  fi
fi

# 写入状态规则文件
cat > "$STATUS_FILE" <<EOF
---
description: 工具初始化状态检查（sessionStart 自动生成）
alwaysApply: true
---

# 工具状态（本次会话启动时检测）

| 工具 | 状态 | 检查方式 |
|---|---|---|
| Ponytail | $PONYTAIL | \`.cursor/rules/ponytail.mdc\` |
| Codebase Memory | $MEMORY | MCP \`codebase-memory-mcp\` / \`.codebase-memory\`（旧版回退 \`.cursorrules\`） |
| Headroom | $HEADROOM | \`.cursor/mcp.json\` 中 \`headroom\` server / CLI |
| Caveman | $CAVEMAN | \`.cursor/rules/caveman.mdc\` |
| Open Code Review | $OCR | \`ocr\` CLI / \`.cursor/mcp.json\` |

## 给 AI 的指令

- 如果任何工具显示 ❌ 或 ⚠️，在首次回复中**明确告知用户**，并给出初始化步骤。
- 不要静默忽略未初始化的工具。
- 如果全部显示 ✅，不要额外提及，正常执行任务。
EOF

echo "工具状态已写入 $STATUS_FILE"