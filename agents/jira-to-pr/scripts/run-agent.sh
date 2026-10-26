#!/usr/bin/env bash
# Entry point for running the agent on a Jira task (invoked by the poller).
#
# Usage:
#   run-agent.sh <KEY> <RUN_ID> [--resume <SESSION_ID> --message <TEXT>]
#
# Env: TARGET_ENV (default local), MAX_TURNS (optional), RUNS_DIR, WORKSPACE_ROOT.
# Writes claude.json, agent.log and (via the agent) result.json to the run dir.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(cd "$ROOT_DIR/../.." && pwd)}"
RUNS_DIR="${RUNS_DIR:-$ROOT_DIR/workspace/runs}"
ENV_FILE="$ROOT_DIR/config/environments/${TARGET_ENV:-local}.md"

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <KEY> <RUN_ID> [--resume <SESSION_ID> --message <TEXT>]" >&2
    exit 2
fi

JIRA_KEY="$1"
RUN_ID="$2"
shift 2

RESUME_ID=""
MESSAGE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --resume) RESUME_ID="${2:?--resume needs a value}"; shift 2 ;;
        --message) MESSAGE="${2:?--message needs a value}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; exit 2 ;;
    esac
done

RUN_DIR="$RUNS_DIR/$RUN_ID"
mkdir -p "$RUN_DIR"

if [[ -n "$RESUME_ID" ]]; then
    PROMPT="Vadym replied on $JIRA_KEY: $MESSAGE. Continue the workflow from where you stopped. Run id: $RUN_ID. Write result.json to $RUN_DIR."
else
    PROMPT="Execute the full workflow for Jira task $JIRA_KEY. Run id: $RUN_ID. Target environment: $ENV_FILE. Follow the phase sequence from CLAUDE.md. Write result.json to $RUN_DIR as specified in CLAUDE.md."
fi

CLAUDE_ARGS=(
    -p
    --output-format json
    --permission-mode acceptEdits
    --add-dir "$WORKSPACE_ROOT/products/Tools/codebase/Tools"
    --add-dir "$WORKSPACE_ROOT/products/ListingSyncer/codebase/ListingSyncer"
)
[[ -n "${MAX_TURNS:-}" ]] && CLAUDE_ARGS+=(--max-turns "$MAX_TURNS")
[[ -n "$RESUME_ID" ]] && CLAUDE_ARGS+=(--resume "$RESUME_ID")

# cd so the agent's own CLAUDE.md and .claude/settings.json apply.
cd "$ROOT_DIR"

set +e
claude "${CLAUDE_ARGS[@]}" "$PROMPT" > "$RUN_DIR/claude.json" 2> "$RUN_DIR/agent.log"
EXIT_CODE=$?
set -e

# Merge session_id from claude.json into result.json (create failed stub if absent).
SESSION_ID="$(jq -r '.session_id // empty' "$RUN_DIR/claude.json" 2>/dev/null || true)"
[[ -f "$RUN_DIR/result.json" ]] || echo '{"status":"failed"}' > "$RUN_DIR/result.json"
if [[ -n "$SESSION_ID" ]]; then
    if jq --arg sid "$SESSION_ID" '. + {session_id: $sid}' "$RUN_DIR/result.json" > "$RUN_DIR/result.json.tmp" 2>/dev/null; then
        mv "$RUN_DIR/result.json.tmp" "$RUN_DIR/result.json"
    else
        rm -f "$RUN_DIR/result.json.tmp"
    fi
fi

exit $EXIT_CODE
