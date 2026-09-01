# pm-assistant

A personal chief-of-staff agent for the PM: it manages your private task
backlog, runs daily check-in / end-of-day / grooming routines, and delegates
work to the other agents and skills in this workspace.

**Privacy:** all data lives in `personal/pm-assistant/` — gitignored, never
committed. The agent code in this folder carries no personal content and is
safe to share.

## Quick start

```bash
./agents/pm-assistant/scripts/run.sh     # one-time setup (idempotent)
```

Fill in `personal/pm-assistant/context.md`, then in a Claude Code session just
say **"daily check-in"**.

```bash
./agents/pm-assistant/scripts/run.sh status   # read-only backlog overview
```

## What to say

| You say | What happens |
|---|---|
| "add a task: prep sprint review, due Friday" | new T-NNN in the backlog + journal entry |
| "mark T-012 done" / "drop T-012" | task moves to Done + journal entry |
| "show my backlog" / "what's on my plate?" | summary, no writes |
| "daily check-in" / "plan my day" | daily-planner proposes ≤3 focus items (+ calendar if available) |
| "wrap up my day" | day-reviewer reconciles the day, proposes carryover |
| "groom my backlog" | backlog-groomer audits staleness, hygiene, format |
| "delegate T-009 to jira-to-pr" | task → Waiting; the target pipeline runs with its own gates |

Routines never edit the backlog directly — they write **proposed moves** into
the daily log, and the assistant applies them only after you confirm.

## Private home layout

```
personal/pm-assistant/
├── backlog.md        # live board: Now / Next / Later / Waiting / Done
├── routines.md       # routine definitions (R-01..R-03 active, R-04+ future)
├── context.md        # your standing context: focus, people, preferences
└── log/{date}.md     # daily journal + routine outputs
```

## What it will do later (designed, not built)

Scheduled runs (cron), product-doc updates from meetings / merged PRs, Jira
Roadmap & Confluence sync, meeting prep and follow-ups. External sync will
always require an explicit command per run.

## FAQ

**Does anything leave my machine?**
No. v1 writes only to `personal/pm-assistant/` and reads the calendar (read-only,
optional). External sync is future work and explicit-command-only.

**Where did my backlog go after a git operation?**
Nowhere — `personal/` is gitignored, git never touches it.
