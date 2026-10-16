Run the sentry-issue-investigator agent in **Mode A only** — daily triage sweep.

Read `agents/sentry-issue-investigator/CLAUDE.md` and `config/sentry.md` first.

## Scope — read this before anything else

This is an **unattended run. There is no human to answer a question.**

- **Mode A only.** Do not run Mode B, C, D, E, F, G or H.
- **Do not create, edit or comment on any Jira issue.**
- **Do not call `update_issue` in Sentry** — no resolving, ignoring, assigning or
  archiving, even where a SNOOZE threshold would justify it. Record the proposed
  threshold in the digest; a human applies it.
- **Do not modify any file** except the digest file named below.
- If something looks urgent, **say so loudly in the digest**. Do not act on it.

## What to produce

Sweep both modules over the last 24 hours and the last 7 days:

- `stack.abs_path:"*/src/Modules/Location/*"`
- `stack.abs_path:"*/src/Modules/API/*"`

Run the reactive-signal queries from `config/sentry.md` **first** — regressed,
new, still-active, customer-visible-at-scale — then the frequency table. Bucket
every issue as **owned** or **passing through**, and give every issue a
disposition (ACT NOW / SNOOZE with a numeric threshold / IGNORE with a reason).

## Output

Write exactly one file: the path given in the `DIGEST_FILE` environment
variable. Nothing else. Structure:

```markdown
# Sentry daily triage — {YYYY-MM-DD}

## TL;DR
{2–4 lines. Lead with regressions, then anything new and rising, then the count
of everything else. If nothing needs attention, say exactly that — a quiet day
is a valid and useful result. This section is what gets posted to Slack, so it
must stand alone without the rest of the file.}

## Needs attention
{One block per ACT NOW issue: short ID, error, events/users over the window,
trend, culprit file:line, owning team, and one sentence on why it made this
list. Empty is fine — say "nothing".}

## Regressions
{Issues matching `is:regressed`. For each, the Sentry short ID and — if a search
would find one — the Jira ticket that previously closed it. A regression means a
past fix did not hold; rank these above raw frequency.}

## New in the last 24h
{Short IDs, first-seen, release/build. Name the build — it points at the deploy
that introduced them.}

## Full table
{The standard Mode A table, ordered by events desc, capped at 25 rows per
module. State the window with every count.}

## Suppressed / not covered
{What the filters and the window excluded. Include the Location-module sibling
caveat: `*/src/Modules/Location/*` does not match LocationManager,
LocationConnections, LocationSummary or GeoLocationSearch.}

## Suggested follow-ups
{At most three. For each: the issue, and the single next action a human should
take. These are suggestions — nothing has been actioned.}
```

## Evidence rules still apply

Every number comes from a tool result. State the window with every count.
Distinguish events from users. Don't inflate: a 27-event/1-user issue is a small
problem however alarming its stack trace. If a Sentry query fails, say so in the
digest rather than omitting the section — a missing section reads like "nothing
found", which is the failure mode this agent exists to prevent.

Finish by printing `DIGEST_OK` on its own line as the last line of your reply.
