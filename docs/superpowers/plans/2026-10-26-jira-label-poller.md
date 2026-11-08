# Jira Label Poller MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A container on Vadym's laptop that polls LM every 5 minutes for `AI`-labelled tickets, runs the jira-to-pr pipeline in his mounted Tools/LS checkouts, verifies the change against his running stacks, and opens PRs carrying the evidence.

**Architecture:** A deterministic Node poller (no Claude on the hot path) owns Jira search, labels, pre-flight checks, the run lock and session state. It dispatches one ticket at a time to `run-agent.sh`, which runs headless Claude with the jira-to-pr pipeline and writes a `result.json`; the poller reads that file and sets the outcome label. The pipeline gains a verifier subagent and Draft/ready PR rules.

**Tech Stack:** Node 20 (built-in `fetch`, `node:test`, no new npm deps), bash, Docker + compose, Claude Code CLI headless, Jira Cloud REST v3, `gh`.

**Spec:** `docs/superpowers/specs/2026-10-26-jira-label-poller-design.md`

## Global Constraints

- Project scope: LM only. Default JQL: `project = LM AND sprint in openSprints() AND labels = AI AND status != Done ORDER BY created ASC`.
- Labels, exactly one `AI*` at a time: `AI`, `AI-in-progress`, `AI-needs-input`, `AI-done`, `AI-draft`, `AI-failed`. Old names `ai-processing` / `ai-error` are removed.
- Comment marker: every agent/poller comment starts with `🤖 ai-workspace:` and ends with `[run:<runId>]`. Only unmarked comments count as human replies.
- Defaults: `POLL_INTERVAL_SEC=300`, `RUN_TIMEOUT_MIN=90`, stale threshold 3h, verification retry cap 3.
- Pause file: `personal/ai-poller.paused` (relative to ai-workspace root) — while present, the poller does nothing.
- Checkout is free only if: clean tree AND on `master` or on a branch recorded in `state.json` as an agent branch.
- Container names: `listing_syncer` (LS), `tools-app-1` (Tools). Both repos' default branch: `master`.
- Credentials: `JIRA_EMAIL`, `JIRA_API_TOKEN`, `GH_TOKEN` (Vadym's). No `ANTHROPIC_API_KEY`; Claude login via mounted `~/.claude` + `~/.claude.json`.
- Jira base URL: `https://brightlocal.atlassian.net`. The agent never transitions ticket status.
- Agent never runs: `composer install`, `docker compose up/down`, `docker stop/rm`, `make up`, `gh pr merge`, force push.
- Mounts at identical absolute paths: `/home/lenovo/brightLocal/ai-workspace`, `/home/lenovo/brightLocal/Tools`, `/home/lenovo/brightLocal/ListingSyncer`. Container runs as `HOST_UID`/`HOST_GID` (1000) with supplementary group `HOST_DOCKER_GID` (999).
- Commits in this repo: Conventional Commits, no AI `Co-Authored-By` lines (bl-commit rules).
- Environment-specific commands (container names, test/reload/migration/SQL commands, base URLs, forbidden ops) live ONLY in `agents/jira-to-pr/config/environments/<TARGET_ENV>.md` (`TARGET_ENV` default `local`). Agent prompts reference that file; they never hard-code `docker exec ...` commands. The poller's own Node code may use container names from config.

## Review Focus

1. **Jira returns comment bodies as ADF JSON, not strings** — marker detection must extract text from ADF; a marked comment must never be read as a human reply (Task 2 test `isAgentComment detects marker inside ADF`).
2. **Claude run killed by timeout or crashing before writing `result.json`** — must become `AI-failed` with a comment, not stay `AI-in-progress` (Task 5 test `missing result.json maps to failed`).
3. **Jira/network error mid-tick (401, 5xx, DNS)** — the tick logs and returns; the loop keeps running and no labels change half-way (Task 6 test `tick survives jira error`).
4. **Missing or corrupt `state.json`** — load as empty state, never crash the poller (Task 3 test `loadState tolerates corrupt json`).
5. **Manual HTTP trigger while a poller run is active** — the shared lockfile rejects it with 409 (Task 6 test `http trigger respects run lock`).

---

## File Structure

```
agents/jira-to-pr/server/
  index.js                 MODIFY  HTTP trigger; uses shared lock + dispatcher; starts poller loop
  package.json             MODIFY  "test": "node --test test/"
  poller/
    config.js              CREATE  loadConfig(env) → frozen config object
    jira.js                CREATE  REST v3 client (search, labels, comments)
    marker.js              CREATE  comment marker + ADF text helpers
    state.js               CREATE  state.json load/save per ticket
    preflight.js           CREATE  repo + container + lock-file checks
    lockcheck.js           CREATE  composer.lock vs vendor/composer/installed.json (CLI too)
    runlock.js             CREATE  single-run lockfile
    dispatcher.js          CREATE  spawn run-agent.sh with timeout, read result.json
    tick.js                CREATE  one poll cycle orchestrating all of the above
    loop.js                CREATE  startPollerLoop(deps) — interval + error isolation
  test/*.test.js           CREATE  node:test suites, one per module
agents/jira-to-pr/scripts/run-agent.sh   MODIFY  json output, resume, result.json, drop label curl
agents/jira-to-pr/CLAUDE.md              MODIFY  repo paths, clarification exit, Phase 4.5 Verification, result.json contract
agents/jira-to-pr/config/server-mode.md  MODIFY  JIRA_EMAIL/JIRA_API_TOKEN, marker rule, search/jql endpoint
agents/jira-to-pr/config/bot.env.example MODIFY  new variable set
agents/jira-to-pr/.claude/agents/implementer.md  MODIFY  codebase paths, branch base, lockcheck, leave on branch
agents/jira-to-pr/.claude/agents/planner.md      MODIFY  "How to verify" section, plan path
agents/jira-to-pr/.claude/agents/verifier.md     CREATE  verification subagent
agents/jira-to-pr/.claude/skills/bl-create-pr/SKILL.md  MODIFY  Verification section + draft rule
agents/jira-to-pr/.claude/settings.json  MODIFY  allow/deny lists
Dockerfile, docker-compose.yml           MODIFY  uid, docker CLI, mounts, git insteadOf
agents/jira-to-pr/docs/local-poller.md   CREATE  how to run / pause / retry
```

Decision (builder's call, consistent with the spec's "deterministic poller"): **Claude posts comments; the poller owns labels.** The agent reports its outcome in `result.json`; the poller maps it to a label. This keeps label state correct even when Claude crashes.

### result.json contract (written by the agent to `$RUN_DIR/result.json`)

```json
{
  "status": "done | draft | needs_input | failed",
  "summary": "one line",
  "prs": [{ "repo": "Tools", "url": "https://github.com/...", "draft": false }],
  "branches": { "Tools": "task/LM-1234-x", "ListingSyncer": "task/LM-1234-x" },
  "question_comment_id": "12345"
}
```
`run-agent.sh` adds `"session_id"` from Claude's JSON output. Status → label: `done→AI-done`, `draft→AI-draft`, `needs_input→AI-needs-input`, `failed`/missing/unparseable→`AI-failed`.

---

### Task 1: Config loader

**Files:**
- Create: `agents/jira-to-pr/server/poller/config.js`
- Modify: `agents/jira-to-pr/server/package.json` (add `"test": "node --test test/"`, `"engines": {"node": ">=20"}`)
- Test: `agents/jira-to-pr/server/test/config.test.js`

**Interfaces:**
- Produces: `loadConfig(env: Record<string,string>) → Config` where `Config = { targetEnv /* TARGET_ENV, default 'local' */, envFile /* <root>/agents/jira-to-pr/config/environments/<targetEnv>.md */, jiraBaseUrl, jiraEmail, jiraToken, jql, pollIntervalMs, runTimeoutMs, staleMs, maxTurns|null, workspaceRoot, pauseFile, statePath, lockPath, runsDir, repos: [{name, path, container}] }`. Throws `Error('Missing required env: JIRA_EMAIL')` style for missing `JIRA_EMAIL`, `JIRA_API_TOKEN`, `GH_TOKEN`.

- [ ] **Step 1: Write failing tests** — `loadConfig applies defaults` (`pollIntervalMs === 300000`, `runTimeoutMs === 5400000`, `staleMs === 10800000`, `jql` equals the Global Constraints JQL, `repos` = `[{name:'Tools', path:'<root>/products/Tools/codebase/Tools', container:'tools-app-1'}, {name:'ListingSyncer', path:'<root>/products/ListingSyncer/codebase/ListingSyncer', container:'listing_syncer'}]`, `pauseFile` = `<root>/personal/ai-poller.paused`, `statePath` = `<root>/agents/jira-to-pr/workspace/state.json`, `lockPath` = `<root>/agents/jira-to-pr/workspace/run.lock`); `loadConfig honours overrides` (`POLL_INTERVAL_SEC=60` → 60000, `RUN_TIMEOUT_MIN=10` → 600000, `JIRA_JQL`); `loadConfig throws on missing JIRA_API_TOKEN`. `<root>` comes from `WORKSPACE_ROOT` env, default `path.resolve(__dirname, '../../../..')`.
- [ ] **Step 2:** Run `cd agents/jira-to-pr/server && npm test` — expect FAIL (module not found).
- [ ] **Step 3:** Implement `loadConfig` in `poller/config.js`; return `Object.freeze(...)`.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit `feat(jira-to-pr): add poller config loader`.

### Task 2: Jira client + comment marker

**Files:**
- Create: `agents/jira-to-pr/server/poller/jira.js`, `agents/jira-to-pr/server/poller/marker.js`
- Test: `agents/jira-to-pr/server/test/jira.test.js`, `agents/jira-to-pr/server/test/marker.test.js`

**Interfaces:**
- Produces (`marker.js`): `MARKER = '🤖 ai-workspace:'`; `markText(text: string, runId: string) → string` (`"🤖 ai-workspace: <text>\n[run:<runId>]"`); `adfToText(adf: object|string) → string` (concatenate all `text` nodes, newline between block nodes); `isAgentComment(body: object|string) → boolean` (`adfToText(body).trimStart().startsWith(MARKER)`); `textToAdf(text: string) → object` (one paragraph per line).
- Produces (`jira.js`): `createJiraClient({ baseUrl, email, token, fetchImpl = fetch }) → { search(jql, fields=['summary','labels','updated']) → Promise<Issue[]>, setAiLabel(key, from: string|null, to: string) → Promise<void>, comment(key, text, runId) → Promise<{id}>, getComments(key) → Promise<{id, created, body}[]> }`. `Issue = { key, labels: string[], updated: string }`. Non-2xx → throw `JiraError(status, bodyText)`.
- Endpoints: `POST /rest/api/3/search/jql` body `{jql, fields, maxResults: 50}`; `PUT /rest/api/3/issue/{key}` body `{update:{labels:[{remove:from},{add:to}]}}` (omit remove when `from` null) — one request so the swap is atomic; `POST /rest/api/3/issue/{key}/comment` body `{body: textToAdf(markText(text, runId))}`; `GET /rest/api/3/issue/{key}/comment?orderBy=created&maxResults=100`. Basic auth `email:token`.

- [ ] **Step 1: Write failing tests** with a fake `fetchImpl` recording calls:
  - `markText prefixes marker and appends run id`
  - `isAgentComment detects marker inside ADF` (ADF doc whose first paragraph text is `🤖 ai-workspace: question` → true; plain human ADF → false; string body → works too)
  - `search posts jql to search/jql and maps issues` (asserts URL, method `POST`, auth header `Basic base64(email:token)`, returns `[{key:'LM-1', labels:['AI'], updated:'...'}]`)
  - `setAiLabel sends remove and add in one PUT`
  - `comment wraps text with marker as ADF`
  - `non-2xx throws JiraError with status`
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit `feat(jira-to-pr): add Jira REST client and comment marker`.

### Task 3: State store + run lock

**Files:**
- Create: `agents/jira-to-pr/server/poller/state.js`, `agents/jira-to-pr/server/poller/runlock.js`
- Test: `agents/jira-to-pr/server/test/state.test.js`, `agents/jira-to-pr/server/test/runlock.test.js`

**Interfaces:**
- Produces (`state.js`): `loadState(path) → State`; `saveState(path, state) → void` (write to `path.tmp` then rename); `getTicket(state, key) → TicketState|undefined`; `setTicket(state, key, patch) → State` (shallow merge, returns new object); `agentBranches(state) → Set<string>` (all branch names across tickets). `State = { tickets: { [key]: { sessionId?, runId?, branches?: {[repo]: string}, questionCommentId?, lastStatus?, updatedAt } } }`.
- Produces (`runlock.js`): `acquireRunLock(lockPath, owner: string) → boolean` (`fs.openSync(path,'wx')`, writes `{owner, pid, at}`; returns false if exists); `releaseRunLock(lockPath) → void`; `readRunLock(lockPath) → {owner,pid,at}|null`; `clearStaleLock(lockPath) → boolean` (removes the lock if its pid is not alive — `process.kill(pid, 0)` throws ESRCH).

- [ ] **Step 1: Write failing tests** (temp dir via `fs.mkdtempSync`): `loadState returns empty on missing file` (`{tickets:{}}`); `loadState tolerates corrupt json` (file `{nope` → `{tickets:{}}`, no throw); `saveState round-trips`; `agentBranches collects branches`; `acquireRunLock is exclusive` (second call false); `releaseRunLock frees lock`; `clearStaleLock removes lock of dead pid` (write lock with pid `999999`).
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit `feat(jira-to-pr): add poller state store and run lock`.

### Task 4: Pre-flight checks + composer lock check

**Files:**
- Create: `agents/jira-to-pr/server/poller/preflight.js`, `agents/jira-to-pr/server/poller/lockcheck.js`
- Test: `agents/jira-to-pr/server/test/preflight.test.js`, `agents/jira-to-pr/server/test/lockcheck.test.js`

**Interfaces:**
- Consumes: `agentBranches(state)` (Task 3), `Config.repos`, `Config.pauseFile` (Task 1).
- Produces (`preflight.js`): `isPaused(pauseFile) → boolean`; `checkRepos(repos, agentBranchSet, run = execGit) → {ok: true} | {ok:false, outcome:'failed', reason: string}` — reasons exactly `"uncommitted changes in <name>"` and `"<name> is on <branch>"`; `checkContainers(repos, run = execDocker) → {ok:true} | {ok:false, outcome:'needs_input', reason:"containers not running: <names joined ', '>"}`. `execGit(repoPath, args) → string` wraps `git -C`; `execDocker(args) → string` wraps `docker`; both injectable for tests. Container check uses `docker ps --format {{.Names}}`.
- Produces (`lockcheck.js`): `compareLock(repoPath) → {ok:true} | {ok:false, mismatches: [{name, locked, installed}]}` — compare `packages` + `packages-dev` name→version in `composer.lock` with `packages` in `vendor/composer/installed.json` (both v2 `{packages:[...]}` and v1 array shapes). CLI: `node poller/lockcheck.js <repoPath>` prints mismatches, exit `0` ok / `3` mismatch / `2` file missing.

- [ ] **Step 1: Write failing tests** with fake `run` functions and fixture JSON files in a temp dir:
  - `checkRepos fails on dirty tree` (porcelain output non-empty → reason `uncommitted changes in Tools`)
  - `checkRepos fails when on a human branch` (branch `task/LM-4507-x` not in agent set → `Tools is on task/LM-4507-x`)
  - `checkRepos passes on master and on agent branch`
  - `checkContainers reports missing containers` (ps lists only `tools-app-1` → `containers not running: listing_syncer`)
  - `isPaused reflects pause file`
  - `compareLock detects version mismatch` / `compareLock ok when equal` / `compareLock handles v1 installed.json array`
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` — PASS. Also run against real repos: `node poller/lockcheck.js /home/lenovo/brightLocal/Tools; echo $?` — expect `0` (or a real mismatch list).
- [ ] **Step 5:** Commit `feat(jira-to-pr): add poller pre-flight and composer lock checks`.

### Task 5: Dispatcher + run-agent.sh contract

**Files:**
- Create: `agents/jira-to-pr/server/poller/dispatcher.js`
- Modify: `agents/jira-to-pr/scripts/run-agent.sh`
- Test: `agents/jira-to-pr/server/test/dispatcher.test.js`, fixture `agents/jira-to-pr/server/test/fixtures/fake-run-agent.sh`

**Interfaces:**
- Consumes: `Config.runTimeoutMs`, `Config.runsDir`.
- Produces: `runTicket({ key, runId, resume?: {sessionId, message} }, { config, script = <agentDir>/scripts/run-agent.sh, spawnImpl = spawn }) → Promise<Result>`, `Result = { status, summary, prs, branches, questionCommentId, sessionId, runDir, exitCode, timedOut }`. Kills the process group (`detached:true`, `process.kill(-pid,'SIGTERM')`, then `SIGKILL` after 10s) on timeout. Reads `<runDir>/result.json`; missing/unparseable or `timedOut` → `status:'failed'`. `newRunId(key) → "<YYYYMMDD-HHmmss>-<key>"`.
- `run-agent.sh` new contract: `run-agent.sh <KEY> <RUN_ID> [--resume <SESSION_ID> --message <TEXT>]`. RUN_DIR = `workspace/runs/<RUN_ID>`. Runs `claude -p --output-format json --permission-mode acceptEdits --add-dir <Tools path> --add-dir <LS path> [--max-turns $MAX_TURNS] [--resume <id>] "<prompt>"` with stdout to `$RUN_DIR/claude.json`, stderr to `$RUN_DIR/agent.log`. Prompt (fresh, `$ENV_FILE` from `TARGET_ENV`, default `config/environments/local.md`): `Execute the full workflow for Jira task <KEY>. Run id: <RUN_ID>. Target environment: <ENV_FILE>. Follow the phase sequence from CLAUDE.md. Write result.json to <RUN_DIR> as specified in CLAUDE.md.` Prompt (resume): `Vadym replied on <KEY>: <TEXT>. Continue the workflow from where you stopped. Run id: <RUN_ID>. Write result.json to <RUN_DIR>.` After Claude exits, merge `session_id` from `claude.json` into `result.json` with `jq` (create `{"status":"failed"}` if result.json absent). Remove the old `ai-processing`/`ai-error` curl block.

- [ ] **Step 1: Write failing tests** using the fake script (writes a given result.json, or sleeps, or exits without writing, controlled by env):
  - `runTicket returns parsed result and session id`
  - `missing result.json maps to failed`
  - `timeout kills the run and maps to failed` (timeout 200ms, fake sleeps 5s → `timedOut:true`, `status:'failed'`)
  - `resume passes --resume and --message args` (fake echoes args into result.summary)
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Implement `dispatcher.js`; rewrite `run-agent.sh` per contract; add `jq` to the Dockerfile apt list in Task 8 (note it there).
- [ ] **Step 4:** `npm test` — PASS. `bash -n agents/jira-to-pr/scripts/run-agent.sh` — no output.
- [ ] **Step 5:** Commit `feat(jira-to-pr): add run dispatcher with timeout and result contract`.

### Task 6: Tick orchestration, loop, HTTP trigger

**Files:**
- Create: `agents/jira-to-pr/server/poller/tick.js`, `agents/jira-to-pr/server/poller/loop.js`
- Modify: `agents/jira-to-pr/server/index.js`
- Test: `agents/jira-to-pr/server/test/tick.test.js`, `agents/jira-to-pr/server/test/index.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `tick(deps) → Promise<TickReport>` where `deps = { config, jira, state: {load, save}, preflight: {isPaused, checkRepos, checkContainers}, lock: {acquire, release, read, clearStale}, runTicket, now = () => new Date(), log }` and `TickReport = { action: 'paused'|'busy'|'idle'|'resumed'|'started'|'skipped'|'error', key?, detail? }`. `startPollerLoop(deps) → { stop() }` runs `tick` immediately then every `config.pollIntervalMs`, never overlapping, catching all errors (→ `log`). `index.js` exports `createApp(deps)` for tests; when run directly it starts the HTTP server and the loop.

Tick order (spec "Poller loop"):
1. `isPaused` → `paused`.
2. `clearStale(lockPath)`; if lock held → stale check only (step 7) → `busy`.
3. Needs-input: `search('project = LM AND labels = "AI-needs-input"')`; for each, `getComments`; human reply = newest comment where `!isAgentComment(body)` and `created` > created of `questionCommentId` (or any unmarked comment after the last marked one if no id). First ticket with a reply: pre-flight (repos + containers) → on fail comment reason, keep/set label per outcome; on pass `setAiLabel(key,'AI-needs-input','AI-in-progress')`, acquire lock, `runTicket` with `resume` if `sessionId` exists else fresh → `resumed`.
4. New work: `search(config.jql)`; none → `idle`. Take first.
5. Lock ticket: `setAiLabel(key,'AI','AI-in-progress')`; on throw → `skipped` (no further calls). Comment `picked up (run <runId>)`.
6. Pre-flight: repos fail → comment `skipped: <reason>`, `setAiLabel(key,'AI-in-progress','AI-failed')`; containers fail → comment `<reason> — please start them and reply here`, label `AI-needs-input`, `setTicket` without sessionId. Pass → acquire run lock (`owner:'poller'`), `runTicket`, then label from status map, `setTicket(key,{sessionId, runId, branches, questionCommentId, lastStatus})`, on `failed` comment `run failed — see workspace/runs/<runId>`; always release lock → `started`.
7. Stale: `search('project = LM AND labels = "AI-in-progress" AND updated < "-3h"')`; if no run is active for that key → comment `no progress for 3h, marking failed`, label `AI-failed`.
Any thrown error in steps 3–7 → log, release lock if this tick acquired it, return `{action:'error', detail}` — never rethrow.

- [ ] **Step 1: Write failing tests** with in-memory fakes for every dep:
  - `tick does nothing when paused`
  - `tick picks oldest AI ticket, swaps label, comments, runs, sets AI-done`
  - `tick maps draft/needs_input/failed results to labels` (table test)
  - `tick skips ticket when label swap fails` (no runTicket call)
  - `tick marks AI-failed on dirty repo without running`
  - `tick parks ticket as AI-needs-input when containers are down`
  - `tick resumes needs-input ticket on unmarked reply with sessionId`
  - `tick ignores marked comments as replies`
  - `tick starts fresh when needs-input ticket has no session`
  - `tick flags stale in-progress ticket`
  - `tick survives jira error` (search throws → `action:'error'`, lock released, no label calls)
  - `http trigger respects run lock` (lock held → `POST /run-agent` 409; free → 202 and lock acquired with owner `http`)
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Implement `tick.js`, `loop.js`; refactor `index.js` to use `acquireRunLock`/`runTicket` instead of its in-memory `Set`, keep `X-Webhook-Secret` check and `GET /health` (add `paused` and `lock` to its JSON).
- [ ] **Step 4:** `npm test` — PASS (all suites).
- [ ] **Step 5:** Commit `feat(jira-to-pr): add poller tick loop and share run lock with HTTP trigger`.

### Task 7: Pipeline changes — paths, clarification exit, verifier, PR evidence

**Files:**
- Modify: `agents/jira-to-pr/CLAUDE.md`, `agents/jira-to-pr/config/server-mode.md`, `agents/jira-to-pr/.claude/agents/implementer.md`, `agents/jira-to-pr/.claude/agents/planner.md`, `agents/jira-to-pr/.claude/skills/bl-create-pr/SKILL.md`, `agents/jira-to-pr/.claude/settings.json`
- Create: `agents/jira-to-pr/.claude/agents/verifier.md`, `agents/jira-to-pr/config/environments/local.md`

**Interfaces:**
- Consumes: `result.json` contract (top of plan), marker format (Task 2), `node agents/jira-to-pr/server/poller/lockcheck.js <repo>` exit codes (Task 4), target environment path from the run prompt (Task 5).
- Produces: `workspace/runs/<RUN_ID>/verification.md`; PR body `## Verification` section.

Content each file must carry (prose; the implementer writes the wording). All concrete commands below go into `environments/local.md`; the agent prompts only say "use the commands from the target environment file":
- **environments/local.md:** sections `Repos` (the two codebase paths, default branch `master`), `Containers` (`listing_syncer`, `tools-app-1`, plus the DB container — read its name from Tools' `docker-compose.yml`), `Unit tests / static checks` (the phpunit/PHPStan/ECS commands listed under implementer.md below), `Reloading code` (cache clear, OpenSwoole reload, worker restart — verifier discovers exact commands from repo config on first run and the file says so), `Migrations` (apply + `--down` per repo; mirrored migrations from one repo only), `Database` (read-only SQL via `docker exec` into the DB container; writes only to rows the run created), `Base URLs` (read from the repos' compose/nginx config), `Dependencies` (lockcheck CLI; never `composer install`), `Forbidden` (start/stop/restart containers, `make up`).
- **CLAUDE.md:** repos are `products/Tools/codebase/Tools` and `products/ListingSyncer/codebase/ListingSyncer` (no cloning in poller mode); every Jira comment uses the marker format via the REST pattern in server-mode.md and includes the run id; **clarification exit** — if Phase 1 or 3 finds missing acceptance criteria or real ambiguity, post one marked comment with numbered questions, write `result.json` `{status:"needs_input", question_comment_id}`, stop with exit 0; never change labels or ticket status (poller owns them); new **Phase 4.5 Verification** using the verifier subagent, loop back to implementer on failure max 3 attempts; Phase 5 PR via bl-create-pr with draft decided by verification; final step always writes `result.json` (status `done` only if all checks passed and PRs are ready; `draft` if any PR is draft).
- **server-mode.md:** env names `JIRA_EMAIL` / `JIRA_API_TOKEN`; search uses `POST /rest/api/3/search/jql`; comment body must start with `🤖 ai-workspace:` and end with `[run:<RUN_ID>]`; remove label-editing examples (poller owns labels).
- **implementer.md:** work in the codebase paths; `git fetch origin` then branch from `origin/master`, or from the base branch named in the ticket or its parent epic (target the PR there too); right after checkout run lockcheck for each touched repo — exit 3 → post marked comment listing mismatches asking Vadym to run `composer install`, return `needs_input`; run tests via `docker exec listing_syncer php -d memory_limit=5G ./vendor/bin/phpunit <path>` and `docker exec tools-app-1 ./vendor/bin/phpunit <path>`, PHPStan `-c ./config/phpstan.ci.neon --memory-limit=5G`, ECS `--config config/ecs.php`; new tests mutation-checked; push but do **not** create the PR (moves to after verification); leave the repo on the ticket branch; report branches.
- **planner.md:** plan path `agents/jira-to-pr/workspace/plans/<KEY>.md`; mandatory `## How to verify` section — numbered checks, each with type (`http` | `cli` | `sql-read` | `migration`), exact command, target container/URL, expected result; mark checks needing real third-party accounts as `unverifiable: <reason>`.
- **verifier.md (new subagent, tools: Read, Bash, Write; model opus):** inputs plan + branches; steps: reload affected processes (`docker exec ... bin/console cache:clear`, OpenSwoole reload signal, kill long-running worker for supervisor restart — discover the right command from the repo's config; if no reload works, the check is "Could not verify"); run unit/static checks for touched paths; run each "How to verify" check; `migration` checks: apply, verify, then `--down` and verify rollback; mirrored migrations run from one repo only; writes only to data it created, cleans up; write `verification.md` with per-check command, trimmed output (≤30 lines), PASS/FAIL/UNVERIFIABLE, unit test counts before/after; return `{allPassed, failures[], unverifiable[]}`. Forbidden: container start/stop/restart, `composer install`, writes to rows it didn't create.
- **bl-create-pr/SKILL.md:** PR body gets `## Verification` copied from `verification.md` (failures and "Could not verify" first); `--draft` whenever any check failed or is unverifiable, or HIGH risk / security/auth/payments.
- **settings.json:** allow `Bash(docker exec *)`, `Bash(docker compose exec *)`, `Bash(docker ps*)`, `Bash(curl *)`, `Bash(node *)`, `Bash(jq *)`, `Write`/`Edit` under the two repo paths and `workspace/**`; deny additionally `Bash(docker compose up*)`, `Bash(docker compose down*)`, `Bash(docker stop*)`, `Bash(docker rm*)`, `Bash(docker restart*)`, `Bash(make up*)`, `Bash(gh pr merge*)`, `Bash(composer install*)` inside exec too (`Bash(docker exec * composer install*)`).

- [ ] **Step 1:** Make the edits above.
- [ ] **Step 2:** Verify: `grep -c "workspace/{repo" agents/jira-to-pr/.claude/agents/*.md agents/jira-to-pr/CLAUDE.md` → all `0`; `grep -l "ai-processing\|ai-error\|JIRA_BOT_" -r agents/jira-to-pr` → no output; `jq . agents/jira-to-pr/.claude/settings.json` → valid JSON.
- [ ] **Step 3:** Commit `feat(jira-to-pr): add verification phase and local-checkout workflow`.

### Task 8: Container wiring

**Files:**
- Modify: `Dockerfile`, `docker-compose.yml`, `agents/jira-to-pr/config/bot.env.example`
- Create: `agents/jira-to-pr/docs/local-poller.md`

**Interfaces:**
- Consumes: `loadConfig` env names (Task 1), `index.js` entrypoint (Task 6).

Requirements:
- **Dockerfile:** add `jq` and Docker CLI (`docker-ce-cli` + `docker-compose-plugin` from Docker's apt repo); build args `HOST_UID=1000`, `HOST_GID=1000`; create user `agent` with that uid/gid and home `/home/lenovo` (so `~/.claude` mounts at the same path); do not `COPY . .` the workspace (it is mounted) — install server deps into `/opt/server-deps` and set `NODE_PATH`; `CMD ["node", "/home/lenovo/brightLocal/ai-workspace/agents/jira-to-pr/server/index.js"]`; entrypoint script runs `git config --global url."https://x-access-token:${GH_TOKEN}@github.com/".insteadOf git@github.com:` and `git config --global --add safe.directory '*'`, then execs CMD.
- **docker-compose.yml:** `user: "${HOST_UID:-1000}:${HOST_GID:-1000}"`, `group_add: ["${HOST_DOCKER_GID:-999}"]`; volumes (all `:rw`, same paths): ai-workspace, Tools, ListingSyncer, `/home/lenovo/.claude`, `/home/lenovo/.claude.json`, `/var/run/docker.sock`; drop the named `workspace-data` volume; `env_file: .env`; `environment: SERVER_MODE=true, WORKSPACE_ROOT=/home/lenovo/brightLocal/ai-workspace`; port `127.0.0.1:3000:3000` (localhost only).
- **bot.env.example:** `TARGET_ENV=local`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `GH_TOKEN`, `POLL_INTERVAL_SEC=300`, `RUN_TIMEOUT_MIN=90`, `MAX_TURNS=`, `JIRA_JQL=` (commented default), `HOST_UID=1000`, `HOST_GID=1000`, `HOST_DOCKER_GID=999`, `WEBHOOK_SECRET=`; remove `ANTHROPIC_API_KEY`, `JIRA_BOT_*`.
- **local-poller.md:** start/stop, pause (`touch personal/ai-poller.paused`), retry (`AI-failed` → `AI`), label meanings, where logs are, the Docker-socket trade-off sentence from the spec.

- [ ] **Step 1:** Make the edits. Note: a container named `ai-workspace-ai-workspace-1` (old image) is currently running — `docker compose down` it before the first `up` of the new one; ask Vadym before stopping it.
- [ ] **Step 2:** `docker compose build` — succeeds.
- [ ] **Step 3:** Smoke checks (with `touch personal/ai-poller.paused` first so the poller stays idle):
  - `docker compose run --rm ai-workspace id` → `uid=1000 gid=1000 groups=...,999`
  - `docker compose run --rm ai-workspace docker ps --format '{{.Names}}'` → lists host containers
  - `docker compose run --rm ai-workspace git -C /home/lenovo/brightLocal/Tools status --short` → same output as on host
  - `docker compose run --rm ai-workspace claude -p "say ok" --output-format json` → JSON with `"result"` (login reused)
  - `docker compose run --rm ai-workspace git -C /home/lenovo/brightLocal/Tools ls-remote origin HEAD` → succeeds over HTTPS
  - `docker compose up -d && curl -s localhost:3000/health` → `{"status":"ok",...,"paused":true}`
- [ ] **Step 4:** Commit `feat(jira-to-pr): run poller container against local checkouts`.

### Task 9: Pilot (manual, with Vadym)

- [ ] **Step 1:** Vadym starts LS and Tools stacks, puts both repos on `master`, clean; removes the pause file.
- [ ] **Step 2:** Vadym picks a small, well-specified single-repo LM ticket and adds label `AI`.
- [ ] **Step 3:** Within 5 min: label → `AI-in-progress`, marked "picked up" comment. `docker compose logs -f` shows `started`.
- [ ] **Step 4:** On completion: PR exists with a `## Verification` section; label is `AI-done` or `AI-draft` matching the evidence; `state.json` has the ticket with `sessionId`; repo is left on the ticket branch.
- [ ] **Step 5:** Clarification path: on a deliberately vague ticket, expect `AI-needs-input` + marked questions; Vadym replies; next tick resumes (`resumed` in logs) and the same session continues.
- [ ] **Step 6:** Record findings in `agents/jira-to-pr/docs/local-poller.md` under "Pilot notes"; commit `docs(jira-to-pr): add pilot notes`.
