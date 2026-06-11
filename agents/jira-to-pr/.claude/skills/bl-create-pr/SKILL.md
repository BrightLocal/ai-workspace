---
name: bl-create-pr
description: Create a pull request with proper Tools template, analyzing all branch changes to auto-fill the PR body. Use when the user wants to create or open a PR.
disable-model-invocation: true
argument-hint: [base-branch (default: master)]
allowed-tools: Bash(git *), Bash(gh *), Grep, Glob, Read
---

# Create Pull Request

Create a properly formatted pull request for the current branch.

The base branch is `$ARGUMENTS` (default to `master` if not provided).

> **Autonomous agent mode:** This skill is used by a non-interactive agent. Skip Step 4 (user confirmation) and proceed directly to Step 5 after drafting the PR.

## Workflow

### Step 1: Verify Branch State

Run these checks in parallel:

```bash
git status
git branch --show-current
git log --oneline master..HEAD
git diff master...HEAD --stat
```

**Pre-flight checks:**
- Current branch must NOT be `master` — abort if it is
- Working tree should be clean (no uncommitted changes) — warn the user if dirty and ask whether to proceed
- There must be at least one commit ahead of base branch — abort if nothing to merge
- Branch name MUST comply with ADR-0019 (see below) — abort with a clear error if it does not

**Branch naming validation (ADR-0019):**

Read the full rules and table from `shared/engineering/git-conventions.md`.

If validation fails, show what's wrong and suggest a corrected branch name. Do NOT proceed with PR creation.

### Step 2: Analyze All Changes

Run in parallel to gather full context:

```bash
# Full diff of all changes on the branch
git diff master...HEAD

# List of all changed files
git diff master...HEAD --name-only

# All commit messages on the branch
git log master..HEAD --format="%h %s%n%b" --reverse
```

Read through the diff carefully. Understand:
- What was added, modified, or removed
- The purpose/intent behind the changes (derive from commit messages + code)
- Any side effects or notable technical decisions

### Step 3: Draft the PR

Compose the PR title and body using the **BrightLocal PR template**.

**Title rules:**
- Under 70 characters
- Starts with a verb (Add, Fix, Update, Refactor, Remove, Migrate, etc.)
- Concise — details go in the body

**Body template:** Use the template from `pr-template.md` (located in this skill's directory).

**Filling rules:**
- **Responsibility**: Derive from the overall intent of the commits. One sentence, no "and".
- **Side effects**: List concrete technical changes from the diff. Each bullet = one change.
- **Additional comments**: Include ticket references (extract from branch name, e.g. `task/CE-1234-...` → `CE-1234`). Add any notable decisions visible in the code.
- **AI Summary**: Provide a concise, accurate summary of what the diff contains.

### Step 4: Present Draft for Review

> **Autonomous agent mode:** Skip this step — log the draft title and body to output for traceability, then proceed immediately to Step 5 without waiting for confirmation.

Show the proposed:
1. **PR title**
2. **PR body** (formatted)
3. **Base branch** and **head branch**
4. Whether the branch needs to be pushed

### Step 5: Push and Create PR

After confirmation (or immediately in autonomous mode):

```bash
# Push branch to remote (with upstream tracking)
git push -u origin HEAD

# Create the PR
gh pr create --base <base-branch> --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

### Step 6: Report Result

Return the PR URL to the user.

## Important Notes

- NEVER force-push or amend commits during this flow
- If the branch name contains a ticket ID (e.g. `CE-3605`), include it in Additional comments
- Use `--draft` flag only if the plan explicitly marks HIGH risks or security/auth/payments changes
- If `gh` CLI is not installed, inform and suggest: `brew install gh && gh auth login`
