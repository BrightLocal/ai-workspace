# Jira Label Poller — local AI developer MVP (design)

Date: 2026-10-26
Status: draft — builder-check answers incorporated 2026-10-26, awaiting final read

## Intent

Turn the existing `agents/jira-to-pr` pipeline into a local "AI full-stack developer":
a container on Vadym's laptop that notices LM tickets labelled `AI`, implements them in
the real Tools / ListingSyncer checkouts, **verifies the change against the locally
running stacks**, and opens PRs whose description carries the verification evidence —
so review is about decisions, not about whether it works.

Why now: the ticket→PR pipeline already exists (jira-to-pr, Dockerfile, HTTP trigger from
commit `bd90a66`), but it needs n8n to push work to it, and it only runs whatever tests the
repo allows from a bare clone — which for LS/Tools is nothing, because PHP and its
extensions only exist inside the project docker stacks. The MVP closes both gaps.

## Goals

1. `docker compose up -d` in ai-workspace starts a long-running container that polls
   Jira every 5 minutes and picks up eligible tickets on its own — no n8n.
2. The agent works in Vadym's own checkouts (`products/*/codebase/` → `~/brightLocal/Tools`,
   `~/brightLocal/ListingSyncer`), on an ADR-0019 branch per ticket.
3. Every PR is verified against the running local stacks (HTTP, CLI, read-only SQL) plus
   phpunit / PHPStan / ECS, and the evidence is in the PR description.
4. When the ticket is unclear, the agent asks on the ticket and resumes the same Claude
   session once Vadym answers.

## Non-goals (MVP)

- Slack notifications (Jira watcher emails are enough).
- A bot identity — everything runs under Vadym's own Jira and GitHub tokens.
- Running on a server / for other teammates; laptop asleep = nothing runs, accepted.
- Starting, stopping, or rebuilding the Tools / LS docker stacks.
- Projects other than `LM`.
- Parallel tickets.
- Frontend / browser verification (the existing jira-to-pr scope is backend-first; UI checks
  can be added later).

## Anti-goals (failure even if it "works")

- Agent touches uncommitted work in Vadym's checkouts (stash, reset, checkout over it).
- A non-draft PR is opened while any verification check failed or was skipped silently.
- The agent reads its own comments as human answers and loops.
- Agent merges, force-pushes, deletes branches, or mutates shared data in the local DBs
  beyond test fixtures it created itself.
- A run silently hangs for hours with the ticket stuck in `AI-in-progress` and no comment.

## Constraints and decided choices (Vadym's decisions)

- **Runs as a container**, started by `docker compose up -d` from the ai-workspace root.
  Extends the existing `Dockerfile` / `docker-compose.yml`; the HTTP `/run-agent` endpoint
  stays as a manual trigger.
- **Polling, not webhooks.** Every 5 minutes, JQL:
  `project = LM AND sprint in openSprints() AND labels = AI AND status != Done ORDER BY created ASC`.
- **Option B — real checkouts mounted.** The agent branches and edits in
  `~/brightLocal/Tools` and `~/brightLocal/ListingSyncer` directly, so Vadym's running
  stacks serve the agent's code. Vadym keeps his own work out of those folders while a
  ticket is in progress.
- **Vadym starts the stacks himself.** The agent never runs `make up`, `docker compose up/down`,
  or restarts containers. If a needed container is down it says so on the ticket and stops.
- **Test against the running stacks and put the evidence in the PR.**
- **Vadym's own tokens** for Jira (email + API token) and GitHub (`GH_TOKEN`).
- **LM project only.**
- **Reloading code in the running stacks is allowed** without restarting containers:
  `docker exec` into the container for `cache:clear`, the OpenSwoole reload signal, or killing
  a long-running worker so its supervisor restarts it. Without a reload, HTTP/worker checks
  would test the code the process booted with. If a reload is not possible for a given
  check, that check goes to "Could not verify" — never reported as passed.
- **Migrations may be applied to the shared local DB** (`tools-db-1`, schema `brightlocal`,
  shared by LS and Tools and holding Vadym's data) for verification, and **must be rolled
  back** (`--down`) at the end of verification; the rollback itself is a verification check.
  Mirrored migrations (same migration in both repos) are run from one repo only.
- **A checkout is "free" only if it is on the repo's default branch (`master`) or on an
  earlier agent branch** (recorded in `state.json`), in addition to a clean working tree.
  Otherwise the ticket is skipped with a marked comment and label `AI-failed`.
- **Pause switch:** while `personal/ai-poller.paused` exists, the poller does nothing
  (no pickups, no resumes). Vadym creates/deletes it by hand.
- **Dependency mismatch is a pre-flight stop:** if the ticket branch's `composer.lock`
  differs from what is installed in the container's `vendor/`, the agent does not install —
  it posts a marked comment asking Vadym to run `composer install`, label `AI-needs-input`.

## How it works

### Components

```
docker compose (ai-workspace root)
└── ai-workspace container (uid 1000, Node 20 + gh + claude + docker CLI)
    ├── poller.js        — every 5 min: JQL, lock, dispatch, needs-input check, stale check
    ├── index.js         — existing HTTP trigger (POST /run-agent), kept
    └── run-agent.sh     — runs `claude -p` on one ticket (existing, extended)
Mounts:
    ~/brightLocal/ai-workspace   → same absolute path
    ~/brightLocal/Tools          → same absolute path   (so codebase symlinks resolve)
    ~/brightLocal/ListingSyncer  → same absolute path
    ~/.claude                    → /home/<user>/.claude (Claude login reuse)
    /var/run/docker.sock         → for `docker exec` into the running stacks
```

Mount the paths at **the same absolute paths** as on the host so the
`products/*/codebase/*` symlinks and any absolute paths in logs resolve identically.
The container runs as uid/gid 1000 with the host `docker` group (gid 999) added, so files it
writes are owned by Vadym and it can use the socket.

Accepted trade-off: the Docker socket gives the container effective root on the laptop.
The container is for reproducibility and one-command start/stop, not for isolation.

### Ticket lifecycle (labels)

| Label | Meaning | Set by |
|---|---|---|
| `AI` | Please work on this | Vadym |
| `AI-in-progress` | Picked up; acts as the lock | poller, first thing |
| `AI-needs-input` | Agent asked a question, waiting | agent |
| `AI-done` | PR(s) opened, all verification passed | agent |
| `AI-draft` | PR(s) opened as draft; verification failed or partial | agent |
| `AI-failed` | Crashed, timed out, or pre-flight refused | runner / poller |

Exactly one `AI*` label at a time. Replace the existing `ai-processing` / `ai-error` names in
`run-agent.sh` with these.

### Poller loop (deterministic — no Claude)

Each tick (5 min, configurable `POLL_INTERVAL_SEC`):

1. If a run is active → only do the stale check; return.
2. **Needs-input check:** JQL `project = LM AND labels = AI-needs-input`. For each, fetch
   comments; if there is a comment *without the agent marker* newer than the agent's last
   marked question → swap label to `AI-in-progress`, resume that ticket's session (see below).
3. **New work:** run the main JQL; take the oldest hit only.
4. **Lock:** label `AI` → `AI-in-progress` and post a marked "picked up" comment *before*
   spawning Claude. If the label update fails, skip the ticket this tick.
5. **Pre-flight (in the poller, before Claude):**
   - Pause file `personal/ai-poller.paused` absent (checked at the very start of the tick).
   - Both repos' working trees clean (`git status --porcelain` empty). If not → comment
     "skipped: uncommitted changes in {repo}", label `AI-failed`, do not touch the repo.
   - Both repos on `master` or on an earlier agent branch. If not → comment
     "skipped: {repo} is on {branch}", label `AI-failed`.
   - Required stack containers running (`docker ps` for `listing_syncer` and `tools-app-1`;
     match the real container names from the repos' compose files).
     If not → marked comment asking Vadym to start them, label `AI-needs-input`
     (a later unmarked comment resumes, same as a question).
   - The `composer.lock` mismatch check runs after the ticket branch is checked out
     (start of implementation), with the same `AI-needs-input` outcome.
6. **Dispatch:** `run-agent.sh LM-1234` with a hard timeout (`RUN_TIMEOUT_MIN`, default 90).
7. **Stale check:** any `AI-in-progress` ticket with no update for 3h and no active run →
   marked comment + `AI-failed`. No automatic retry.

One run at a time, enforced by an in-process flag plus a lockfile (so the HTTP trigger and
the poller cannot both start runs).

### Agent comment marker

Every comment the agent or poller posts starts with `🤖 ai-workspace:` and ends with a hidden
run id (e.g. a trailing `[run:20261026-1012-LM-1234]`). The needs-input check treats only
**unmarked** comments as human replies. Required because the agent posts as Vadym.

### Sessions and resume

`run-agent.sh` runs `claude -p ... --output-format json` and stores `{issueKey → session_id,
last_question_comment_id, branch(es)}` in `agents/jira-to-pr/workspace/state.json`
(gitignored). Resume = `claude -p --resume <session_id> "<the human reply text>"`.

Before any resume: re-run pre-flight, then check out the ticket's branch(es) recorded in
`state.json` — the checkout may have moved since the question was asked. If no session
exists yet (e.g. the ticket was parked because a stack was down before Claude started),
start the ticket fresh instead of resuming.

### Pipeline changes in jira-to-pr

Existing phases stay (Jira analysis → code research → plan → implement → PR → Jira report).
Changes:

1. **Repo paths:** use `products/Tools/codebase/Tools` and
   `products/ListingSyncer/codebase/ListingSyncer` instead of `workspace/{repo}`. Drop
   `clone-repos.sh` from the poller flow (keep the script for server use).
2. **Branch start point:** implementer fetches and branches from up-to-date `origin/master`
   (both repos' default) — it must not branch from whatever Vadym had checked out. If the
   ticket or its parent epic names a base branch (e.g. `epic/LM-4380-bing-via-api`), branch
   from and target the PR at that branch instead.
   After the run, **leave the repo on the ticket branch** so Vadym can click through it.
3. **Clarification exit:** if Jira analysis or planning finds missing acceptance criteria
   or a real ambiguity, post marked questions, set `AI-needs-input`, end the run cleanly
   (exit 0). Do not guess.
4. **Planner adds a "How to verify" section** — concrete, executable checks derived from the
   acceptance criteria (HTTP calls to LS/Tools, CLI commands in the containers, read-only
   SQL, expected results).
5. **New Phase: Verification** (new `verifier` subagent), between implement-and-commit and
   PR creation:
   - phpunit for touched areas, PHPStan and ECS on changed files, via the existing
     container commands (`docker compose exec -T ls ...` / `docker exec tools-app-1 ...`;
     see the LS/Tools conventions).
   - New code gets new tests; each new test is mutation-checked (break the code under test,
     confirm the test fails, restore).
   - Each "How to verify" check is executed against the running stacks; record command,
     trimmed output, pass/fail.
   - Before HTTP/worker checks, reload the affected processes (see Constraints) so checks
     run against the new code.
   - Writes allowed only to test data the verifier created itself, plus applying and then
     rolling back the ticket's migrations; cleans everything up afterwards.
   - On failure: back to the implementer with the failure, max 3 attempts.
   - Writes `workspace/runs/{run}/verification.md`.
6. **PR rules:** PR description gets a **Verification** section (checks, commands, trimmed
   output, unit-test before/after counts, and an explicit "Could not verify" list with
   reasons). All checks pass → ready PR, label `AI-done`. Anything failed or unverifiable
   → **Draft** PR with failing checks at the top, label `AI-draft`.
7. **Jira credentials:** server-mode REST calls use `JIRA_EMAIL` / `JIRA_API_TOKEN`
   (Vadym's), replacing the `JIRA_BOT_*` names. In the container, MCP OAuth is not
   available, so `SERVER_MODE=true` (REST) is the mode.
8. **Permissions:** `.claude/settings.json` allows `Bash(docker exec *)`,
   `Bash(docker compose exec *)`, `Bash(curl *)` and edits under the two repo paths; keeps all
   existing denies; adds denies for `docker compose up*`, `docker compose down*`,
   `docker stop*`, `docker rm*`, `make up*`, `gh pr merge*`.

### Configuration (`.env`, gitignored)

```
JIRA_EMAIL=            # Vadym
JIRA_API_TOKEN=
GH_TOKEN=
POLL_INTERVAL_SEC=300
RUN_TIMEOUT_MIN=90
MAX_TURNS=
JIRA_JQL=project = LM AND sprint in openSprints() AND labels = AI AND status != Done ORDER BY created ASC
HOST_UID=1000
HOST_DOCKER_GID=999
WEBHOOK_SECRET=        # for the kept manual HTTP trigger
```

Claude auth: reuse Vadym's login via the mounted `~/.claude` **and** `~/.claude.json`
(no `ANTHROPIC_API_KEY`).

Git push: the repos' remotes are SSH (`git@github.com:`). Inside the container, set a
global `url."https://x-access-token:${GH_TOKEN}@github.com/".insteadOf git@github.com:`
(container git config only — never the repos' own `.git/config`).

Jira statuses: the agent never transitions ticket status — labels and comments only.
Retry of a failed ticket: Vadym swaps `AI-failed` back to `AI`.

## Build order (each step testable on its own)

1. Container runs as uid 1000 with mounts + docker CLI; `docker exec tools-app-1 php -v`
   works from inside.
2. Poller that only logs matching tickets.
3. Label lock + marked "picked up" comment + pre-flight checks.
4. Dispatch to `run-agent.sh` with timeout; `AI-done` / `AI-failed` handling; stale check.
5. jira-to-pr path changes + branch-from-origin/main.
6. Verification phase + PR evidence + draft rules.
7. Needs-input / resume loop.

Pilot: a small, well-specified LM ticket touching one repo.

## Left to the builder

- Exact Node structure of `poller.js` (single loop vs. setInterval), logging format.
- Exact `state.json` shape.
- How the verifier discovers base URLs/ports of the running stacks (read the repos'
  compose files / env).
- Exact `--max-turns` default.
- Whether to run poller and HTTP server in one Node process or two.
