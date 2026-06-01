# Server Mode — Jira REST API Instructions

When `SERVER_MODE=true`, the agent runs non-interactively on a server and cannot use the
Atlassian MCP (which requires interactive OAuth). Use direct Jira REST API calls instead.

## Authentication

All requests use HTTP Basic Auth with the bot user credentials from environment variables:
- `JIRA_BOT_EMAIL` — bot user email (e.g. ai-agent@brightlocal.com)
- `JIRA_BOT_API_TOKEN` — bot user Atlassian API token

Base URL: `https://brightlocal.atlassian.net`

## Read a Jira issue

```bash
curl -s \
  -u "$JIRA_BOT_EMAIL:$JIRA_BOT_API_TOKEN" \
  -H "Accept: application/json" \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}"
```

## Fetch issue comments

```bash
curl -s \
  -u "$JIRA_BOT_EMAIL:$JIRA_BOT_API_TOKEN" \
  -H "Accept: application/json" \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}/comment"
```

## Post a comment

```bash
curl -s -X POST \
  -u "$JIRA_BOT_EMAIL:$JIRA_BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "body": {
      "type": "doc",
      "version": 1,
      "content": [{
        "type": "paragraph",
        "content": [{"type": "text", "text": "YOUR MESSAGE HERE"}]
      }]
    }
  }' \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}/comment"
```

## Add a label

```bash
curl -s -X PUT \
  -u "$JIRA_BOT_EMAIL:$JIRA_BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"update": {"labels": [{"add": "LABEL_NAME"}]}}' \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}"
```

## Remove a label

```bash
curl -s -X PUT \
  -u "$JIRA_BOT_EMAIL:$JIRA_BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"update": {"labels": [{"remove": "LABEL_NAME"}]}}' \
  "https://brightlocal.atlassian.net/rest/api/3/issue/{JIRA_KEY}"
```

## Mapping: MCP tools → REST API

| MCP tool (local mode) | REST API equivalent (server mode) |
|---|---|
| `mcp__atlassian__getJiraIssue` | `GET /rest/api/3/issue/{key}` |
| `mcp__atlassian__getJiraIssueComments` | `GET /rest/api/3/issue/{key}/comment` |
| `mcp__atlassian__addCommentToJiraIssue` | `POST /rest/api/3/issue/{key}/comment` |
| `mcp__atlassian__searchJiraIssuesUsingJql` | `GET /rest/api/3/search?jql=...` |
