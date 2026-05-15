#!/usr/bin/env bash
# Entry point for running the agent on a specific Jira task.
#
# Usage:
#   ./scripts/run-agent.sh https://your-company.atlassian.net/browse/PROJ-1234
#   ./scripts/run-agent.sh PROJ-1234

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <jira-link-or-key>"
    exit 1
fi

JIRA_INPUT="$1"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Extract the task key
if [[ "$JIRA_INPUT" =~ /browse/([A-Z]+-[0-9]+) ]]; then
    JIRA_KEY="${BASH_REMATCH[1]}"
elif [[ "$JIRA_INPUT" =~ ^[A-Z]+-[0-9]+$ ]]; then
    JIRA_KEY="$JIRA_INPUT"
else
    echo "ERROR: cannot recognize a Jira key in '$JIRA_INPUT'"
    exit 1
fi

RUN_DIR="$ROOT_DIR/workspace/runs/${TIMESTAMP}-${JIRA_KEY}"
mkdir -p "$RUN_DIR"

echo "▶ Starting agent for task $JIRA_KEY"
echo "  Logs: $RUN_DIR"
echo

cd "$ROOT_DIR"

# Run Claude Code in non-interactive (headless) mode.
# --print outputs the response to stdout and ends the session automatically.
# --permission-mode acceptEdits allows autonomous file operations.
# --dangerously-skip-permissions = full autonomy (WARNING: only if you trust the agent and the repo is in an isolated environment)
claude \
    --print \
    --permission-mode acceptEdits \
    --add-dir "$ROOT_DIR/workspace" \
    "Execute the full workflow for Jira task $JIRA_INPUT. Follow the phase sequence from CLAUDE.md. Save logs for this run to $RUN_DIR." \
    2>&1 | tee "$RUN_DIR/agent.log"

echo
echo "✓ Done. Check $RUN_DIR/agent.log and the results in Jira/GitHub."
