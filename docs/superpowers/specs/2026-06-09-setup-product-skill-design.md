# Design: `/setup-product` Skill

**Date:** 2026-06-09  
**Status:** Approved

## Overview

A Claude Code slash-command skill that guides the user through adding a new product (or
linking codebase to an existing one) in the `products/` directory of this workspace.

## Location

`~/.claude/skills/setup-product/SKILL.md`

Invoked via `/setup-product`. No CLAUDE.md routing entry needed — it's a personal skill.

## Wizard Flow

### Step 1 — Product name

- Ask user for a product name.
- Scan `products/` directory for similar names (case-insensitive, substring match).
- **If matches found:** show numbered list + one extra option to continue with the typed name as a new product.
  - User picks an existing product → skip to CODEBASE step (no CREATE, no CONTEXT).
  - User picks "new" → proceed to CREATE step.
- **No matches:** proceed directly to CREATE step.

### Step 2 — CREATE (new products only)

- Create `products/{name}/` directory.
- Create `products/{name}/CONTEXT.md` from the standard template (see `products/Tools/CONTEXT.md`).
- Create `products/{name}/codebase/` directory.

### Step 3 — CODEBASE

Ask the user for one of:

| Input | Action |
|-------|--------|
| Local filesystem path | Validate path exists. Create symlink inside `codebase/`: `ln -s <path> products/{name}/codebase/<basename of path>` |
| Git SSH URL (`git@...` or `ssh://...`) | Validate SSH format. `git clone <url> products/{name}/codebase/<reponame>` |
| Skip | Leave `codebase/` empty |

**Edge cases:**
- Local path doesn't exist → warn, re-ask.
- Non-SSH URL (https://, http://) → reject, explain why SSH is required, re-ask.
- `codebase/` already has content → warn before proceeding.

### Step 4 — CONTEXT (new products only)

1. Ask for a free-form description of the product.
2. Fill `CONTEXT.md` fields from the description (best-effort extraction):
   - What this product is
   - Who uses it (primary persona)
   - Key product surfaces
   - Architectural overview
3. For any of the four priority fields still blank → ask one targeted question each,
   explicitly skippable ("type 'skip' or press enter to leave blank").
4. The following sections are intentionally left as template placeholders (meant to
   be filled over time, not upfront): metrics, recent decisions, glossary, business model.
5. Save filled `CONTEXT.md`.

### Step 5 — Done

Print a summary of everything created/linked.

## What the skill does NOT do

- Does not push to git or create branches.
- Does not modify `CLAUDE.md` routing.
- Does not ask about metrics, glossary, or business model during setup.
