# Local poller (current MVP)

A Node poller runs in a container on the PM's laptop. It polls Jira for issues labelled
`AI` and runs the jira-to-pr agent against the local Tools / ListingSyncer checkouts.
The workspace, both checkouts, `~/.claude`, `~/.claude.json` and the Docker socket are
mounted at the same absolute paths as on the host.

Trade-off: the container mounts the host Docker socket, so anything running in it can
control the host's Docker daemon. This is acceptable on a single-user laptop and is not
suitable for a shared server.

## Setup

```bash
cp agents/jira-to-pr/config/bot.env.example .env   # fill in JIRA_EMAIL, JIRA_API_TOKEN, GH_TOKEN,
                                                   # GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL
touch personal/ai-poller.paused                    # start paused; remove when ready
docker compose up -d --build
```

If an older `ai-workspace-ai-workspace-1` container exists, `docker compose down` it before
the first `up` of the new image.

## Start / stop

- Start: `docker compose up -d`
- Stop: `docker compose down`
- Logs: `docker compose logs -f ai-workspace` (poller and server log lines)
- Per-run logs: `agents/jira-to-pr/workspace/runs/<timestamp>-<KEY>/` (e.g. `agent.log`)
- Health: `curl -s localhost:3000/health` (includes `"paused"`)

## Pause / resume

- Pause: `touch personal/ai-poller.paused`
- Resume: `rm personal/ai-poller.paused`

## Labels

| Label | Meaning |
|-------|---------|
| `AI` | Queue: pick this issue up |
| `AI-in-progress` | A run is active |
| `AI-needs-input` | The agent asked a question; reply on the issue to resume |
| `AI-draft` | A draft PR was created |
| `AI-done` | Finished successfully |
| `AI-failed` | Run failed or timed out |

Retry a failed issue: replace `AI-failed` with `AI`.

## First-run checklist (deferred smoke checks)

Not run at build time because they need real credentials:

- [ ] Claude login reused: `docker compose run --rm ai-workspace claude -p "say ok" --output-format json` returns JSON with `"result"`
- [ ] GitHub over HTTPS: `docker compose run --rm ai-workspace git -C /home/lenovo/brightLocal/Tools ls-remote origin HEAD` succeeds
- [ ] Commit author set: `docker compose run --rm ai-workspace git -C /home/lenovo/brightLocal/Tools var GIT_AUTHOR_IDENT` prints your name and email (no "unable to auto-detect email address", no entrypoint WARNING)
- [ ] `docker compose up -d && curl -s localhost:3000/health` returns `{"status":"ok",...,"paused":true}`
