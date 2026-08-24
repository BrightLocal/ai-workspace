# Jira configuration & ticket conventions

MCP server: `atlassian`. Every value below was verified live on 2026-08-24.

## Connection

| Setting | Value |
|---|---|
| Site | `https://brightlocal.atlassian.net` |
| `cloudId` | `5d89576a-2167-45d7-b6a4-cfa42edbee57` |
| Scopes | `read:jira-work`, `write:jira-work` (create + comment both work) |

Pass `cloudId` on every call. You may also pass `brightlocal.atlassian.net`
directly, but the UUID is known-good — use it.

> The MCP server emits a deprecation notice about the HTTP+SSE transport being
> unsupported after 30 June 2026 (`.mcp.json` points at `/v1/sse`; the
> replacement is `/v1/mcp`). It is noise on every call — don't relay it into
> investigation reports, but do surface it if Jira calls start failing.

## Target project

**Default: `LM` — "Backend Services"** (id `13423`, classic software project).

Confirmed by precedent: `LM-4317`, `LM-3736`, `LM-3741`, `LM-3695`, `LM-4143`
are all Sentry-originated Tools backend errors filed in `LM`.

**Always confirm the project with the user before creating**, showing project,
type, priority, and summary. `LM` is the default, not a certainty — Sentry
surfaces other owning teams that belong on other boards:

| Sentry team | Likely project | Notes |
|---|---|---|
| `connected-locations-be` | `LM` — Backend Services | The CL team; `LM` is their prefix |
| `backend-insights-be` | `BI` — Backend Insights | Confirm before filing |
| `citations-be` | `CB` — Citations | Confirm before filing |

Other candidates if the user redirects: `CL` (Clients & Locations),
`PS` (Platform Services), `PRD` (Product Engineering).

> **Do NOT use the `API` project for Tools API-module bugs.** `API` is a dead
> board (last activity 2022) about third-party review-fetching integrations,
> unrelated to `src/Modules/API/`. API-module errors go to `LM` like any other
> Tools backend error.

## Issue types in `LM`

| Type | id | Use for |
|---|---|---|
| **Internal Bug** | `10273` | **Default for Sentry-originated errors** |
| Bug | `1` | Customer/QA-reported. House style prefixes `[Standup ticket]` |
| Investigation | `8` | Symptom real but cause not established |
| Task | `3` | Cleanup/observability work with no user-visible defect |
| Improvement/New Feature | `4` | Enhancements |
| Sub-task | `5` | Child of an existing ticket |
| Epic | `9` | Collection |

Recent `LM` issues matching "sentry": 11 `Bug`, 10 `Internal Bug`, 8 `Task`. The
split is meaningful — **`Internal Bug` is the convention for errors we found
ourselves in Sentry**, `Bug` is for things a human reported. Pick `Investigation`
over `Internal Bug` when the diagnosis stopped at "unverified".

## Priority

Field `priority`, set via `additional_fields`. Scheme is `P1`…: `LM-4317` uses
**`P2 - Medium`**, a good default.

```json
{"priority": {"name": "P2 - Medium"}}
```

Justify anything higher with evidence from the investigation — sustained high
event count, many distinct users, or data corruption. A 29-event/1-user issue is
not a P1 no matter how alarming the stack trace looks.

## Labels

No components are configured on `LM`. Labels seen in use: `BackEnd`,
`FrontEnd`, `QA`, `Refinement`, `zendesk_escalated`, `GOAL1`. `LM-4317` carries
none, so labels are optional — `BackEnd` is a reasonable addition for Tools
backend errors. Don't invent new labels.

## Deduplicate before creating — mandatory

Sentry issues often already have a ticket. `LM-4317` already covers
`TOOLS-BACKEND-B77`; filing another would be pure noise.

**Verified working dedup query** (finds `LM-4317` from the Sentry short ID):

```
searchJiraIssuesUsingJql(
  cloudId = "5d89576a-2167-45d7-b6a4-cfa42edbee57",
  jql     = 'project = LM AND text ~ "TOOLS-BACKEND-B77" ORDER BY created DESC',
  fields  = ["key", "summary", "issuetype", "status"],
)
```

Run **before** proposing a ticket. Search on:

1. The Sentry short ID (`TOOLS-BACKEND-B77`) — most reliable, since the house
   style pastes the Sentry link into the description.
2. The exception class (`AdditionalDataForwardFailedException`).
3. A distinctive phrase from the error message.

Widen past `project = LM` when unsure — drop the project clause entirely.

If a match exists: **report it and stop.** Offer to add findings as a comment on
the existing ticket instead of creating a duplicate. Only create a new ticket if
the user says the existing one is genuinely different.

Keep `fields` narrow. An unrestricted `LM` search blew the token limit and got
spilled to a file; `["key","summary","issuetype","status"]` is enough to triage.

## Description structure — follow `LM-4317`

`LM-4317` is the house reference, written by this workspace's user for exactly
this workflow (a Sentry investigation of the Location module). Match its shape:

```
h2. Summary
2–4 sentences: what breaks, mechanism in one line, who it hits.
Inline Sentry link + event count and window.

h2. Failure chain
{code} block: the call chain from entry point to throw site, one hop per line.

h2. Root cause
The specific defect, with {code:php} snippets and file:line references.
State how many events were sampled to confirm it.

h2. Impact
Quantified. Distinct entities affected, customer spread, daily peaks,
blast radius (what else fails as a consequence).

h2. Observability defects found during investigation   [optional]
Numbered list of things that made this harder to diagnose than it should be.

h2. Scope of this ticket
_In scope:_ bullets, each naming the file to change.
_Out of scope (follow-up tickets):_ bullets, each with why it's separate.

h2. Acceptance criteria
Bullets, each independently checkable.
```

Non-obvious things that make `LM-4317` good, and that you should copy:

- **Marks unverified claims as unverified** — "_Not confirmed against the
  database._" Carry the investigation's uncertainty into the ticket; don't
  launder inference into fact.
- **States sample size** — "Verified across 15/15 sampled Sentry events".
- **Suggests the query** that would confirm an open question.
- **Separates in-scope from follow-ups**, so the ticket stays implementable.
- **Links Sentry by URL**, including the numeric form
  (`…/issues/41676/`) — both numeric and short-ID URLs resolve.

### Formatting — verify after creating

`LM-4317`'s description is stored as **Jira wiki markup** (`h2.`, `{code}`,
`{code:php}`, `{{monospace}}`, `_italic_`, `[text|url]`), and `LM` is a classic
project (`style: classic`, `simplified: false`).

Write wiki markup to match. But `createJiraIssue` also accepts
`contentFormat: "markdown"` or `"adf"`, and which one renders correctly depends
on the project's renderer — which is **not** something to guess at.

**So: after creating, read the issue back with `getJiraIssue` and check the
description rendered as headings and code blocks.** If literal `h2.` or `{code}`
markers are showing as text, rewrite the description in Markdown with
`contentFormat: "markdown"`. Tell the user either way — a mangled ticket is
worse than no ticket.

## Creating the ticket

```
createJiraIssue(
  cloudId       = "5d89576a-2167-45d7-b6a4-cfa42edbee57",
  projectKey    = "LM",
  issueTypeName = "Internal Bug",
  summary       = "<exception class>: <message>",   // or a plain-language symptom
  description   = "<wiki markup per the structure above>",
  additional_fields = {"priority": {"name": "P2 - Medium"}},
)
```

**Summary style.** Both forms have precedent:

- Verbatim exception — `TypeError: Cannot read properties of undefined (reading 'info')` (`LM-3741`)
- Plain-language symptom — `Additional-data forward to ListingSyncer fails with 400 for locations with empty country` (`LM-4317`)

Prefer the plain-language form **when the root cause is known** — it is far more
useful on a board. Fall back to the exception text when the cause is still open.
Keep it under ~120 chars.

Leave `assignee` unset (`LM-4317` is unassigned) unless the user asks.

## Linking

Available link types include `Relates`, `Duplicate`, `Blocks`, `Problem/Incident`
(`causes` / `is caused by`), `Cloners`, `Defect`, `Found during testing`.

Use `Relates` for a sibling ticket carved out of the same investigation, and
`Problem/Incident` when one issue genuinely causes another.

```
createIssueLink(
  cloudId      = "5d89576a-2167-45d7-b6a4-cfa42edbee57",
  type         = "Relates",
  inwardIssue  = "LM-4317",
  outwardIssue = "LM-4318",
)
```

## Fix plan as a comment

```
addCommentToJiraIssue(
  cloudId      = "5d89576a-2167-45d7-b6a4-cfa42edbee57",
  issueIdOrKey = "LM-4321",
  commentBody  = "<the plan>",
)
```

Comment rather than description so the ticket keeps a clean problem statement
and the plan stays reviewable and revisable on its own. See
`ticket-templates.md` for the plan structure.

## Write discipline

Creating tickets and comments is **outward-facing and visible to the whole
team**, and Jira has no clean undo — a deleted ticket still burns a key and may
have fired notifications.

So: **never create a ticket or post a comment without explicit confirmation in
the current turn.** Show exactly what will be created and wait. Approval to
create a ticket is not approval to also post a plan, and neither is approval to
implement — each is its own gate.

Never transition, assign, or edit tickets you did not create in this session
unless asked.
