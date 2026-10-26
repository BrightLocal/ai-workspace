---
name: bl-create-pr
description: Create a pull request with proper Tools template, analyzing all branch changes to auto-fill the PR body, including the Verification section from the run's verification.md. Use when the user wants to create or open a PR.
disable-model-invocation: true
argument-hint: [repo-path] [base-branch (default: master)] [verification.md path]
allowed-tools: Bash(git *), Bash(gh *), Grep, Glob, Read
---

# Create Pull Request

Create a properly formatted pull request for a ticket branch.

Inputs (from `$ARGUMENTS` or the orchestrator):
- **REPO** — repo path (e.g. `../../products/Tools/codebase/Tools` from the agent's cwd). Run all
  git commands as `git -C <REPO> ...`.
- **BASE** — base branch, default `master`; the ticket/epic base branch when one was used.
- **VERIFICATION** — path to `workspace/runs/<RUN_ID>/verification.md` (pipeline runs always pass it).

> **Autonomous agent mode:** This skill is used by a non-interactive agent. Skip Step 4 (user confirmation) and proceed directly to Step 5 after drafting the PR.

## Workflow

### Step 1: Verify Branch State

Run these checks in parallel:

```bash
git -C <REPO> status
git -C <REPO> branch --show-current
git -C <REPO> log --oneline origin/<BASE>..HEAD
git -C <REPO> diff origin/<BASE>...HEAD --stat
```

**Pre-flight checks:**
- Current branch must NOT be `<BASE>` or `master` — abort if it is
- Working tree should be clean (no uncommitted changes) — in autonomous mode abort and report
- There must be at least one commit ahead of base branch — abort if nothing to merge
- Branch name MUST comply with ADR-0019 (see below) — abort with a clear error if it does not
- If a PR for this branch already exists (`gh pr list --repo <owner/repo> --head <branch>`), do
  not create a second one — update its body (`gh pr edit`) with the new Verification section and
  report its URL. Then reconcile its draft state with this run's Draft decision (Step 3; read the
  current state with `gh pr view <url> --json isDraft`):
  - Decision is **Draft** and the PR is ready → `gh pr ready --undo <url>` (back to draft).
  - Decision is **ready** and the PR is a draft → leave it draft unless every verification check
    passed and nothing is unverifiable; only then run `gh pr ready <url>`.
  - Otherwise leave it as it is. Report the PR's final draft state.

**Branch naming validation (ADR-0019):**

Read the full rules and table from `../../shared/engineering/git-conventions.md` (path from the
agent's cwd `agents/jira-to-pr`).

If validation fails, show what's wrong and suggest a corrected branch name. Do NOT proceed with PR creation.

### Step 2: Analyze All Changes

Run in parallel to gather full context:

```bash
# Full diff of all changes on the branch
git -C <REPO> diff origin/<BASE>...HEAD

# List of all changed files
git -C <REPO> diff origin/<BASE>...HEAD --name-only

# All commit messages on the branch
git -C <REPO> log origin/<BASE>..HEAD --format="%h %s%n%b" --reverse
```

Read through the diff carefully. Understand:
- What was added, modified, or removed
- The purpose/intent behind the changes (derive from commit messages + code)
- Any side effects or notable technical decisions

Read VERIFICATION.

### Step 3: Draft the PR

Compose the PR title and body using the **BrightLocal PR template**.

**Title rules:**
- Under 70 characters
- Starts with a verb (Add, Fix, Update, Refactor, Remove, Migrate, etc.)
- Concise — details go in the body

**Body template:** Use the template from `pr-template.md` (located in this skill's directory),
then append a `## Verification` section.

**Filling rules:**
- **Responsibility**: Derive from the overall intent of the commits. One sentence, no "and".
- **Side effects**: List concrete technical changes from the diff. Each bullet = one change.
- **Additional comments**: Include ticket references (extract from branch name, e.g. `task/CE-1234-...` → `CE-1234`). Add any notable decisions visible in the code, dependencies on other PRs ("Depends on ListingSyncer#NNN") and deploy order.
- **AI Summary**: Provide a concise, accurate summary of what the diff contains.
- **Verification**: Copied from VERIFICATION for this repo — order: **failed checks first**, then
  **"Could not verify"** (each with its reason), then passed checks; each check with its command,
  trimmed output (at most 30 lines) and result; plus unit-test counts before → after and the
  PHPStan / ECS results. Do not soften or drop failures. Redact any secret.
  If VERIFICATION is missing (manual use outside the pipeline), write
  "Not verified — no verification.md for this run" and treat the PR as Draft.

**Draft decision — use `--draft` if ANY of these is true:**
- any verification check failed;
- any check is unverifiable ("Could not verify"), or VERIFICATION is missing;
- the plan marks a HIGH risk;
- the change touches security / auth / payments.

Otherwise create a ready (non-draft) PR. State the reason for Draft in Additional comments.

### Step 4: Present Draft for Review

> **Autonomous agent mode:** Skip this step — log the draft title and body to output for traceability, then proceed immediately to Step 5 without waiting for confirmation.

Show the proposed:
1. **PR title**
2. **PR body** (formatted)
3. **Base branch** and **head branch**
4. Whether the branch needs to be pushed

### Step 5: Push and Create PR

After confirmation (or immediately in autonomous mode). `<owner/repo>` is `BrightLocal/Tools`
or `BrightLocal/ListingSyncer`:

```bash
# Push branch to remote (with upstream tracking) — a no-op if already pushed
git -C <REPO> push -u origin HEAD

# Create the PR (add --draft per the Draft decision)
gh pr create --repo <owner/repo> --base <BASE> --head <branch> --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

### Step 6: Report Result

Return the PR URL and whether it is a draft (and why).

## Important Notes

- NEVER force-push or amend commits during this flow
- NEVER merge the PR (`gh pr merge` is forbidden)
- If the branch name contains a ticket ID (e.g. `CE-3605`), include it in Additional comments
- If `gh` CLI is not installed, inform and suggest: `brew install gh && gh auth login`
