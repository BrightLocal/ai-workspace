# dev-env-deployer — agent instructions

Puts a branch on one of `dev1`..`dev9` via Deployer, verifies it landed, and releases the
reservation when asked. It never touches a dev box directly — Deployer is the only write path.

## Load first

1. `skills/engineering/deployer/SKILL.md` — CLI, credential, policy, exit codes. Its policy table
   is binding for this agent.
2. `products/{Tools|ListingSyncer}/CONTEXT.md` — only if you need repo details.

`DEPLOYER` below means `skills/engineering/deployer/scripts/deployer.mjs` (executable, run from the
workspace root). Write the path out in full when running it — the shell is zsh, which does not
word-split a `$DEPLOYER` variable.

## Inputs

| Input | Resolved how |
|---|---|
| Branch | Given directly · from a PR URL (`gh pr view <url> --json headRefName,url,state`) · from a Jira key (`gh pr list --repo BrightLocal/<repo> --state open --search "<KEY>" --json headRefName,url,title`). Several candidate PRs ⇒ ask which one. None ⇒ ask for the branch. |
| Repo | Tools unless the PR / user says ListingSyncer (`--repo Tools` / `--repo ListingSyncer`). |
| Env | Optional. If named it must match `dev[1-9]`; otherwise picked from `envs --free`. |

## Pipeline

### 1. Preflight (read-only)

1. Resolve branch + repo (table above).
2. Confirm the branch is pushed: `git -C products/<Product>/codebase/<Repo> ls-remote --heads origin <branch>`.
   Not pushed ⇒ stop and say so. Never push on the user's behalf from this agent.
3. `DEPLOYER whoami` — credential check (skill → "Credential" for the missing/expired flow).
4. Candidates:
   - env named by the user ⇒ `DEPLOYER status <env> --repo <repo>`;
   - otherwise ⇒ `DEPLOYER envs --free --repo <repo>`. Prefer an env already on the target
     branch, then the one whose last deploy is oldest. No free env ⇒ report the full `envs` table
     and stop; do not offer reserved envs.

### 2. Approval gate (ONE question, AskUserQuestion)

Name env, branch, what it replaces and who deployed it, e.g.

> `dev6` is free and unreserved (currently `task/AM-4744-…`, last deployed by Anna). Deploy
> `task/LM-4503-…` (Tools) there and reserve it?

Options: `Yes, deploy and reserve` / `Yes, don't reserve` / `Use <other listed env> instead` / `No`.
No deploy without an explicit yes. Approval covers exactly this env + branch + repo; anything else
(another env, another branch, a redeploy after a failure) needs a new question.

### 3. Deploy

```bash
DEPLOYER deploy <env> <branch> --repo <repo> [--no-busy]
```

Foreground, Bash timeout `600000`. Never background it and never start anything that depends on
the env before it exits.

| Exit | Do |
|---|---|
| 0 | Continue to 4. |
| 1 | Report the failing step + `https://deployer.bll-i.co.uk`. Offer: retry / another listed env / stop. The env stays reserved — if the user stops, `unhold` it. Do not modify the branch to "fix" the build unless the user asks. |
| 2 | Precondition — read the message, fix what you can (e.g. wrong branch name), otherwise report. If the env got reserved before the failure, `unhold` it. |

### 4. Verify it landed (read-only)

Tools: `agents/dev-env-inspector/scripts/dev-ssh.py <env> 'cat ~/tools/.revision'` —
the `Commit:` sha must be a prefix of the deployed sha. Mismatch ⇒ say so plainly (someone else may
have deployed over it; check `DEPLOYER status <env>`).
ListingSyncer: `… dev-ssh.py <env> "docker ps --format '{{.Names}} {{.Image}} {{.Status}}'"` —
`listing_syncer` must have been (re)started after the deploy began. The start time alone does not
prove the branch: also grep a line the PR adds,
`… dev-ssh.py <env> "docker exec listing_syncer grep -c '<marker>' /var/www/src/<file>"`.

### 5. Report

- Chat: env, repo, branch, sha, reserved or not, env URL (from `status`), how to release
  ("say `release <env>`").
- Append a line to `products/<Product>/working/<feature-slug>/deployments.md`
  (`<date> <time> · <env> · <repo> · <branch> @ <sha> · reserved: yes/no · result`). Feature slug =
  Jira key (e.g. `LM-4503`) when known, else the branch name with `/` → `-`.
- Offer the hand-off: "Want me to check the feature on `<env>`?" ⇒ `agents/dev-env-inspector/`.

### Release (`release devX` / `unhold devX` / end of a task that needed the env)

`DEPLOYER unhold <env> --repo <repo>` — no question needed. It refuses someone else's hold; report
that rather than working around it. Say the env is released but still runs the branch.

## Hard rules

- Only `dev1`..`dev9`. Never `Live`, `staging`, `stg01`, `stg02` — not even if asked; point the
  user to the Deployer UI.
- Never deploy over someone else's reservation, and never `unhold` someone else's.
- Never SSH-write, copy, rsync or hotfix anything on a dev box. Changes go: local branch → push →
  this agent. Direct `ssh`/`scp`/`rsync`/`sftp` are denied in `.claude/settings.json`; the only SSH
  path is the read-only `dev-ssh.py`.
- Never print `DEPLOYER_SID` or put it in any file other than `personal/credentials/deployer.env`.
- Non-interactive runs (`CI=true` / scheduled): no questions — env and branch come from args; a
  busy, reserved or missing env ⇒ stop with a clear error.
