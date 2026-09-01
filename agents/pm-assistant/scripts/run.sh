#!/usr/bin/env bash
# pm-assistant setup / status
#
# Usage:
#   ./scripts/run.sh            — first-time setup (idempotent, never overwrites)
#   ./scripts/run.sh status     — read-only backlog overview
#
# pm-assistant keeps ALL its data in personal/pm-assistant/ (gitignored).
# This script seeds that private home from the committed templates and prints
# the suggested Claude Code invocations. It does NOT directly invoke subagents —
# Claude Code does that based on the agent files in .claude/agents/.

set -euo pipefail

MODE="${1:-setup}"

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DATA_DIR="$WORKSPACE_ROOT/personal/pm-assistant"
TPL_DIR="$WORKSPACE_ROOT/agents/pm-assistant/templates"
TODAY="$(date +%F)"

if [ "$MODE" = "status" ]; then
    if [ ! -f "$DATA_DIR/backlog.md" ]; then
        echo "No backlog yet — run ./scripts/run.sh first."
        exit 1
    fi
    echo "================================================================"
    echo "  pm-assistant — backlog status ($TODAY)"
    echo "================================================================"
    for section in Now Next Later Waiting; do
        count="$(awk "/^## $section/{flag=1; next} /^## /{flag=0} flag && /^- \[/" "$DATA_DIR/backlog.md" | wc -l | tr -d ' ')"
        echo "  $section: $count"
    done
    if [ -f "$DATA_DIR/log/$TODAY.md" ]; then
        echo "  Today's log: personal/pm-assistant/log/$TODAY.md"
    else
        echo "  Today's log: none yet — say \"daily check-in\" to start the day"
    fi
    echo "================================================================"
    exit 0
fi

if [ "$MODE" != "setup" ]; then
    echo "Usage: $0 [status]"
    exit 1
fi

echo "================================================================"
echo "  pm-assistant setup"
echo "================================================================"
echo "  Private home:  $DATA_DIR (gitignored)"
echo ""

mkdir -p "$DATA_DIR/log"

for f in backlog.md routines.md context.md; do
    if [ -f "$DATA_DIR/$f" ]; then
        echo "  exists, skipped: $f"
    else
        cp "$TPL_DIR/$f" "$DATA_DIR/$f"
        echo "  created: $f"
    fi
done

echo ""
echo "Next: fill in personal/pm-assistant/context.md (timezone, focus, preferences)."
echo ""
echo "Then talk to the assistant in a Claude Code session (cd $WORKSPACE_ROOT):"
echo ""
echo "  Quick ops (conversational, no subagent):"
echo "    \"add a task: <title>, due <date>\""
echo "    \"mark T-NNN done\" / \"drop T-NNN\""
echo "    \"show my backlog\" / \"what's on my plate today?\""
echo "    \"delegate T-NNN to <agent or skill>\""
echo ""
echo "  Routines (subagents):"
echo "    /agent daily-planner \"date: $TODAY\""
echo "      Output: personal/pm-assistant/log/$TODAY.md (morning section)"
echo "    /agent day-reviewer \"date: $TODAY\""
echo "      Output: personal/pm-assistant/log/$TODAY.md (end-of-day section)"
echo "    /agent backlog-groomer"
echo "      Output: grooming report in today's log; backlog.md untouched"
echo ""
echo "  Routines PROPOSE backlog moves — the orchestrator applies them only"
echo "  after you confirm."
echo "================================================================"
