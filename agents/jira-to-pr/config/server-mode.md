# Server Mode — Jira REST API Instructions

When `SERVER_MODE=true`, the agent runs non-interactively (headless, inside the poller
container) and cannot use the Atlassian MCP (which requires interactive OAuth). Use direct
Jira REST API calls instead.

The agent only **reads** issues and **posts marked comments**. It never changes labels or
transitions status — the poller owns labels (see `CLAUDE.md` → "Ownership rules").

## Authentication and the wrapper script

All Jira calls go through `scripts/jira-api.sh` (relative to the agent's cwd
`agents/jira-to-pr`). It holds the Basic-auth credentials internally (env vars `JIRA_EMAIL`
/ `JIRA_API_TOKEN`) and only allows `GET` and `POST` to `https://brightlocal.atlassian.net`.

**Never reference `$JIRA_EMAIL`, `$JIRA_API_TOKEN`, `$SERVER_MODE` or any other variable in
a Bash command** — the permission system refuses commands it cannot expand. Do not probe env
variables at all; the run prompt tells you the execution mode. Run every command below as ONE
line, exactly in the shape shown.

## Read a Jira issue

```bash
scripts/jira-api.sh GET /rest/api/3/issue/{JIRA_KEY}
```

## Fetch issue comments

```bash
scripts/jira-api.sh GET "/rest/api/3/issue/{JIRA_KEY}/comment?orderBy=created&maxResults=100"
```

Comments whose text starts with `🤖 ai-workspace:` are the agent's/poller's own; every other
comment is a human (Vadym) comment.

## Search issues (JQL)

```bash
jq -n --arg jql 'parent = LM-1234' '{jql: $jql, fields: ["summary", "status", "labels", "issuetype"], maxResults: 50}' | scripts/jira-api.sh POST /rest/api/3/search/jql
```

## Post a marked comment

Every comment MUST start with `🤖 ai-workspace:` and end with a final line `[run:<RUN_ID>]`
(the run id from the current run prompt). Pass the text inline to `jq --arg t "…"` and write
line breaks as the two characters `\n` (inside double quotes bash keeps them literal); the jq
program splits on them, so each line becomes one ADF paragraph — the same shape the poller
uses. Escape `"`, `$` and backticks in the text with a backslash. The response's `id` is the
comment id (use it as `question_comment_id` in `result.json` when the comment asks questions).

```bash
jq -n --arg t "🤖 ai-workspace: I need two answers before I can implement LM-1234:\n1. ...\n2. ...\n[run:20261026-101200-LM-1234]" '{body: {type: "doc", version: 1, content: [$t | split("\\n")[] | {type: "paragraph", content: (if . == "" then [] else [{type: "text", text: .}] end)}]}}' | scripts/jira-api.sh POST /rest/api/3/issue/{JIRA_KEY}/comment | jq -r '.id'
```

If the command prints `null` or nothing, the comment was not created — inspect the raw
response, fix, and retry once.

## Labels and status

Not done by the agent. No `PUT /issue/{key}` label updates, no transitions.

## Mapping: MCP tools → REST API

| MCP tool (local mode) | server mode (`scripts/jira-api.sh`) |
|---|---|
| `mcp__atlassian__getJiraIssue` | `jira-api.sh GET /rest/api/3/issue/{key}` |
| `mcp__atlassian__getJiraIssueComments` | `jira-api.sh GET /rest/api/3/issue/{key}/comment` |
| `mcp__atlassian__addCommentToJiraIssue` | `jira-api.sh POST /rest/api/3/issue/{key}/comment` (marked) |
| `mcp__atlassian__searchJiraIssuesUsingJql` | `jira-api.sh POST /rest/api/3/search/jql` |
