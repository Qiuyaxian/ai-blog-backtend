#!/bin/bash
# 该脚本用于硬阻断：当设计文档不存在或未获批时，阻止代码写入。

# 读取 Cursor 传入的 JSON 输入（必须读取，否则可能导致挂起）
input=$(cat)

DESIGN_APPROVAL_FILE=".cursor/.design-approved"

# 检查批准标记文件是否存在
if [ ! -f "$DESIGN_APPROVAL_FILE" ]; then
    # 返回 deny 来阻止工具执行，并给出明确原因
    echo '{
        "permission": "deny",
        "user_message": "HARD-GATE BLOCKED: 设计尚未获得批准。请先完成 brainstorming 流程，并创建 .cursor/.design-approved 文件以解锁实现阶段。"
    }'
    exit 0
fi

# 如果存在批准文件，允许操作
echo '{"permission": "allow"}'
exit 0