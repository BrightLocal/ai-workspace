# MCP setup — install and verify before first use

This agent cannot work without its MCP servers. **Run the checks in this file
before the first investigation**, not halfway through one — a half-configured
setup produces empty results that look exactly like "nothing is wrong".

Sources of truth (Confluence, PG space):

- [\[MCP\] Sentry integration](https://brightlocal.atlassian.net/wiki/spaces/PG/pages/4739235841/MCP+Sentry+integration)
- [\[MCP\] ElasticSearch integration](https://brightlocal.atlassian.net/wiki/spaces/PG/pages/4747657230/MCP+ElasticSearch+integration)

If those pages and this file disagree, **Confluence wins** — it is maintained by
the team that owns the integrations. Update this file to match.

## What the agent needs

| Server | Required for | Without it |
|---|---|---|
| `sentry-selfhosted` | Modes A, B — everything | The agent cannot start |
| `elasticsearch` | Mode C — claim testing | **No claim can be CONFIRMED or REFUTED**; every verdict degrades to UNTESTABLE |
| `atlassian` | Modes E–H — tickets, plans, dedup | No dedup, no ticket filing |

Losing Elasticsearch is not a partial degradation — it removes the agent's entire
ability to test a hypothesis. Say so loudly rather than producing a
Sentry-only narrative that reads like a diagnosis.

## Prerequisites — both servers

- **BrightLocal VPN, with Engineer-scoped permissions.**
- Node.js >= 20 and npm (Claude Code installs both servers via `npx`).

> **The VPN is required at runtime, not just at install.** This is the single
> most common failure: the servers stay registered and `claude mcp list` may
> still look fine, but every query fails or returns nothing. **Check the VPN
> first whenever Sentry or Elasticsearch starts returning empty.**

## 1. Sentry — `sentry-selfhosted`

Connects to `https://sentry.bll-i.co.uk/` through a custom Sentry app, authorised
by an organisation-level access token.

- Token: **1Password → Engineering vault → _Sentry Claude MCP Token_**
- App config:
  `https://sentry.bll-i.co.uk/settings/brightlocal/developer-settings/claude-mcp-e68593/`

**Step 1 — export the token in your shell profile.**

```bash
# Linux / macOS (zsh)
echo 'export SENTRY_ACCESS_TOKEN="your-token-here"' >> ~/.zshrc && source ~/.zshrc

# Linux (bash)
echo 'export SENTRY_ACCESS_TOKEN="your-token-here"' >> ~/.bashrc && source ~/.bashrc
```

The token is read from the ambient shell environment — it is deliberately **not**
in the MCP config's `env` block, so it never lands in a config file. Keep it that
way. Never paste the token into the chat, a repo file, or a command the agent
runs.

**Step 2 — register the server.**

```bash
claude mcp add-json sentry-selfhosted '{
    "type":"stdio",
    "command":"npx",
    "args":[
        "-y",
        "@sentry/mcp-server"
    ],
    "env":{
        "SENTRY_HOST":"sentry.bll-i.co.uk",
        "MCP_DISABLE_SKILLS":"seer"
    }
}' --scope user
```

**Claude Desktop instead:** search the available connectors for
**Sentry (internal)** and install it — no manual token step.

## 2. Elasticsearch — `elasticsearch`

Connect to the VPN **first**, then register:

```bash
claude mcp add-json elasticsearch '{
    "type":"stdio",
    "command":"npx",
    "args":[
        "-y",
        "@octodet/elasticsearch-mcp"
    ],
    "env":{
        "ES_URL":"http://10.79.115.30:9200",
        "ES_VERSION":"8",
        "OTEL_LOG_LEVEL":"none"
    }
}'
```

Built on [Octodet/elasticsearch-mcp](https://github.com/Octodet/elasticsearch-mcp).

> **Note the scope difference.** The Confluence page gives the Sentry command with
> `--scope user` and the Elasticsearch command without it, which registers ES at
> *local* scope — available only in the directory where you ran it. If you want
> it everywhere, add `--scope user`. Worth doing for this agent, since it runs
> from the workspace root.

**Claude Desktop instead:** Settings → Extensions → install **BL ElasticSearch**.

## 3. Atlassian — `atlassian`

Already connected in this workspace via `.mcp.json`; needed only for Modes E–H.
cloudId `5d89576a-2167-45d7-b6a4-cfa42edbee57`.

> ⚠️ **Overdue transport migration.** `.mcp.json` points at
> `https://mcp.atlassian.com/v1/sse`. HTTP+SSE support ended **30 June 2026** —
> that date has passed. Calls still succeed and every response carries a
> deprecation notice, but this is now running on borrowed time. The replacement
> is `https://mcp.atlassian.com/v1/mcp`. Unrelated to this agent, worth fixing.

## Verifying — run this before the first investigation

**Step 1 — are they registered and connected?**

```bash
claude mcp list
```

Expect `sentry-selfhosted`, `elasticsearch`, and `atlassian`, each **Connected**.
Registered-but-not-connected almost always means the VPN is down.

**Step 2 — does each one actually answer?** Registration is not function. Run one
real read per server:

| Server | Check | Healthy result |
|---|---|---|
| Sentry | `search_issues(organizationSlug="brightlocal", projectSlugOrId="tools-backend", query="is:unresolved", limit=1)` | One issue returned |
| Elasticsearch | `count_documents(index="logstash-<yesterday>")` | A count in the millions |
| Atlassian | `getJiraIssue(cloudId=…, issueIdOrKey="LM-4317")` | The issue returns |

**Do not use `find_organizations` to check Sentry.** It reports *"You don't
appear to be a member of any organizations"* even when everything works — the MCP
proxy user has no org membership listed. Treating that as an outage is a
documented false negative. Pass `organizationSlug: "brightlocal"` directly.

**Do not use `list_indices(indexPattern: "*")` to check Elasticsearch.** It
returns ~74KB and gets truncated to a file. Use yesterday's index by name.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Everything empty, servers "Connected" | **VPN down or wrong scope** | Reconnect with Engineer permissions — check this first, always |
| Sentry: "not a member of any organizations" | Known proxy-user quirk | Ignore it; pass the org slug directly |
| Sentry: 401 / auth errors | `SENTRY_ACCESS_TOKEN` not exported into this shell | Re-source the profile; restart the Claude session |
| ES server missing in one directory only | Registered at local scope | Re-add with `--scope user` |
| `npx` fails to fetch the package | Node < 20, or no network | Upgrade Node; check VPN/proxy |
| Server absent from `claude mcp list` | Never registered, or registered to a different profile | Re-run the `add-json` command |
| Tools missing in-session after a fix | MCP servers load at session start | Start a new Claude Code session |

## Reporting a missing server

If a server is unavailable, the agent must **name it, name what is now
untestable, and point here** — never silently produce a thinner answer:

> Elasticsearch is not responding, so I can't test any claim against production
> logs. Every causal claim below is `UNTESTABLE (tooling)` — not refuted, just
> unchecked. Setup and troubleshooting:
> `agents/sentry-issue-investigator/config/mcp-setup.md`. The most likely cause
> is the VPN.

`UNTESTABLE (tooling)` is a distinct verdict from `UNTESTABLE (no source
coverage)`. The first is a broken toolchain and is fixable in minutes; the second
is a real observability gap and needs a Mode H ticket. **Never let a missing MCP
server masquerade as a production instrumentation gap** — that files real
engineering work against a VPN that was simply switched off.
