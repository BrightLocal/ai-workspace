# ticket-ac-verifier — agent instructions

Checks a Jira ticket's implementation against its acceptance criteria on a dev env (`dev1`..`dev9`):
puts the ticket's ListingSyncer and Tools branches there through Deployer, has the flow exercised
while it watches the logs read-only, and reports each AC as PASS / FAIL / NOT OBSERVED with evidence.
Every deploy follows `agents/dev-env-deployer/`; every look at the box follows the read-only rule of
`agents/dev-env-inspector/`.

## Load first

1. `skills/engineering/ac-verification/SKILL.md` — the method: ACs → checks, deploy rules, signals,
   pitfalls, report format.
2. `skills/engineering/deployer/SKILL.md` — CLI, credential, policy (binding).
3. `agents/dev-env-deployer/CLAUDE.md` — approval gate, deploy, verify, `deployments.md`.
4. `agents/dev-env-inspector/CLAUDE.md` — the one rule, what lives where on a box.
5. `products/{Tools|ListingSyncer}/CONTEXT.md` — repos, quality commands.
6. `products/<Product>/working/<KEY>/` — earlier deployments, checks, investigation notes.

Write these paths out in full when running them (zsh does not word-split variables):

```bash
skills/engineering/deployer/scripts/deployer.mjs status dev2 --repo ListingSyncer
agents/dev-env-inspector/scripts/dev-ssh.py dev2 'cat /home/sites/tools/.revision'
skills/engineering/ac-verification/scripts/watch-dev-logs.py dev2 --match '<uuid>|<id>'
```

`<Product>` is Tools when the ticket has a Tools PR, else ListingSyncer.

## Inputs

| Input | Resolved how |
|---|---|
| Jira key | Required. A PR URL ⇒ take the key from its title or branch. |
| Env | Optional. Named ⇒ must match `dev[1-9]`, `status` it in both repos. Otherwise `envs --free` in both repos, preferring an env free in both. |
| Branches | Open PRs in both repos: `gh pr list --repo BrightLocal/<repo> --state open --search "<KEY>" --json number,headRefName,baseRefName,title,url,labels`. |

## Pipeline

### 1. Scope (read-only)

1. Read the ticket (`getJiraIssue`): status, ACs, description, parent epic, linked tickets. Number
   the ACs as written; never reword one into something easier to pass. A ticket already past QA
   makes this a regression run: say so in the report.
2. Read each PR: base branch (stacked?), labels (`run migrations before deploy`), deploy-order notes.
   A ticket with a PR in one repo only ⇒ ask which branch to pair in the other (skill §2).
3. Find the hooks the checks can use: `git -C products/<Product>/codebase/<Repo> diff
   origin/<base>...origin/<branch> --stat`, then new routes, log messages, crons, feature flags and
   migrations in it.
4. Build the checklist (skill §1): per AC its trigger, where to look, what proves and disproves it;
   add regression checks; mark what needs the user (a UI step, a DB query, a flag, test data).
5. Write it to `products/<Product>/working/<KEY>/ac-check-<env>-<YYYY-MM-DD>.md` with empty
   verdicts, show it in chat, and confirm it in one question (`Looks right` / `Change the checks` /
   `Stop`).

### 2. Prepare the env

1. `deployer.mjs whoami` (skill → Credential if it fails).
2. `status <env> --repo ListingSyncer` and `--repo Tools`: branch, sha, who deployed, reservation.
   Reserved by someone else ⇒ stop and say who holds it; the user gets it released (the holder, or
   the Deployer UI), then re-run `status`.
3. Per repo, decide: deploy, or already at the branch head (`git -C … rev-parse origin/<branch>`
   against the Deployer sha / Tools `.revision`). An LS container at head but up a day or more ⇒
   propose the redeploy anyway (stale pool, skill §4).
4. ONE approval question naming the env, each repo's branch @ sha, what it replaces and who deployed
   that, and whether to reserve. Options: `Yes, deploy and reserve` / `Yes, don't reserve` /
   `Use <other listed env>` / `No`. Approval covers exactly that.
5. Deploy ListingSyncer first, then Tools: foreground, exit codes as in the deployer agent.
6. Verify each (skill §2): Tools `.revision`; LS container start time plus a marker grep.
7. Wait about 60 s after the Tools deploy, then `watch-dev-logs.py <env> --since <deploy end>
   --dump`. Go on once the `mkdir(): Permission denied` errors have stopped and LS shows no errors.
8. Feature flags and test data the flow needs: list them, and have the user confirm or set them.
9. Append each deploy to `products/<Product>/working/<KEY>/deployments.md` (deployer agent §5).

### 3. Exercise and observe

Per check, or per group sharing one trigger:

1. Start the watch in the background (skill §3) and note its start time.
2. Tell the user the one step to do (page, location, button) and to say when it is done.
3. Read the digest when the watch finishes or the user says done. Still waiting ⇒ stop it, then
   `--dump --since <start>`.
4. Crons and workers cannot be run from here. Find the schedule (`grep -n -A3 '<cron>'
   /home/sites/tools/crunz.yml`) and wait with `--until`, or ask the user to trigger it.
5. DB state: give the user the exact `SELECT` to run, built from the branch's migrations (skill §5),
   and use their result as evidence.
6. Before any ListingSyncer redeploy, dump the window into the report: the redeploy resets both LS
   logs.

### 4. Judge and report

1. Verdict per check with its evidence: the time and the part of the line that decides it.
2. Classify each failure (skill §4) before calling it a ticket bug. A dev-env issue is fixed through
   Deployer, with a new approval, and the step re-run.
3. A ticket bug: suspected cause, then a failing test that reproduces it locally. Fix only on the
   user's go-ahead: on the ticket branch, run the repo's quality checks (`CONTEXT.md`), commit, push,
   redeploy (new approval), re-run the affected checks.
4. Fill the report file. In chat: verdict per AC, dev-env issues seen, bugs found, what is still
   open, the file path.
5. Offer a QA or Jira note (skill §5). Post it only after the user approves the text.

### 5. Wrap up

- Session ran long ⇒ re-check `status` and `.revision` before the final report.
- Offer: release both reservations (`unhold`), keep them for QA, or hand the env back to the
  colleague it was taken from.

## Hard rules

- The deployer and inspector hard rules apply in full: `dev1`..`dev9` only, Deployer is the only
  write path, SSH only through `dev-ssh.py`, never print `DEPLOYER_SID`.
- One approval per deploy (env + repo + branch). A fix commit or a redeploy needs a new yes.
- Never deploy over or release someone else's reservation.
- PASS needs evidence from this env, in this window. NOT OBSERVED and DEFERRED never turn into PASS.
- Nothing goes to Jira, GitHub or Slack without the user's approval of the exact text.
- Logs carry customer data: quote only what a verdict needs.
- Non-interactive runs (`CI=true`, scheduled) are not supported: the UI steps and approvals need a
  person. Stop with a clear message.
