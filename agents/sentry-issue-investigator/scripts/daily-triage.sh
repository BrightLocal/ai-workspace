#!/usr/bin/env bash
#
# Daily Sentry triage digest — unattended Mode A sweep.
#
# Runs the sentry-issue-investigator agent headless, writes a dated Markdown
# digest, and optionally posts the TL;DR to Slack.
#
# The single most important property of this script: when the environment is
# not healthy it MUST NOT produce a digest. An empty Sentry result and a
# disconnected VPN look identical in the output, and a cheerful "nothing broke
# today" that really means "I couldn't see anything" is worse than no report.
# Every precondition below therefore fails loudly instead of degrading.
#
# Config, via ~/.config/sentry-daily-triage.env (chmod 600):
#   SENTRY_ACCESS_TOKEN            required — 1Password: "Sentry Claude MCP Token"
#   SENTRY_DIGEST_SLACK_WEBHOOK    optional — Slack incoming webhook URL
#   SENTRY_DIGEST_WORKSPACE        optional — workspace root
#   SENTRY_DIGEST_VPN_UNIT         optional — systemd unit for the VPN
#   SENTRY_DIGEST_MODEL            optional — model alias (default: sonnet)

set -euo pipefail

WORKSPACE="${SENTRY_DIGEST_WORKSPACE:-$HOME/IdeaProjects/ai-workspace/ai-workspace}"
VPN_UNIT="${SENTRY_DIGEST_VPN_UNIT:-openvpn@vpn.brightlocal.dev.service}"
MODEL="${SENTRY_DIGEST_MODEL:-sonnet}"
ES_HOST="${SENTRY_DIGEST_ES_HOST:-10.79.115.30}"
ES_PORT="${SENTRY_DIGEST_ES_PORT:-9200}"

AGENT_DIR="$WORKSPACE/agents/sentry-issue-investigator"
PROMPT_FILE="$AGENT_DIR/config/daily-triage.prompt.md"
OUT_DIR="$WORKSPACE/products/Tools/working/sentry/daily"
DATE="$(date +%F)"
DIGEST_FILE="$OUT_DIR/$DATE.md"
LOG_FILE="$OUT_DIR/run.log"

mkdir -p "$OUT_DIR"

log() { printf '%s  %s\n' "$(date -Is)" "$*" | tee -a "$LOG_FILE" >&2; }

# Post to Slack. Uses python3 for JSON encoding — the digest contains quotes,
# backticks and newlines that break naive string interpolation.
slack() {
    local text="$1"
    [ -n "${SENTRY_DIGEST_SLACK_WEBHOOK:-}" ] || return 0
    python3 -c '
import json, sys, urllib.request
url, text = sys.argv[1], sys.argv[2]
req = urllib.request.Request(
    url,
    data=json.dumps({"text": text}).encode(),
    headers={"Content-Type": "application/json"},
)
try:
    urllib.request.urlopen(req, timeout=15).read()
except Exception as exc:
    print(f"slack post failed: {exc}", file=sys.stderr)
    sys.exit(1)
' "$SENTRY_DIGEST_SLACK_WEBHOOK" "$text" || log "WARN slack post failed"
}

# Preconditions failed — record why, tell Slack, and exit without a digest.
abort() {
    local reason="$1"
    log "ABORT $reason"
    printf '# Sentry daily triage — %s\n\n**SKIPPED — no digest produced.**\n\nReason: %s\n\nThis is not a clean bill of health. Nothing was checked.\n' \
        "$DATE" "$reason" > "$OUT_DIR/$DATE.SKIPPED.md"
    slack ":warning: *Sentry daily triage skipped* ($DATE)
Reason: $reason
_No issues were checked — this is not an all-clear._"
    exit 1
}

log "=== daily triage start ($DATE) ==="

# --- Preconditions -----------------------------------------------------------

[ -d "$WORKSPACE" ]      || abort "workspace not found at $WORKSPACE"
[ -f "$PROMPT_FILE" ]    || abort "prompt file missing: $PROMPT_FILE"
command -v claude >/dev/null || abort "claude CLI not on PATH"

[ -n "${SENTRY_ACCESS_TOKEN:-}" ] || \
    abort "SENTRY_ACCESS_TOKEN not set — check ~/.config/sentry-daily-triage.env"

# VPN. Checked three ways because each fails differently: the unit can be
# active with no route, and tun0 can exist while the cluster is unreachable.
if ! systemctl is-active --quiet "$VPN_UNIT"; then
    abort "VPN unit $VPN_UNIT is not active"
fi
if ! ip -br link show type tun 2>/dev/null | grep -q .; then
    abort "VPN unit is active but no tun interface exists"
fi
if ! timeout 8 bash -c "cat < /dev/null > /dev/tcp/$ES_HOST/$ES_PORT" 2>/dev/null; then
    abort "VPN is up but $ES_HOST:$ES_PORT is unreachable — check VPN scope (Engineer permissions required)"
fi

log "preconditions OK (vpn=$VPN_UNIT, es=$ES_HOST:$ES_PORT, model=$MODEL)"

# --- Run ---------------------------------------------------------------------

# The allowlist is the real guard, not the permission mode. Every Sentry,
# Elasticsearch and Jira write tool is omitted here and denied explicitly below.
ALLOWED=(
    "Read" "Glob" "Grep" "Write"
    "mcp__sentry-selfhosted__search_issues"
    "mcp__sentry-selfhosted__search_events"
    "mcp__sentry-selfhosted__get_sentry_resource"
    "mcp__sentry-selfhosted__find_projects"
    "mcp__elasticsearch__search"
    "mcp__elasticsearch__count_documents"
    "mcp__elasticsearch__list_indices"
)
DENIED=(
    "Bash" "Edit" "NotebookEdit" "WebFetch" "WebSearch"
    "mcp__sentry-selfhosted__update_issue"
    "mcp__elasticsearch__create_index" "mcp__elasticsearch__delete_index"
    "mcp__elasticsearch__add_document" "mcp__elasticsearch__update_document"
    "mcp__elasticsearch__delete_document" "mcp__elasticsearch__update_by_query"
    "mcp__elasticsearch__delete_by_query" "mcp__elasticsearch__bulk"
    "mcp__atlassian__createJiraIssue" "mcp__atlassian__editJiraIssue"
    "mcp__atlassian__addCommentToJiraIssue" "mcp__atlassian__transitionJiraIssue"
)

log "invoking claude (model=$MODEL)"
set +e
DIGEST_FILE="$DIGEST_FILE" timeout 900 claude -p \
    --model "$MODEL" \
    --permission-mode bypassPermissions \
    --allowed-tools "${ALLOWED[@]}" \
    --disallowed-tools "${DENIED[@]}" \
    --add-dir "$WORKSPACE" \
    "$(cat "$PROMPT_FILE")

The digest file to write is: $DIGEST_FILE" \
    >> "$LOG_FILE" 2>&1
rc=$?
set -e

[ $rc -eq 124 ] && abort "claude run timed out after 15 minutes"
[ $rc -ne 0 ]   && abort "claude exited $rc — see $LOG_FILE"
[ -s "$DIGEST_FILE" ] || abort "claude exited 0 but wrote no digest to $DIGEST_FILE"

log "digest written: $DIGEST_FILE ($(wc -l < "$DIGEST_FILE") lines)"

# --- Notify ------------------------------------------------------------------

# Extract the TL;DR section — written to stand alone, per the prompt.
TLDR="$(awk '/^## TL;DR/{f=1;next} /^## /{f=0} f' "$DIGEST_FILE" | sed '/^$/d')"
[ -n "$TLDR" ] || TLDR="(no TL;DR section found — read the full digest)"

slack ":mag: *Sentry daily triage* — $DATE
$TLDR

_Full digest:_ \`products/Tools/working/sentry/daily/$DATE.md\`
_Triage only — nothing was filed, resolved or actioned._"

log "=== done ==="
