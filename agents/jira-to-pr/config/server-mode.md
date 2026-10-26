# Server Mode — Jira REST API Instructions

When `SERVER_MODE=true`, the agent runs non-interactively (headless, inside the poller
container) and cannot use the Atlassian MCP (which requires interactive OAuth). Use direct
Jira REST API calls instead.

The agent only **reads** issues and **posts marked comments**. It never changes labels or
transitions status — the poller owns labels (see `CLAUDE.md` → "Ownership rules").

## Authentication

All requests use HTTP Basic Auth with Vadym's credentials from environment variables:
- `JIRA_EMAIL` — Atlassian account email
- `JIRA_API_TOKEN` — Atlassian API token

Base URL: `https://brightlocal.atlassian.net`

## Read a Jira issue

```bash
curl -s \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}"
```

## Fetch issue comments

```bash
curl -s \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Accept: application/json" \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}/comment?orderBy=created&maxResults=100"
```

Comments whose text starts with `🤖 ai-workspace:` are the agent's/poller's own; every other
comment is a human (Vadym) comment.

## Search issues (JQL)

```bash
jq -n --arg jql 'parent = LM-1234' \
  '{jql: $jql, fields: ["summary", "status", "labels", "issuetype"], maxResults: 50}' \
| curl -s -X POST \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data @- \
  "https://brightlocal.atlassian.net/rest/api/3/search/jql"
```

## Post a marked comment

Every comment MUST start with `🤖 ai-workspace:` and end with a final line `[run:<RUN_ID>]`
(the run id from the current run prompt). Each text line becomes one ADF paragraph — the same
shape the poller uses. The response's `id` is the comment id (use it as
`question_comment_id` in `result.json` when the comment asks questions).

```bash
TEXT=$'🤖 ai-workspace: I need two answers before I can implement LM-1234:\n1. ...\n2. ...\n[run:20261026-101200-LM-1234]'

jq -n --arg t "$TEXT" '{body: {type: "doc", version: 1, content: [
    $t | split("\n")[] | {type: "paragraph", content: (if . == "" then [] else [{type: "text", text: .}] end)}
  ]}}' \
| curl -s -X POST \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data @- \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}/comment" \
| jq -r '.id'
```

If the command prints `null` or nothing, the comment was not created — inspect the raw
response, fix, and retry once.

## Labels and status

Not done by the agent. No `PUT /issue/{key}` label updates, no transitions.

## Mapping: MCP tools → REST API

| MCP tool (local mode) | REST API equivalent (server mode) |
|---|---|
| `mcp__atlassian__getJiraIssue` | `GET /rest/api/3/issue/{key}` |
| `mcp__atlassian__getJiraIssueComments` | `GET /rest/api/3/issue/{key}/comment` |
| `mcp__atlassian__addCommentToJiraIssue` | `POST /rest/api/3/issue/{key}/comment` (marked) |
| `mcp__atlassian__searchJiraIssuesUsingJql` | `POST /rest/api/3/search/jql` |
