# Server Setup Guide (for DevOps)

This guide covers deploying the ai-workspace on a dedicated VM so that n8n can trigger
the jira-to-pr agent automatically whenever a Jira task is assigned to the bot user.

## Prerequisites

- Docker and docker-compose installed on the VM
- VM is accessible from the n8n server on port 3000 (internal network)
- Git access to this repository

## 1. Clone the repository

```bash
git clone https://github.com/BrightLocal/ai-workspace.git /opt/ai-workspace
cd /opt/ai-workspace
```

## 2. Create the environment file

```bash
cp agents/jira-to-pr/config/bot.env.example .env
# Edit .env and fill in all values
nano .env
```

Required variables (see section below).

## 3. Build and start the container

```bash
docker-compose up -d --build
```

The container starts an HTTP server on port 3000.

## 4. Clone BrightLocal repositories into the workspace volume

This is a one-time step to pre-populate the workspace with the code repositories the agent needs.

```bash
docker exec ai-workspace bash -c "cd /app/agents/jira-to-pr && ./scripts/clone-repos.sh"
```

## 5. Verify the server is running

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","activeRuns":[]}
```

## 6. Test with a real Jira key (dry run)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -d '{"jira_key": "BL-1234"}' \
  http://localhost:3000/run-agent
# Expected: {"status":"accepted","jira_key":"BL-1234"}
```

Then watch the logs:
```bash
docker logs ai-workspace -f
```

---

## Required Environment Variables

Create a `.env` file at the repository root (never commit this file).

```dotenv
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Jira bot user credentials
JIRA_BOT_EMAIL=ai-agent@brightlocal.com
JIRA_BOT_API_TOKEN=<Atlassian API token for bot user>
JIRA_BOT_ACCOUNT_ID=<Jira accountId of bot user — needed for JQL in n8n>

# GitHub (PAT with repo read + write + pull_requests scopes)
GH_TOKEN=ghp_...

# HTTP endpoint security — shared secret between this server and n8n
WEBHOOK_SECRET=<generate with: openssl rand -hex 32>
```

---

## Keeping the workspace up to date

To pull the latest agent code:

```bash
cd /opt/ai-workspace
git pull
docker-compose up -d --build
```

Cloned BrightLocal repos (in the Docker volume) are updated automatically by the agent
at the start of each run via `clone-repos.sh`.

---

## Port and network

| Port | Protocol | Purpose |
|------|----------|---------|
| 3000 | HTTP | Webhook endpoint for n8n — internal network only, not exposed to the internet |

The VM does not need to be reachable from the internet. n8n and the VM must be on the same
internal network.

---

## Monitoring

View agent run logs:
```bash
# Container logs (server-level)
docker logs ai-workspace -f

# Per-run logs (inside the volume)
docker exec ai-workspace ls agents/jira-to-pr/workspace/runs/
docker exec ai-workspace cat agents/jira-to-pr/workspace/runs/<timestamp-JIRA-KEY>/agent.log
```
