#!/usr/bin/env bash
# Jira REST wrapper for headless agent runs.
#
# The Claude Code permission system refuses Bash commands that reference env
# variables (it cannot check what they expand to), so the agent cannot run
# `curl -u "$JIRA_EMAIL:..."` itself. This script keeps the credentials
# internal: the agent's command line contains no variables and matches a
# narrow allow rule. It permits only GET and POST to the BrightLocal Jira —
# no PUT/DELETE, so labels and status stay out of the agent's reach.
#
# Usage:
#   scripts/jira-api.sh GET  /rest/api/3/issue/LM-1234
#   scripts/jira-api.sh GET  "/rest/api/3/issue/LM-1234/comment?orderBy=created&maxResults=100"
#   scripts/jira-api.sh POST /rest/api/3/issue/LM-1234/comment   # JSON body on stdin
set -euo pipefail

HOST="https://brightlocal.atlassian.net"
METHOD="${1:-}"
API_PATH="${2:-}"

if [[ "$METHOD" != "GET" && "$METHOD" != "POST" ]]; then
  echo "jira-api.sh: method must be GET or POST" >&2
  exit 2
fi
case "$API_PATH" in
  /rest/*) ;;
  *) echo "jira-api.sh: path must start with /rest/" >&2; exit 2 ;;
esac

: "${JIRA_EMAIL:?JIRA_EMAIL is not set}"
: "${JIRA_API_TOKEN:?JIRA_API_TOKEN is not set}"

if [[ "$METHOD" == "POST" ]]; then
  exec curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
    -H "Content-Type: application/json" -H "Accept: application/json" \
    -X POST --data-binary @- "$HOST$API_PATH"
else
  exec curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
    -H "Accept: application/json" "$HOST$API_PATH"
fi
