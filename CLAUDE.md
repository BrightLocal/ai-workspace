# AI Workspace — корінь

This is a personal AI workspace for product work in the Local SEO niche.
It is designed to be shareable with teammates, but currently used by a single user.

## Architecture (read this first)

This workspace separates four distinct concepts. Do not mix them up:

- **`shared/personas/`** — system prompts for ROLES (PM, Architect, Analyst, PMM).
  These are perspectives, not agents. Subagents adopt them.
- **`skills/`** — domain knowledge modules (how to write a PRD, how to decompose a user story).
  Skills are referenced by subagents when needed, not loaded eagerly.
- **`agents/`** — autonomous pipelines (each is a folder with its own orchestrator + subagents).
  Examples: `jira-to-pr`, `context-to-prd`.
- **`products/`** — product-specific context. Each product has its own CONTEXT.md and a
  `working/` directory for in-flight artifacts.

## How interaction between roles works

Roles do NOT call each other directly. They communicate through **shared working documents**
on the filesystem. A typical flow:

1. PM-as-context-analyzer reads input → writes `working/{feature}/01-context.md`
2. Analyst-as-metrics-checker reads 01 → adds notes to `working/{feature}/02-metrics-review.md`
3. PM-as-prd-writer reads 01 + 02 → writes `working/{feature}/03-prd.md`
4. Architect-as-feasibility-reviewer reads 03 → adds review section

This pattern gives reproducibility, human gates between phases, and trustable artifacts.

## Loading order for any subagent

When a subagent starts, it loads context in this order:
1. `shared/domain/local-seo.md` — niche knowledge
2. `shared/domain/shape-up-method.md` — Shape Up concepts (appetite, scope hammering)
3. `shared/personas/{relevant-role}.md` — adopt this perspective
4. `products/{active-product}/CONTEXT.md` — product context
5. `working/{feature}/` — current state of the feature being worked on
6. Specific `skills/` files as needed

Subagents in `agents/*/` carry this loading order in their own CLAUDE.md.

## How to start

If you are new to this workspace, read in this order:
1. `README.md` — top-level orientation
2. This file (you're reading it)
3. `agents/context-to-prd/README.md` — the first end-to-end pipeline
4. `products/BrightLocal/CONTEXT.md` — what we're working on

## What lives where (quick reference)

- New role/perspective → `shared/personas/`
- Industry-wide knowledge (Local SEO terms, Shape Up) → `shared/domain/`
- Document templates → `shared/templates/`
- Product-specific context → `products/{name}/CONTEXT.md`
- In-flight feature work → `products/{name}/working/{feature-slug}/` (gitignored)
- Reusable methodology (how to write X) → `skills/`
- Multi-step automation → `agents/{pipeline-name}/`
- Personal preferences → `personal/` (gitignored)

## Agent routing

When user input matches a trigger phrase below, read the corresponding agent's CLAUDE.md
and execute its pipeline. Do NOT ask for content the agent is designed to fetch itself.

### calendar-analyzer (`agents/calendar-analyzer/`)

Triggers on any of:
- "analyse my meetings today" / "analyse my calendar"
- "what happened in my meetings today?" / "what were my meetings about today?"
- "summarize my meetings for [date]" / "summarize my calendar for [date]"
- "recap my day" / "meeting notes for today" / "calendar summary"
- "analyse the [meeting name] meeting"
- "summarize the [meeting name] meeting from [date]"
- "analyse this meeting [meeting name] [date]" (and spelling variants like "analize")
- "what was discussed in [meeting name] on [date]?"
- A Google Calendar URL (`calendar.google.com/calendar/event?eid=...`)

On match: read `agents/calendar-analyzer/CLAUDE.md`, detect mode (whole-day vs single-meeting),
parse the date and meeting identifier from the user's message, then execute the pipeline.
Do NOT ask the user to provide meeting content — the calendar-fetcher subagent retrieves it.

### context-to-prd (`agents/context-to-prd/`)

Triggers on any of:
- "write a PRD for [feature]" / "draft a PRD" / "create a PRD"
- "turn this into a PRD" / "make this a PRD"
- "write a spec for [feature]" / "draft a spec"
- Pasted free-form notes or transcript followed by "make this a PRD" or similar

On match: read `agents/context-to-prd/CLAUDE.md`, set ACTIVE_PRODUCT from context or ask,
then run phases in sequence.

### jira-to-pr (`agents/jira-to-pr/`)

Triggers on any of:
- A Jira issue key or URL (e.g. `BL-1234`, `https://brightlocal.atlassian.net/browse/BL-1234`)
- "implement [Jira key]" / "work on [Jira key]" / "build [Jira key]"
- "create a PR for [Jira key]"

On match: read `agents/jira-to-pr/CLAUDE.md` and execute the full pipeline from Jira analysis
through to PR creation.

## Working with product codebases

Each product in `products/` has a `codebase/` directory containing a symlink (or clone)
of the actual repository. Always use these paths — never hardcode absolute paths outside
the workspace and never use `cd` to change into a product directory.

**Conventions:**
- Read files via `products/{name}/codebase/{repo}/path/to/file`
- Run git commands via `git -C products/{name}/codebase/{repo} <command>`
- Before any investigation, read `products/{name}/CONTEXT.md` to get the repo name

Example — reading a file in Tools:
```
products/Tools/codebase/Tools/src/Modules/LocationManager/...
```

Example — git log in ListingSyncer:
```
git -C products/ListingSyncer/codebase/ListingSyncer log --oneline -10
```

## Sharing notes

This workspace is built shareable-by-design. Three rules to keep it that way:

- Never commit anything in `personal/` (it's in `.gitignore`)
- Never commit `working/` artifacts from `products/*/working/`
- Never put company secrets in `shared/` or `products/*/CONTEXT.md` (use env vars or `personal/credentials/`)
