---
name: deployer
description: Use when a branch must be put on (or released from) a BrightLocal dev environment (dev1..dev9) via Deployer (deployer.bll-i.co.uk) — listing envs, checking what runs where, deploying a branch, releasing a reservation. Covers the CLI, the credential, the approval rules and the API contract. Deployer is the ONLY sanctioned way to change what runs on a dev env.
---

# Skill: Deployer — put a branch on a dev environment

Source: `DEPLOYER_CLI.md` (QA team guide, "Letting Claude / Cursor drive Deployer").
Behaviour lives in the CLI, policy lives in this file.

## When to use this skill

- Deploying a feature branch to `dev1`..`dev9` (used by `agents/dev-env-deployer/`).
- Answering "what is on devX / who has it / did the last deploy pass?" (used read-only by
  `agents/dev-env-inspector/`).
- Releasing a reservation when the work that needed the env is done.

Deployer is the **only** way anything reaches a dev env. Never copy, edit or hotfix files on a
dev box over SSH — change the branch, push it, redeploy.

## Credential

`DEPLOYER_SID` — the `deployer-sid` cookie from <https://deployer.bll-i.co.uk>. It is the only
auth Deployer has, valid ~180 days, **not** revoked by logging out. Treat it as a password.

- Lives in `personal/credentials/deployer.env` (gitignored) as `DEPLOYER_SID=<value>`; an
  exported `DEPLOYER_SID` env var wins.
- How the user gets it: open Deployer logged in → DevTools console → `document.cookie`, or
  DevTools → Application → Cookies → `deployer-sid`.
- If it is missing or the CLI prints `Deployer rejected the session`, ask the user ONCE how to
  proceed (`I'll add it to personal/credentials/deployer.env` / `Paste it here` / `Skip`) and stop
  until answered. If pasted, write it to that file yourself.
- Never print, echo, log, commit, or put it in a Jira/Slack/PR text.

Deployer, the dev envs and Jenkins are VPN-only. `ECONNREFUSED` / timeouts ⇒ VPN is down.

## The CLI

`skills/engineering/deployer/scripts/deployer.mjs` — Node ≥ 22, zero dependencies. Run from the
workspace root:

```bash
skills/engineering/deployer/scripts/deployer.mjs whoami
skills/engineering/deployer/scripts/deployer.mjs envs [--free] [--json] [--repo Tools]
skills/engineering/deployer/scripts/deployer.mjs status <env> [--json] [--repo Tools]
skills/engineering/deployer/scripts/deployer.mjs deploy <env> <branch> [--no-busy] [--repo Tools]
skills/engineering/deployer/scripts/deployer.mjs unhold <env> [--repo Tools]
```

| Command | Effect | Mutates Deployer? |
|---|---|---|
| `whoami` | Confirms the cookie, prints your Deployer name | no |
| `envs` | Every env: state, reserved by, autodeploy, last branch. `--free` ⇒ only `dev1..dev9` that are `free`, unreserved, not protected | no |
| `status <env>` | One env + its last deploy (commit, OK/FAILED, who) | no |
| `deploy <env> <branch>` | Reserve (unless `--no-busy`), record last branch, trigger the deploy over WebSocket, stream steps, verify the deploy log | **yes** |
| `unhold <env>` | Release **your** reservation (does not undeploy) | **yes** |

Built-in guards (the CLI refuses with exit 2):

- `deploy` / `unhold` only accept `dev1`..`dev9`; `Live`, `staging`, `stg01`, `stg02` are always refused.
- `deploy` refuses an env that is `deploying`, or reserved by someone other than you.
- `deploy` refuses a branch that does not exist on the repo (it must be pushed; exact name).
- `unhold` refuses to release someone else's reservation.

Exit codes: **0** deployed / ok · **1** deploy failed (build/deploy step, or log mismatch) ·
**2** usage, precondition, auth or network error.

### Repos

`--repo` defaults to `Tools`. Deployer is keyed by repo name; other services deployed to dev
boxes have their own Deployer repo. ListingSyncer's is `ListingSyncer` (verified 2026-10-16; the
`listing_syncer` container on `devX` runs image `listing_syncer_new:devX`). A ticket with PRs in
both: deploy ListingSyncer first, then Tools.

## Policy (rules for any agent using this skill)

| Rule | Why |
|---|---|
| Run `envs --free` **before** proposing an env; never ask the user to type an env name from memory. | Candidates come from reality. |
| If the user named an env, run `status <env>` first and show who has it and what it runs. | The previous branch belongs to another engineer even when unreserved. |
| ONE approval question naming env + branch + what it replaces (+ who deployed it). No deploy without an explicit yes. | Deploying is outward-facing and overwrites a colleague's state. |
| Approval covers that env + branch only. A different env, branch or a redeploy needs a new yes. | Approval in one context doesn't extend to the next. |
| Deploy in the foreground (Bash timeout ≥ 600000 ms) and wait for the exit code. | Anything checked before `->free` checks the old code. |
| Exit 1 is not the user's failure: report the failing step + `https://deployer.bll-i.co.uk`, offer retry or another listed env. Do not "fix" the branch unasked. | A build error belongs to the PR author. |
| Release the reservation when the work that needed the env is done — including on abort. No question needed. | Held envs block the pool. |
| Never pass `Live`/`staging`/`stg*` or anything outside `dev1..dev9`, even if asked — tell the user to use the Deployer UI. | Blast radius. |
| Non-interactive runs (`CI=true`, scheduled): no questions — env from args; busy/missing ⇒ stop with a clear error. | Pipelines cannot answer prompts. |

## API contract (for maintaining the CLI)

All calls carry `Cookie: deployer-sid=<SID>`, base `https://deployer.bll-i.co.uk`.

| Need | Call |
|---|---|
| Who am I | `GET /api/check_auth` → `{ id, name }` |
| All envs of a repo | `GET /api/repo/<repo>` → `{ Environments: [ { env_id, env_name, state, is_busy, is_busy_updated_by, is_autodeploy, last_branch, last_deployer, url } ] }` |
| One env + branches with HEAD shas | `GET /api/repo/<repo>/deploy/<env>` → `{ env_id, state, is_busy, last_branch, branches: [ { name, commit: { sha } } ] }` |
| Reserve / release | `PUT /api/env/set_busy/<env_id>` · `PUT /api/env/set_unbusy/<env_id>` — body `{"username": "<full name>"}` |
| Record branch on env | `PUT /api/env/save_last_branch` — body `{"env_id": <id>, "last_branch": "<branch>"}` |
| **Start a deploy** | WebSocket `GET /api/ws` (cookie on the upgrade request), send ONE text frame `{"repo_name","env_name","commit_hash"}` |
| Last deploy result | `GET /api/deploys/<repo>_<env>/0/1` → `[ { commit_hash, status, deploy_user, estimated_time, comment } ]` — `status` 1 ok, 0 failed |

- There is no REST endpoint that starts a deploy — only the WebSocket frame (or GitHub autodeploy).
- `/api/ws` broadcasts **every** client's progress as `{ channel: "<repo>_<env>", message: { message, step, status_code } }`.
  Filter on `channel`. `service-><repo>/<env>->deploying` marks start, `…->free` marks end;
  non-zero `status_code` or an `err` field = failed step.
- Steps: `start · build_pre · build · build_post · collecting_files · deploy_pre · deploy · deploy_post · end`.
  A Tools deploy takes 2–4 min; the CLI gives up after 20.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `DEPLOYER_SID is not set` | Add it to `personal/credentials/deployer.env`. |
| `Deployer rejected the session` | Cookie expired or copied with extra characters — fetch a fresh one. |
| `cannot reach Deployer` / WebSocket failed | VPN down. |
| `branch "…" does not exist` | Push the branch; use the exact name (PR `headRefName`). |
| `… is reserved by X` | Expected. Ask X, or pick another `envs --free` row. |
| `… is already deploying` | Someone else's deploy is running; wait or pick another env. |
| `deploy FAILED` (exit 1) | Usually a build error on the branch — full log on deployer.bll-i.co.uk. |
| Web requests 500 with `Failed to create "/var/cache/tools/temp/tools": mkdir(): Permission denied` for 20–60 s after a Tools deploy | The box rebuilds its container cache. Wait a minute before testing; a problem only if it persists. |
| Every ListingSyncer call 500s after its container idled a day or more; container output `2006 MySQL server has gone away` | Stale MySQL pool. Redeploy ListingSyncer — the only sanctioned restart. |
