# jira-to-pr — Improvement plan towards a plugin-marketplace release

**Status:** draft for review · **Created:** 2026-10-26 · **Branch:** `feature/jira-to-pr-improvements`

## 1. Goal

Ship `jira-to-pr` to every engineer in the organisation as a Claude Code plugin
(installed from an internal plugin marketplace). Four gaps seen in real runs must
be closed first:

| # | Gap | Symptom seen |
|---|---|---|
| 1 | No local architecture / DI checks before push | PRs fail CI on `deptrac` / `di-check` after the agent has already pushed |
| 2 | Sentry and Slack links in tickets are ignored | Plans miss the real failure context (stack trace, thread decisions) |
| 3 | Code style in PRs | Jira keys in code comments; generic names (`$object`, `$row`, `$item`) make reviews hard |
| 4 | No knowledge of production data volumes | A native SQL query written by the agent was slow on production |

Everything below was checked against the current code of the agent, the Tools and
ListingSyncer repositories, real LM tickets and the Claude Code plugin docs on
2026-10-26. Evidence is listed so the plan can be re-validated later.

## 2. Where the agent stands today

**Pipeline.** `CLAUDE.md` is the orchestrator. Phases: jira-analyzer (sonnet) →
code-researcher (sonnet, read-only) → planner (opus, writes `workspace/plans/{KEY}.md`)
→ implementer (opus, branches + code + tests + commit + PR via the `bl-create-pr` skill)
→ Jira comment. Two execution modes: local (Atlassian MCP) and `SERVER_MODE=true`
(curl against Jira REST, triggered by n8n through `server/index.js`).

**Repositories.** Cloned into `workspace/` (gitignored): Tools (PHP 8.3 modular
monolith, Hexagonal + CQRS, Deptrac-enforced) and ListingSyncer (Symfony 7 +
Swoole). Today the clones have `vendor/` but **no** `.docker/.env` and **no**
`config/local.ini`, so none of the Tools `make` quality targets can run there.

**Dependencies outside the agent folder** (these block plugin packaging):

- `shared/engineering/git-conventions.md` — read by `implementer.md` and the `bl-create-pr` skill.
- The routing section in the root `CLAUDE.md`.

**Defects found during this audit (fix on this branch, cheap):**

- `jira-analyzer.md` lists `mcp__atlassian__getJiraIssueComments`, which the current
  Atlassian MCP does not expose. Comments come from `getJiraIssue` with
  `fields: ["comment"]`. In practice the agent may be planning without comments.
- Steps 3 and 4 of `jira-analyzer.md` are duplicates.
- `README.md` describes a `.mcp.json` that does not exist and still calls the
  folder `jira-pr-agent`.
- The implementer tells itself to run `npm run lint` / `pre-commit`; neither applies
  to Tools or ListingSyncer. The real commands are the `make` targets in §4.

## 3. Target shape: how the plugin will run

The marketplace version changes **where** the agent works, and that decision drives
requirement 1, so it is fixed here first.

| Aspect | Today (ai-workspace) | Plugin (proposed) |
|---|---|---|
| Code location | agent-owned clones in `workspace/` | **the engineer's own checkout** (CWD = Tools or ListingSyncer; sibling `../ListingSyncer` as Tools' `RELATED_SERVICES.md` already prescribes) |
| Quality tooling | none available | the engineer's existing Docker environment: `make deptrac`, `make di-check`, `bin/incremental-ci.sh` … |
| Orchestrator | `CLAUDE.md` | a skill: `/jira-to-pr:run LM-1234` (plugins do not load a root `CLAUDE.md`) |
| Shared rules | `../../shared/...` | copied into the plugin (paths with `..` fail plugin validation) |
| Plans / logs | `workspace/plans`, `workspace/runs` | `${CLAUDE_PLUGIN_DATA}/runs/{KEY}/` (survives plugin updates, outside the repo) |
| MCP | user-level Atlassian | plugin `.mcp.json` (Atlassian, `sentry-selfhosted`, Slack) **or** documented user-level setup — see decision D2 |
| Guard rails | prose in subagent files | `hooks/hooks.json`: PreToolUse on `git push` / `git commit`, PostToolUse on PHP edits |

The headless server mode (n8n → VM) stays in ai-workspace as-is. It is not part of
the marketplace deliverable; phase 4 notes what it would need.

Plugin facts that constrain the design (Claude Code docs, 2026-10-26):

- Layout: `.claude-plugin/plugin.json` (only `name` required); `skills/`, `agents/`,
  `commands/`, `hooks/hooks.json`, `.mcp.json` at the plugin root.
- A plugin-root `CLAUDE.md` is **not** loaded; `claude plugin validate` warns about it.
- Component paths must resolve inside the plugin; `..` fails. Symlinks to a path
  inside the same marketplace are dereferenced at install, links outside are skipped.
- MCP servers shipped by the plugin get tool names `mcp__plugin_<plugin>_<server>__<tool>`;
  subagent `tools:` lists must use those names. Bare `mcp__atlassian__*` only matches a
  server the user configured themselves.
- Hooks: PreToolUse can block with exit code 2 (stderr becomes the reason) or JSON
  `permissionDecision: "deny"`; the script reads `tool_input.command` from stdin.
  `${CLAUDE_PLUGIN_ROOT}` is available to hooks and inside Markdown bodies.
- Marketplace: `.claude-plugin/marketplace.json` with `name`, `owner`, `plugins[]`;
  a plugin entry can point to a relative path such as `./agents/jira-to-pr`. A private
  GitHub repo is fine; users authenticate with their own git credentials.
  Install: `/plugin marketplace add BrightLocal/ai-workspace` → `/plugin install jira-to-pr@…`.
  Org-wide distribution is also possible from claude.ai Organization settings.

## 4. Requirement 1 — run deptrac / di-check (and the rest) before push

### Findings

- Tools has everything needed, all through Docker:
  `make deptrac` (modules + layers configs), `make di-check` (`bin/console di:a --dry-on --all`),
  `make check-psr4`, `make phpstan`, `make ecs`, `make phpunit`, `make incremental-ci`
  (ECS `--fix` + PHPStan + paratest on files changed vs `master`, ESLint for JS) and
  `make ci-checks` (the full CI set). `AGENTS.md` explicitly says `di-check` must run
  alongside phpunit/phpstan/ecs/deptrac because a green phpstan does not catch DI wiring.
- The lightweight environment is `make setup-worktree`: creates `.env` + `local.ini`,
  downloads schema dumps from the private `BrightLocal/db-schemas` repo (SSH), builds
  the app image, starts db/memcached/redis/es7/app/nginx, runs `composer install`.
- ListingSyncer has `make ecs`, `make phpstan`, `make test` through the `ls` container,
  plus a repo-level `qa-agent` subagent. It has **no** deptrac and no di-check.
- Native (non-Docker) execution was tested on the agent's clone and is not viable:
  local PHP is 8.4 (project is 8.3), `vendor/bin/deptrac analyse` finished in one
  second with zero dependencies analysed and 2 648 errors, and `bin/console di:a`
  dies without `config/local.ini`. Docker is the only supported path.

### Design

1. **`scripts/quality-gate.sh <repo-path> [--changed-only]`** — one deterministic
   script, same in ai-workspace and in the plugin. Per repo:
   - Tools: `make check-psr4` → `make di-check` → `make deptrac` → `bin/incremental-ci.sh`
     (ECS, PHPStan, PHPUnit on changed files). `incremental-ci.sh` runs ECS with `--fix`,
     so the gate re-stages formatted files and reports it.
   - ListingSyncer: `php -l`, ECS, PHPStan, PHPUnit on changed files (`docker compose exec -T ls …`).
   - Writes a machine-readable result `quality-gate.json` (per check: pass/fail/skipped,
     duration, first 40 lines of failure output) into the run directory, and prints a
     short human summary.
   - Exit codes: `0` all pass, `1` a check failed, `3` environment missing
     (no `.docker/.env`, container not running). Exit 3 tells the orchestrator to
     degrade (draft PR + explicit note) instead of blocking forever.
2. **`scripts/setup-quality-env.sh`** (ai-workspace only) — one-time bootstrap of the
   agent's clones: `make setup-worktree` in `workspace/Tools`, `make build && make up`
   in `workspace/ListingSyncer`. Prerequisites printed up front: Docker, SSH access to
   GitHub (`db-schemas` and private Composer packages), VPN not required. Composer
   runs inside Docker via this script, so the agent's own `composer install` deny
   stays in place.
3. **Pipeline change** — new *Phase 4.5 Quality gate* between implementation and
   PR creation, with a bounded fix loop: on failure the implementer gets the
   `quality-gate.json` excerpt, fixes, and the gate re-runs — at most 2 rounds.
   Still red after that → PR is created as **draft**, the failing checks are listed in
   *Additional comments* and in the Jira comment. Never push with an unknown gate state.
4. **Enforcement by hook, not by prose** — `hooks/hooks.json` PreToolUse on `Bash`:
   `scripts/hooks/guard-git-push.sh` reads the command from stdin; for `git push` it
   requires a fresh `quality-gate.json` (same HEAD sha, status pass or degraded-with-draft)
   or exits 2 with the reason. Same hook enforces the diff-lint from requirement 3.
5. **Settings** — allow `Bash(make *)`, `Bash(docker compose *)`, `Bash(bin/incremental-ci.sh)`
   in `.claude/settings.json`; keep `composer install`, `npm install`, force-push denied.

### Acceptance

- A run on a real LM ticket against the agent's clone shows all four Tools checks
  executed, with timings, before `git push`.
- Introducing a deliberate cross-module import makes the gate fail, the implementer
  fixes it, and the PR is created non-draft only after the gate is green.
- With no Docker environment the pipeline still completes with a draft PR and an
  explicit "quality gate skipped: environment missing" note in Jira.

## 5. Requirement 2 — Sentry and Slack context

### Findings

Link formats, measured across 83 LM tickets that mention Sentry or Slack:

| Source | Pattern | Count |
|---|---|---|
| Sentry issue | `https://sentry.bll-i.co.uk/organizations/brightlocal/issues/{numeric-id}/` (often with `?project=…&query=…`) | 29 |
| Sentry short id | `…/issues/TOOLS-BACKEND-AZK`, `…/issues/LISTING-SYNCER-Y6` | 4 |
| Sentry event | `…/issues/{id}/events/{event-id}/` or `/events/recommended/` | 4 |
| Sentry share link | `https://sentry.bll-i.co.uk/share/issue/{hash}/` (public, no auth) | 2 |
| Slack permalink | `https://brightlocal.slack.com/archives/{CHANNEL_ID}/p{16 digits}` (optionally `?thread_ts=…&cid=…` for a reply) | 59 |

Sentry is **self-hosted** (`sentry.bll-i.co.uk`, org slug `brightlocal`, projects
`tools-backend`, `tools-frontend`, `listing-syncer`). The claude.ai "Sentry"
connector targets sentry.io and will not reach it. PR #6 / #9
(`agents/sentry-issue-investigator/config/sentry.md`, `mcp-setup.md`) already
document the working setup: stdio MCP `@sentry/mcp-server` with
`SENTRY_HOST=sentry.bll-i.co.uk`, token from 1Password ("Sentry Claude MCP
Token"), **VPN required at runtime**. Reuse that, do not redo it.

Slack: no existing integration in the workspace. Options are the claude.ai Slack
connector (user OAuth, local mode only) or a Slack app bot token for server mode
(`conversations.replies` with `channel` + `ts`; the bot must be a member of the
channel; scopes `channels:history`, `groups:history`).

### Design

1. **jira-analyzer** gets a new output block and stops interpreting links itself:
   ```yaml
   external_links:
     - {type: sentry_issue, id: "12345", url: "…"}
     - {type: sentry_short_id, id: "TOOLS-BACKEND-AZK", url: "…"}
     - {type: sentry_share, id: "828a40…", url: "…"}
     - {type: slack_thread, channel: "C0123ABCD", ts: "1712345678.901234", thread_ts: null, url: "…"}
   ```
   (`p1712345678901234` → `1712345678.901234`; also fix the comments tool, §2).
2. **New subagent `context-enricher`** (sonnet, read-only) runs as Phase 1.5 whenever
   `external_links` is non-empty. For each link it returns a normalised block and
   writes `01b-external-context.md` into the run directory:
   - Sentry: title, culprit, level, status, first/last seen, event count and period,
     environment, release, top in-app stack frames (max 15, `path:line`), request URL
     and tags, latest event message, linked Jira keys. Short ids resolve through
     `GET /api/0/organizations/brightlocal/shortids/{id}/`; share links through
     `GET /api/0/shared/issues/{hash}/`.
   - Slack: channel name, root message (author, date, text), replies (max 40,
     500 chars each), file names, and a 3–5 line "decisions and asks" summary.
   - Degradation: unreachable server / VPN down / not a member of the channel →
     `status: unresolved` with the reason; the pipeline continues and the planner
     lists it under *Open questions*.
3. **planner** reads the external context: the Sentry stack trace seeds the
   code-researcher entry points; Slack decisions become constraints or assumptions.
4. **Modes.** Local: `sentry-selfhosted` MCP + Slack connector. Server mode: curl
   patterns in `config/integrations.md` (Sentry Bearer token; Slack bot token).
   New env vars in `bot.env.example`: `SENTRY_HOST`, `SENTRY_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`.
5. **Data hygiene.** Slack threads can contain customer data and credentials. The
   enricher redacts tokens / emails / phone numbers; external context is written
   only to the run directory (gitignored) and the plan. It is never quoted in code,
   PR bodies or the Jira comment beyond a one-line "context taken from Slack thread
   {link}".

### Acceptance

- A ticket with a Sentry link produces a plan whose entry points include the
  culprit file from the stack trace without the code-researcher having to guess.
- A ticket with a Slack thread produces a plan that lists at least one decision or
  constraint from the thread with the permalink as its source.
- With the VPN off, the run completes and the Jira comment says which links could
  not be resolved.

## 6. Requirement 3 — comments and naming in generated code

### Findings

- Tools already contains ~350 PHP comments referencing Jira keys, so the agent is
  copying a habit the codebase tolerates. Review feedback says it must not.
- Generic names are everywhere in `src/Modules` (`$result` ≈ 13 400, `$data` ≈ 6 600,
  `$value` ≈ 2 800, `$row` ≈ 2 200, `$item` ≈ 1 400, `$object` ≈ 80 in ~15 500 files).
  "Follow existing approaches" therefore cannot mean "copy the nearest file"; it
  must mean "name things the way the surrounding module names its domain concepts".

### Design — three layers, cheapest first

1. **`config/coding-standards.md`** loaded by planner, implementer and the new reviewer:
   - **Comments.** No Jira keys anywhere in the diff: code, docblocks, test names,
     fixtures. No comments that narrate the change ("added for", "new field",
     "fix for LM-…"). No `TODO`/`FIXME` — open points go to the PR's *Additional
     comments*. A comment is allowed only when it explains a non-obvious *why* that
     stays true without the ticket (rare), or when the project convention requires it
     (`#[CoversClass]`, `@codeCoverageIgnore` with a reason).
   - **Naming procedure.** Before introducing a name, grep the module for the
     concept (entity, DTO, repository method, event) and reuse its vocabulary. Loop
     variables are the singular of the collection (`foreach ($alerts as $alert)`).
     Query results are named by what they hold (`$expiredConnections`, not `$result`).
     Booleans read as predicates (`isConnected`, `hasPendingUpdate`). Abbreviations
     only where the module already uses them (`gmb`, `cb`, `as`).
   - **Banned when introduced by the agent:** `$object $obj $item $row $data $result
     $res $value $val $tmp $temp $arr $array $el $element $info $thing $x $y $i`
     (index `$i` only inside a numeric for-loop). Editing an existing signature that
     already uses one is allowed; renaming unrelated existing code is not.
   - Classes, methods and tests follow the module's existing patterns
     (`{Verb}{Noun}Command`, `{Noun}Query`, `…Handler`, `…Test` with AAA comments).
2. **`scripts/diff-lint.sh`** — deterministic, runs on the staged / branch diff:
   added lines matching `\b[A-Z]{2,6}-\d{2,5}\b` inside comments, docblocks, strings
   or test method names → fail; added `$banned` variable declarations/assignments →
   fail; `TODO|FIXME|XXX` in added lines → fail. Prints file:line and the rule.
   Wired into the push/commit hook (§4.4) and into `quality-gate.sh`.
3. **Planner writes names before code.** The plan gets a *Names to introduce* section
   (class, method, variable → name → where the vocabulary comes from). Naming is
   reviewed on the plan, where it is cheap to change.
4. **New subagent `code-reviewer`** (read-only, Phase 4.6, one round max): reads the
   diff and the touched modules, returns concrete rename suggestions and any comment
   to delete, in a fixed YAML shape; the implementer applies them. It also checks the
   data-volume rules from §7 when the diff touches queries.

### Acceptance

- `diff-lint.sh` fails on a fixture diff containing `// see LM-4358` and `$row = …`,
  passes after the fix.
- On a real run, zero Jira keys in the PR diff and no banned names introduced; the
  plan contains the *Names to introduce* table.

## 7. Requirement 4 — production data volumes

### Findings

- Tools talks to several MySQL databases (from `config/local.ini.example`): main
  `brightlocal` (also serves rankings), `batches`, `proxy`, `jobs` (buried jobs),
  ten rankings shards `shard_01…shard_10`, `profiles`, `logging`,
  `local_active_location`; ListingSyncer uses `listing_syncer`. Production hosts
  differ per database.
- Table structure and indexes are discoverable from the schema dumps
  (`.docker/data/*.sql`, present only after `make setup-worktree`) and from
  `migration/doctrine/`. **Row counts exist nowhere** — that is the missing input.
- Local Docker databases are nearly empty, so `EXPLAIN` there proves index
  *existence* at best, not plan quality; it is weak evidence and the rules must not
  rely on it.

### Design

1. **Input (human, once per host):** `scripts/db-table-stats.sql` (added on this
   branch) returns schema, table, engine, approximate rows, data/index/total MB,
   auto-increment and index count for every base table on a host. The optional
   `scripts/db-table-indexes.sql` lists index columns for tables ≥ 1M rows or ≥ 1 GB.
   Run on a read replica with `mysql --batch --raw` (TSV) or export from a GUI, one
   file per host, into `products/Tools/working/db-stats/`.
2. **`scripts/import-db-stats.py`** merges the TSV/CSV files and writes
   `config/db-table-stats.md`: one row per table with a **tier** and a rounded
   count, sorted by size, plus `generated_at`, source host labels and the refresh
   command. Tiers: **XL** ≥ 10M rows or ≥ 5 GB · **L** ≥ 1M · **M** ≥ 100k · **S** below.
   Rounded values ("~42M") keep business volumes out of the committed file; the
   exact TSVs stay in the gitignored working directory.
3. **`config/db-query-guidelines.md`** — rules by tier, loaded whenever a plan touches
   a repository, native SQL, DQL, Elasticsearch indexer or a migration:
   - L/XL: every filter and join must hit an index that exists in the schema dump or
     migrations; no leading-wildcard `LIKE`, no functions on indexed columns, no `OR`
     across different columns, no unbounded `SELECT`, no `COUNT(*)` in a request path,
     backfills chunked by primary key with a sleep/limit, no `ORDER BY` on a
     non-indexed column over a large range.
   - XL migrations: adding a column or index is a **HIGH** risk item, needs the
     online-DDL note and DBA review in the PR; data migrations run as commands, not
     inside the migration.
   - Prefer the module's existing repository / QueryBuilder pattern over new native
     SQL; a new native query needs a one-line justification in the plan.
4. **Planner** adds a *Data volume impact* section: touched tables → tier → access
   path (which index) → expected row range. **Implementer** carries the same facts
   into the PR's *Additional comments*. **code-reviewer** (§6.4) blocks a diff whose
   query on an L/XL table has no index-backed access path.

### Acceptance

- `import-db-stats.py` turns the real TSVs into a stats file; a spot check of five
  known-large tables shows the right tier.
- A ticket touching an XL table yields a plan with a *Data volume impact* section and
  a HIGH risk item for any schema change; a ticket touching only S tables yields none.

## 8. Phasing

| Phase | Scope | Depends on | Effort |
|---|---|---|---|
| 0 | Branch, this plan, SQL inputs; fix the audit defects of §2 | — | done / 0.5 d |
| 1 | Requirement 3: coding-standards, diff-lint, planner names section, code-reviewer | — | 1 d |
| 2 | Requirement 4: import script, stats + guidelines files, planner/implementer/reviewer wiring | TSV output from the user | done 2026-10-26 for the main host (`brightlocal`); no further exports planned, other schemas default to L; reviewer wiring follows phase 1 |
| 3 | Requirement 1: quality-gate.sh, setup-quality-env.sh, push hook, Phase 4.5 loop, settings | Docker env on the dev machine (SSH to db-schemas, private Composer) | 1.5–2 d |
| 4 | Requirement 2: external_links, context-enricher, integrations.md, env vars, MCP setup | Sentry token (1Password), Slack app/bot or connector, VPN | 1.5–2 d |
| 5 | Plugin packaging: plugin.json, skill-based orchestrator, copied conventions, hooks.json, .mcp.json, marketplace.json, `claude plugin validate`, README, pilot with 2 engineers | phases 1–4 | 2 d |

Phase order is by value per effort and by how little each depends on things
outside this repo. Each phase ends with a full run on a real, recent LM ticket in a
throw-away branch; the run log and the resulting PR link go into the PR description
of the phase.

## 9. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Where the plugin works: engineer's checkout vs plugin-owned clones | Engineer's checkout. It is what gives us Docker, `make`, worktrees and the sibling `../ListingSyncer` convention for free. |
| D2 | Ship `.mcp.json` in the plugin or document user-level MCP setup | Ship it (Atlassian remote with OAuth, `sentry-selfhosted` stdio, Slack) and use `mcp__plugin_jira-to-pr_*` tool names; keep a fallback section for user-level servers. |
| D3 | Gate strictness | Hard block on `deptrac`, `di-check`, ECS, PHPStan and failing tests; soft (draft PR + note) only when the environment is missing. |
| D4 | Slack access path | Local: claude.ai Slack connector. Server mode: a dedicated Slack app bot token; needs workspace admin to create it and to invite the bot to engineering channels. |
| D5 | DB stats granularity in the committed file | Rounded counts and tiers only; exact TSVs stay local. |
| D6 | Marketplace home | `.claude-plugin/marketplace.json` at the ai-workspace root pointing to `./agents/jira-to-pr`; split into its own repo only if the org-wide claude.ai distribution needs it. |

## 10. Risks

- **Docker bootstrap friction.** `make setup-worktree` needs SSH access to
  `db-schemas` and private Composer packages, and ~10 minutes. Mitigation: the gate
  degrades to a draft PR; the plugin README front-loads the prerequisites.
- **Gate duration.** `deptrac` and `di-check` are full-project runs (minutes each).
  Acceptable for one run per ticket; `incremental-ci.sh` keeps the rest proportional.
- **Baseline drift.** `incremental-ci.sh` compares to `master`; the gate must fetch
  `master` first or it lints the wrong set of files.
- **Sentry/Slack availability.** VPN and channel membership failures look like
  "nothing there". The enricher must report *unresolved*, never *no context*.
- **Over-strict naming lint.** Banned names appear in legitimate edits of existing
  code. The lint only flags **added** declarations and allows an explicit
  `diff-lint: allow` marker in the PR body for the rare exception.
- **Plugin tool-name mismatch.** Subagent `tools:` entries silently fail to resolve if
  the MCP server name changes. `claude plugin validate` plus one smoke run per release.

## 11. Reference — files this plan adds or changes

```
agents/jira-to-pr/
├── CLAUDE.md                          # Phase 1.5 enricher, 4.5 gate, 4.6 reviewer (ai-workspace flavour)
├── skills/run/SKILL.md                # plugin orchestrator  (phase 5)
├── .claude/agents/
│   ├── jira-analyzer.md               # external_links, comments fix
│   ├── context-enricher.md            # new
│   ├── planner.md                     # Names to introduce, Data volume impact
│   ├── implementer.md                 # standards, gate loop, make targets
│   └── code-reviewer.md               # new
├── config/
│   ├── coding-standards.md            # new
│   ├── db-table-stats.md              # generated
│   ├── db-query-guidelines.md         # new
│   ├── integrations.md                # Sentry / Slack, local vs server mode
│   ├── git-conventions.md             # copy of shared/engineering (plugin)
│   └── bot.env.example                # SENTRY_*, SLACK_*
├── scripts/
│   ├── db-table-stats.sql             # added on this branch
│   ├── db-table-indexes.sql           # added on this branch
│   ├── import-db-stats.py
│   ├── diff-lint.sh
│   ├── quality-gate.sh
│   ├── setup-quality-env.sh
│   └── hooks/guard-git-push.sh
├── hooks/hooks.json
├── .mcp.json
└── .claude-plugin/plugin.json
.claude-plugin/marketplace.json        # repo root
```
