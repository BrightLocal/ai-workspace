# sentry-issue-investigator

Investigates production errors in **Tools**, scoped to the **Location** and
**API** modules. Pulls issues from Sentry, corroborates them against production
logs in Elasticsearch, optionally inspects production data over a read-only
database connection, and produces an evidence-backed diagnosis.

From there it can file a Jira ticket, attach a proposed fix plan, and hand off to
`jira-to-pr` to implement and open a PR — **each step gated on your explicit
confirmation.** It never writes application code itself.

## The rule that shapes everything else

**It is not allowed to tell you a plausible story.** Every link in a causal chain
is a claim with a verdict backed by a tool result:

| Verdict | Meaning |
|---|---|
| `OBSERVED` | A tool result shows it directly |
| `CONFIRMED` | It predicted what production would contain, queried, found it |
| `REFUTED` | It predicted, queried **with passing controls**, prediction failed |
| `UNTESTABLE` | Nothing in production can decide it today → instrumentation proposal |

`UNTESTED` is not a permitted final state, the Mechanism section may contain only
`OBSERVED` and `CONFIRMED` links, and the summary may never read more confident
than the ledger beneath it.

**Negatives need controls.** A zero-hit query proves nothing until the query is
shown capable of hitting — so before any refutation it checks retention (C1),
that the log source shipped anything at all for that host and window (C2), and
that the search pattern matches somewhere (C3). Those three separate *"the
hypothesis is wrong"* from *"my query was broken"* and *"that log doesn't reach
Elasticsearch"* — outcomes that look identical in a results pane and mean
completely different things. C3 exists specifically because a `match_phrase`
across a PHP namespace backslash returns 0 for data that is definitely there.

**When the logs can't decide, it proposes the logging that would.** See below.

## What it can do

| Capability | How |
|---|---|
| Fetch one issue from a link or ID | Sentry MCP — accepts `TOOLS-BACKEND-B77` or a full URL |
| List issues ordered by occurrences | Sentry MCP, `sort=freq` |
| Scope to Location / API modules | `stack.abs_path:"*/src/Modules/{Location,API}/*"` |
| Trace production logs | Elasticsearch MCP over `logstash-*` |
| Inspect production data | `scripts/db-select.py` — SELECT-only, opt-in |
| Propose instrumentation when evidence is missing | Mode H — gap type, exact log change, and the query it enables |
| File a Jira ticket | Atlassian MCP → `LM`, type `Internal Bug`, after Gate 1 |
| Attach a fix plan | Comment on the ticket, after Gate 2 |
| Implement and open a PR | Hands off to `jira-to-pr`, after Gate 3 |

## When it can't prove the cause

Rather than guessing, it produces an **instrumentation proposal** — and that
proposal outranks a speculative fix, because a fix shipped against an unconfirmed
mechanism gives you a closed ticket and a still-broken system.

It classifies *why* the evidence is missing, because the remedy differs:

| Gap | Remedy lives in |
|---|---|
| Nothing emitted at the decision point | App code |
| Exception swallowed (`catch { return null; }`) | App code |
| Logged below the shipped level | Log config |
| App logs to disk, filebeat doesn't ship it | **Filebeat config — not a code change** |
| No key joining the log line to the Sentry event | App code, both sides |
| Sentry event lacks the entity IDs to query ES/DB | App code (SDK context) |
| Rolled off the ~31-day retention | Nothing — re-test on recurrence |

Each proposal carries the exact file and line, what to emit at what level, **the
ES query it would enable written out in advance**, a volume estimate, a PII
check, and *how long until it answers* — derived from the observed event rate, so
you can judge whether instrumenting is worth it before agreeing to it.

The instrumentation ticket is always **separate from the fix ticket**: it closes
when the data arrives, not when the bug does.

The proposal it makes most often is a **two-way correlation key** — Ray ID tagged
onto the Sentry event, Sentry event ID logged in the app line. That single change
converts every future ±2-minute *correlation* into an exact *join* and retires
the biggest standing weakness in the method.

## The escalation path

```
investigate  →  GATE 1  →  Jira ticket
                 GATE 2  →  fix plan as ticket comment
                 GATE 3  →  jira-to-pr → branch, commits, PR
```

**Three independent gates — never chained on one "yes".** Approving a ticket
isn't approving a plan; approving a plan isn't approving implementation. Jira
has no clean undo and a wrong ticket is public team noise, so each write is
shown in full and confirmed first.

Before creating anything it **searches Jira for an existing ticket** on that
Sentry ID and stops if one exists, offering to comment instead. That check is
not theoretical — `LM-4317` already covers `TOOLS-BACKEND-B77`.

If the ticket it finds is **closed**, that's a regression — a previous fix
didn't hold. It says so prominently, reads what that ticket claimed to fix
(usually the most valuable input to the new diagnosis), and asks whether to
reopen or file a linked ticket rather than quietly opening a duplicate.

## How it triages

Frequency order buries the things that matter, so before showing you the list it
checks five reactive signals and surfaces any hits above the table: **new**
(`firstSeen:-24h`), **regressed** (`is:regressed` — always checked, and the
strongest signal available), **spiking** (a time series, since a window total
can't tell "rising fast" from "steady for a month"), **critical**, and **release
stability** (a cohort of issues sharing one build points at the deploy, not the
issue).

Then every listed issue gets one of three dispositions — and none are skipped
silently, because an untriaged issue and one judged safe look identical in a
report:

| Disposition | Meaning | Must come with |
|---|---|---|
| **ACT NOW** | Fix this sprint or next | Why now — impact, trend, or regression |
| **SNOOZE** | Real, not yet worth acting on | **A numeric threshold that brings it back** |
| **IGNORE** | Safe to leave permanently | The reason it's safe |

**Only ACT NOW earns a Jira ticket.** If nobody will pick it up this sprint or
next, it's a snooze with a threshold — filing tickets nobody works costs the
board's signal-to-noise and buys nothing. And a snooze without a number is just
forgetting, so it always names one ("revisit above 500 events/week").

## Setup

### 1. MCP servers

All three are already connected in this workspace:

- `sentry-selfhosted` → `https://sentry.bll-i.co.uk`, org `brightlocal`
- `elasticsearch` → production log cluster
- `atlassian` → `brightlocal.atlassian.net` (needed only for Modes E–G)

Check with `/mcp`. Nothing else to configure.

> The Atlassian MCP warns that its HTTP+SSE endpoint is unsupported after
> 30 June 2026. `.mcp.json` points at `/v1/sse`; the replacement is `/v1/mcp`.
> Worth updating at some point — unrelated to this agent.

> **Known quirk:** `find_organizations()` reports *"You don't appear to be a
> member of any organizations"*, but the org slug `brightlocal` works fine. This
> is not an outage — pass the slug directly.

### 2. Tools codebase

Reading stack traces against source needs the symlink at
`products/Tools/codebase/Tools/`. Already present in this workspace.

### 3. Database access (optional, per-session)

Only needed for Mode D. Export a DSN when you want it:

```bash
export TOOLS_PROD_DB_DSN='mysql://ai_readonly:pass@prod-db-host:3306/brightlocal'
```

Or copy the template and source it:

```bash
cp agents/sentry-issue-investigator/config/db.env.example \
   agents/sentry-issue-investigator/config/db.env
$EDITOR agents/sentry-issue-investigator/config/db.env
set -a; source agents/sentry-issue-investigator/config/db.env; set +a
```

`db.env` is gitignored by the root `*.env` rule. **Use a read-only DB user** —
see the reasoning in `config/db.env.example`, and the honest limits below.

Requires `pymysql` (already installed: 2.2.8).

## Usage

Trigger it in plain language from the workspace root:

```
> list the top sentry issues in the Tools location module
> what are the most frequent API module errors in the last 7 days?
> investigate TOOLS-BACKEND-B77
> https://sentry.bll-i.co.uk/organizations/brightlocal/issues/TOOLS-BACKEND-B74
> why is this happening? find the production logs for it
> check the database for location 4135533
> create a Jira ticket for this
> propose a fix and add the plan to the ticket
> implement it
```

Investigations are written to
`products/Tools/working/sentry/{ISSUE-ID}/investigation.md` (gitignored), with a
`Tracking` block recording what was actually filed, planned, and implemented
versus merely proposed.

## Two things it will keep telling you

**"Location module" is ambiguous.** `*/src/Modules/Location/*` matches only
`Location` — not `LocationManager`, `LocationConnections`, `LocationSummary`, or
`GeoLocationSearch`. The agent runs the narrow filter and then names the
siblings, rather than silently picking a broader reading, because the occurrence
counts differ a lot.

**Frame matching is a wide net.** The Sentry filter matches if *any* stack frame
touches the module path, so results include errors that merely pass through it.
The agent labels each as **owned** (culprit inside the module) or **passing
through** (culprit elsewhere, often another team's bug).

## The read-only SQL runner

`scripts/db-select.py` is the only sanctioned DB path. Three layers:

1. **SQL parser** — allowlists `SELECT` / `SHOW` / `DESCRIBE` / `EXPLAIN` /
   `WITH`; blocks DML and DDL; rejects multi-statement input; blanks string
   literals and comments first, so payloads can't hide in `--`, `#`, or
   `/*! … */`.
2. **`START TRANSACTION READ ONLY`** — MySQL rejects `INSERT`/`UPDATE`/`DELETE`
   with error 1792.
3. **Rollback on exit** — nothing is ever committed.

### Honest limitation

Layer 2 does **not** block DDL. `CREATE` / `ALTER` / `DROP` trigger an implicit
commit and execute anyway — verified against Percona 8.0.46 while building this.
So for DDL, the layer-1 parser is the *only* barrier, and a parser bug would be
the only thing between a malformed statement and a schema change.

**This is why the read-only DB grant is not optional advice.** A `GRANT SELECT`
user closes the gap at the server:

```sql
CREATE USER 'ai_readonly'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT, SHOW VIEW ON brightlocal.* TO 'ai_readonly'@'%';
FLUSH PRIVILEGES;
```

Prefer a read replica over the primary.

### The guard, tested

17 bypass attempts, all rejected — stacked statements, comment-hidden payloads
(`-- ;DROP`, `#`, `/*! ;DROP */`), `INTO OUTFILE`, `SLEEP`, `REPLACE INTO`,
`CALL`, `SET GLOBAL`, `USE`, `GRANT`, and CTE-driven DML (`WITH … DELETE`).
Legitimate reads still pass, including `SHOW CREATE TABLE`, `REPLACE()` as a
string function, and columns named `last_update`.

Check any statement without connecting:

```bash
scripts/db-select.py --explain-guard "SELECT 1; DROP TABLE locations"
# REJECTED: multiple statements are not allowed — send one SELECT at a time
```

### CLI

```
scripts/db-select.py [--dsn DSN] [--limit N] [--timeout S] [--json]
                     [--explain-guard] "<SQL>" | -

--limit          max rows (default 100 or $TOOLS_PROD_DB_ROW_LIMIT, cap 1000)
--timeout        connect/read timeout, seconds (default 30)
--json           JSON instead of an aligned table
--explain-guard  validate only, never connect
-                read the statement from stdin
```

Exit codes: `0` ok · `2` rejected by guard · `3` connection/query error ·
`4` bad usage. Passwords are redacted from all error output.

## Jira conventions it follows

Derived from what the team actually does, not invented:

- **Project `LM` ("Backend Services")** — where Sentry-originated Tools backend
  errors get filed (`LM-4317`, `LM-3736`, `LM-3741`, `LM-3695`, `LM-4143`).
  Always confirmed with you first, so you can redirect to `BI` or `CB` when
  Sentry names a different owning team.
- **Type `Internal Bug`** — the convention for errors *we* found in Sentry, as
  opposed to `Bug`, which the team uses for customer/QA reports (often prefixed
  `[Standup ticket]`). A diagnosis that stopped at "unverified" becomes an
  `Investigation` instead.
- **Priority `P2 - Medium`** by default, matching `LM-4317`. Anything higher
  needs evidence, not an alarming-looking stack trace.
- **Description shape follows `LM-4317`** — Summary with the Sentry link, failure
  chain, root cause with `file:line`, quantified impact, in-scope vs follow-ups,
  acceptance criteria. Including its best habits: marking unverified claims as
  unverified, stating sample sizes, and suggesting the query that would close an
  open question.
- **Don't use the `API` project** for Tools API-module bugs. It's a dead board
  (last activity 2022) about third-party review-fetching, unrelated to
  `src/Modules/API/`.

Templates live in `config/ticket-templates.md`; the verified connection details,
issue-type IDs, and dedup query are in `config/jira.md`.

### One thing it verifies rather than assumes

`LM-4317`'s description is stored as Jira **wiki markup** (`h2.`, `{code}`), and
`LM` is a classic project — but whether wiki markup or Markdown renders
correctly depends on the project's renderer, which isn't safe to guess. So after
creating a ticket the agent **reads it back and checks the description actually
rendered**, falling back to Markdown if literal `h2.` markers show as text. It
tells you the outcome either way.

## Verified environment facts

Captured live on 2026-08-24 while building this, so the agent doesn't have to
rediscover them.

**Sentry** — org `brightlocal`; projects `tools-backend` (primary),
`tools-frontend`. Working module filter is `stack.abs_path` with globs;
`stack.filename` and `stack.module` return nothing. `period` accepts only
`24h`/`7d`/`14d`/`30d`/`90d`.

**Elasticsearch** — production logs live in `logstash-YYYY.MM.DD`, ~31-day
retention. `docker-logs-*` holds only `mcp-prod` and is irrelevant here. Key
sources: `tools-ssl-access.log` (1.87M lines/day), `php-errors.log` (892k),
`workerman.log`, `crunz-*.log`, `listing_syncer/prod.log`. Aggregations need
`.keyword`. `@timestamp` is filebeat *ship* time, so correlate with a ±2 minute
window. `php-errors.log` is **not** a mirror of Sentry exceptions — absence
there proves nothing.

Full detail, including the query forms that *don't* work, is in
`config/sentry.md` and `config/elasticsearch.md`.

## Files

```
agents/sentry-issue-investigator/
├── CLAUDE.md                 # orchestrator — modes A–G, gates, evidence rules
├── README.md                 # this file
├── config/
│   ├── sentry.md             # org, projects, module filters, query cookbook
│   ├── elasticsearch.md      # indices, field map, log sources, recipes
│   ├── jira.md               # cloudId, project, issue types, dedup query
│   ├── ticket-templates.md   # ticket description + fix-plan shapes
│   └── db.env.example        # DSN template + read-only grant rationale
└── scripts/
    └── db-select.py          # SELECT-only query runner
```

## Limits

- Never writes application code itself — implementation goes through
  `jira-to-pr`, and only after Gate 3.
- Never creates a ticket, comment, or PR without confirmation in that turn, and
  never chains the three gates on a single "yes".
- Won't file a duplicate — it searches Jira first and stops if a ticket exists.
- Won't transition, assign, or edit tickets it didn't create this session.
- Won't resolve/ignore/assign Sentry issues unless asked outright.
- Never writes to Elasticsearch or runs non-SELECT SQL.
- Logs older than ~31 days are gone; it reports that rather than implying a
  clean result.
- Leaves unknowns labelled instead of guessing a root cause — and files an
  `Investigation` rather than asserting a cause it couldn't verify.
- Won't report a negative result without its C1–C3 controls, won't put an
  untested claim in the Mechanism, and won't write a summary more confident than
  its own ledger.
- Won't propose a fix for an unconfirmed mechanism — it proposes the
  instrumentation instead. You can overrule that, and the plan then carries a
  "Speculative — mechanism unconfirmed" label.
- Won't file a ticket for anything that isn't ACT NOW, or snooze without a
  numeric threshold.
