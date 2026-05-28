# n8n Workflow Setup Guide

This guide explains how to configure n8n to automatically trigger the jira-to-pr agent
when a Jira task is assigned to the bot user.

## Prerequisites

- The ai-workspace server is running and accessible from n8n (see `server-setup.md`)
- You have the `WEBHOOK_SECRET` value set on the server
- You have the `JIRA_BOT_ACCOUNT_ID` of the bot user

---

## Workflow Overview

```
Jira Trigger → Filter by assignee → HTTP POST to agent server
                                          ↓
                              202 Accepted (agent running in background)
```

The workflow is intentionally fire-and-forget. The agent updates the Jira issue directly
(labels, comments) so progress is visible in Jira without n8n needing to poll for results.

---

## Step-by-Step: Building the Workflow in n8n

### Node 1: Jira Trigger

- **Type:** Jira Software Trigger
- **Credential:** Your Jira credentials (admin account for webhook registration)
- **Events:** `Issue Updated`

> n8n will register a webhook in Jira automatically. Make sure Jira can reach n8n's webhook URL.

### Node 2: IF — Filter assignments to bot user

- **Type:** IF
- **Condition:**
  - Left value: `{{ $json.issue.fields.assignee.accountId }}`
  - Operation: `is equal to`
  - Right value: `JIRA_BOT_ACCOUNT_ID` (replace with actual value)

Connect the **True** branch to Node 3. The **False** branch ends (no action).

### Node 3: HTTP Request — POST to agent server

- **Type:** HTTP Request
- **Method:** POST
- **URL:** `http://<VM_HOST>:3000/run-agent`
- **Headers:**
  - `Content-Type`: `application/json`
  - `X-Webhook-Secret`: `{{ $env.WEBHOOK_SECRET }}` *(store in n8n credential or env var)*
- **Body (JSON):**
  ```json
  {
    "jira_key": "{{ $('Jira Trigger').item.json.issue.key }}"
  }
  ```
- **Expected response:** HTTP 202

### Node 4 (optional): Handle errors

Add an **Error Trigger** node connected to a **Slack** or **Email** node to alert the team
if the HTTP request to the agent server fails (network error, 4xx/5xx response).

---

## Handling Duplicate Triggers

The agent server itself prevents concurrent runs for the same Jira key (returns `409 Conflict`
if already running). You can optionally add an n8n IF node after Node 3 to check the response
status code and log/skip 409s.

---

## Jira Labels Used by the Agent

| Label | Meaning |
|-------|---------|
| `ai-processing` | Agent has started working on this issue — set by n8n or the agent |
| `ai-processed` | Pipeline completed successfully — PR created, comment posted |
| `ai-error` | Agent run failed — check Docker logs on the VM |

You can use these labels in Jira board filters to monitor agent activity.

---

## Testing the Workflow

1. Activate the workflow in n8n.
2. In Jira, assign a test issue to the bot user (`ai-agent@brightlocal.com`).
3. In n8n, check the workflow execution log — Node 3 should show `202 Accepted`.
4. In Jira, the issue should get the `ai-processing` label within seconds.
5. After ~10-20 minutes: a PR should appear on GitHub and a comment on the Jira issue.
6. The label should change from `ai-processing` to `ai-processed`.
