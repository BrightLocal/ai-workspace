# setup-product Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `~/.claude/skills/setup-product/SKILL.md` that runs an interactive wizard for adding or linking products in the `products/` directory.

**Architecture:** Single SKILL.md file — no helper scripts. All shell operations run via the Bash tool during wizard execution. The skill is conversational and sequential.

**Tech Stack:** Markdown (SKILL.md), Bash (ln, git clone, mkdir, ls)

---

### Task 1: Create the skill file

**Files:**
- Create: `~/.claude/skills/setup-product/SKILL.md`

- [ ] **Step 1: Create the skills directory**

```bash
mkdir -p ~/.claude/skills/setup-product
```

Expected: no output, directory created.

- [ ] **Step 2: Write SKILL.md**

Create `~/.claude/skills/setup-product/SKILL.md` with this exact content:

```markdown
---
name: setup-product
description: Use when setting up a new product in the ai-workspace products/ directory or linking a codebase to an existing product. Triggered by /setup-product.
---

# Setup Product Wizard

## Overview

Interactive wizard for adding a new product to `products/` or linking a codebase to an
existing one. Run one step at a time — ask one question, wait for the answer, then proceed.

The workspace root is determined by looking for a `products/` directory from the current
working directory or its parents.

## Step 1 — Product name

Ask: *"What's the product name?"*

Scan the `products/` directory:

```bash
ls products/
```

Compare the typed name against existing entries — case-insensitive, substring match.

**If similar names found**, present a numbered list:

```
Similar products found:
  1) Tools
  2) ListingSyncer
  N) Continue with "mytools" as a new product

Pick a number:
```

- User picks an existing product → skip to Step 3 (CODEBASE).
- User picks N (new) → proceed to Step 2 (CREATE).

**If no matches**, proceed directly to Step 2.

## Step 2 — CREATE (new products only)

Confirm the product name with the user, then run:

```bash
mkdir -p products/{name}
mkdir -p products/{name}/codebase
```

Copy the CONTEXT.md template:

```bash
cp products/Tools/CONTEXT.md products/{name}/CONTEXT.md
```

Then proceed to Step 3.

## Step 3 — CODEBASE

Ask: *"Do you have a codebase to link? Provide a local path, a Git SSH URL (git@...), or type 'skip'."*

Handle each input type:

**Local path** (starts with `/` or `~`):
1. Verify the path exists:
   ```bash
   ls "<path>"
   ```
   If missing → warn ("Path not found") and re-ask.
2. Check for existing content in `codebase/`:
   ```bash
   ls products/{name}/codebase/
   ```
   If not empty → warn the user and ask for confirmation before continuing.
3. Create the symlink:
   ```bash
   ln -s "<path>" "products/{name}/codebase/<basename of path>"
   ```

**SSH URL** (`git@...` or `ssh://...`):
1. Extract the repo name: strip `.git` suffix from the last path segment of the URL.
2. Check for existing content in `codebase/` (same as above).
3. Clone:
   ```bash
   git clone "<url>" "products/{name}/codebase/<reponame>"
   ```

**HTTPS URL** (`https://`):
Reject with: *"Please use an SSH URL (git@github.com:org/repo.git) instead of HTTPS — HTTPS requires credential prompts in CI contexts."*
Re-ask.

**`skip` or empty input**: Leave `codebase/` as an empty directory.

## Step 4 — CONTEXT (new products only)

Ask: *"Give me a brief description of the product — what it does, who uses it, and the tech stack. I'll use this to fill CONTEXT.md. (type 'skip' to leave it as a template)"*

If the user provides a description:

1. Extract and write these four fields from the description:
   - **What this product is** — one paragraph
   - **Who uses it / Primary persona** — name + 2–3 sentences
   - **Key product surfaces** — bullet list of main feature areas
   - **Architectural overview** — tech stack and key services

2. For each of the four fields still blank after extraction, ask one targeted follow-up
   question. Each is individually skippable (user types "skip" or presses enter):
   - *"Who is the primary user of this product? (skip to leave blank)"*
   - *"What are the main feature areas or surfaces? (skip to leave blank)"*
   - *"What's the tech stack or key services? (skip to leave blank)"*

3. Write the filled content into `products/{name}/CONTEXT.md`, replacing the
   corresponding template placeholder sections. Leave all other sections unchanged
   (metrics, recent decisions, glossary, business model, etc. stay as template placeholders).

If the user types "skip": leave CONTEXT.md as the unmodified template.

## Step 5 — Done

Print a summary of everything that was set up:

```
Done! Here's what was created:

  products/{name}/
  products/{name}/CONTEXT.md
  products/{name}/codebase/
  products/{name}/codebase/{link-or-clone-name}  →  {source}
```

Omit codebase lines if the user skipped that step.

## Rules

- One question at a time. Wait for the answer before moving to the next step.
- Always confirm the product name before creating directories.
- Never skip the similarity check — even if a name was passed alongside /setup-product.
- Show the exact shell commands you are about to run before running them, so the user
  can catch mistakes.
```

- [ ] **Step 3: Verify the file exists and is readable**

```bash
cat ~/.claude/skills/setup-product/SKILL.md | head -5
```

Expected output starts with:
```
---
name: setup-product
```

- [ ] **Step 4: Commit**

```bash
cd /home/lenovo/brightLocal/ai-workspace
git add docs/superpowers/specs/2026-06-09-setup-product-skill-design.md
git add docs/superpowers/plans/2026-06-09-setup-product-skill.md
git commit -m "docs: add design and plan for setup-product skill"
```

---

### Task 2: Smoke-test the skill

This task verifies the skill loads and Claude follows it correctly. No automated test
runner — this is a manual invocation check.

**Files:**
- Read: `~/.claude/skills/setup-product/SKILL.md`

- [ ] **Step 1: Invoke the skill in a new session**

Open a new Claude Code session in the workspace directory and run:

```
/setup-product
```

Expected: Claude asks *"What's the product name?"* — not a generic response.

- [ ] **Step 2: Test similarity detection**

Type `tools` (lowercase). Expected: Claude lists existing products with `Tools` as a
similar match, plus a "Continue as new" option.

- [ ] **Step 3: Test new product path**

Choose the "new product" option. Expected: Claude runs `mkdir` and `cp` commands to
create `products/tools/`, `products/tools/codebase/`, and `products/tools/CONTEXT.md`.

- [ ] **Step 4: Test codebase — HTTPS rejection**

When asked for codebase, type `https://github.com/org/repo`. Expected: Claude rejects
it and asks for an SSH URL.

- [ ] **Step 5: Test codebase — skip**

Type `skip`. Expected: Claude moves to Step 4 (CONTEXT).

- [ ] **Step 6: Clean up test artifact**

```bash
rm -rf /home/lenovo/brightLocal/ai-workspace/products/tools
```

- [ ] **Step 7: Commit the skill file**

The skill lives in `~/.claude/` which is outside the workspace repo — no commit needed
for the skill itself. If the smoke-test revealed issues, fix `SKILL.md` and re-run
Steps 1–6 before continuing.
