# AI Workspace — корінь

This is a personal AI workspace for product work in the Local SEO niche.
It is designed to be shareable with teammates, but currently used by a single user.

The user is a PM on the **Backend Services** team (formerly Connected Locations,
merged with part of the Listings team in Aug 2026). Team composition and areas
of responsibility live in `shared/team.md` — read it whenever ownership or
"is this our team's scope?" matters.

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

### interviews-to-vpdc (`agents/interviews-to-vpdc/`)

Triggers on any of:
- "analyze my interviews" / "analyse interview transcripts" (and spelling variants)
- "run VPDC analysis on [folder]" / "build a value proposition canvas from interviews"
- "synthesize user interviews" / "what did the interviews tell us"
- Ukrainian variants: "проаналізуй інтерв'ю" / "аналіз інтерв'ю" / "зроби синтез інтерв'ю"
  (accept transliterations and misspellings like "інтервью")
- A folder path containing a research brief + transcripts, plus an analysis request

On match: read `agents/interviews-to-vpdc/CLAUDE.md`, set ACTIVE_PRODUCT from context or ask,
ask for the input folder if not given, run scripts/run.sh setup, then execute phases in
sequence. Working artifacts are written in English regardless of input language; verbatim
quotes keep their original language. Confluence publication requires an explicit user
go-ahead — never chain the report writer into the publisher.

### codebase-to-domain-doc (`agents/codebase-to-domain-doc/`)

Triggers on any of:
- "generate domain documentation" / "document the domain" / "domain definitions"
- "build domain definitions from the codebase" / "create a domain glossary"
- "fill knowledge gaps in the domain docs" / "verify our domain definitions against the code"
- Ukrainian variants: "згенеруй доменну документацію" / "задокументуй домен" /
  "доменні визначення" / "словник домену" (accept transliterations and misspellings
  like "доменна документація", "задокументуй домейн")
- A definitions-tree file or pasted tree, plus a request to explain/verify/document it
- A list of module or entity names plus a request to document their domain

On match: read `agents/codebase-to-domain-doc/CLAUDE.md`, detect mode (definitions
tree vs module-name seed), set ACTIVE_PRODUCT (the output home only — the repos
scanned default to Tools,ListingSyncer) from context or ask, run scripts/run.sh
setup, then execute phases in sequence. The main document stays business-language
only — technical evidence lives in the separate evidence map. Confluence publication
requires an explicit user go-ahead — never chain the doc writer into the publisher.

### pm-assistant (`agents/pm-assistant/`)

Triggers on any of:
- "daily check-in" / "morning check-in" / "plan my day" / "start my day"
- "what's on my plate (today)?" / "what should I do today?"
- "end-of-day review" / "wrap up my day" / "close out my day" / "daily review"
- "add a task: …" / "add to my backlog" / "note a follow-up"
- "show my backlog" / "my tasks" / "what am I waiting on?"
- "groom my backlog" / "clean up my backlog"
- "mark T-NNN done" / "complete T-NNN" / "drop T-NNN" / "delegate T-NNN to …"
- Ukrainian variants: "мій беклог" / "покажи беклог" / "план на сьогодні" /
  "що в мене на сьогодні" / "додай задачу" / "додай таску" / "додай в беклог" /
  "підсумуй день" / "підбий підсумки дня" / "закрий день" / "ранковий чекін" /
  "розгреби беклог" / "почисти беклог" / "закрий T-NNN" / "делегуй T-NNN на …"
  (accept transliterations and misspellings like "бэклог", "чек ін", "чекін")

On match: read `agents/pm-assistant/CLAUDE.md`. Quick ops (add/complete/move/
status/delegate) are handled inline by the orchestrator; routines (check-in,
end-of-day, grooming) run as subagents. If `personal/pm-assistant/backlog.md`
does not exist, run `agents/pm-assistant/scripts/run.sh` first. Disambiguation:
"recap my day" / meeting summaries stay with calendar-analyzer — pm-assistant's
end-of-day review is about TASKS and may itself delegate to calendar-analyzer.

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
