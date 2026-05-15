# calendar-analyzer

Analyses your Google Calendar for a given day (or a specific meeting), pulls
Gemini meeting notes where available, and produces structured summaries with
critical-item extraction and documentation opportunity detection.

## Prerequisites

1. **Claude Code** with the `claude.ai Google Calendar` and `claude.ai Google Drive`
   integrations enabled (both are global integrations, not workspace-specific).
2. **First-time auth:** On first run the agent will open an OAuth flow for Google
   Calendar and Google Drive. Complete both once — tokens are cached globally.

## Quick start

Open Claude Code from this directory and type any of the phrases below.
No commands, no flags — plain language works.

### Analyse the whole day

```
analyse my meetings today
```
```
what happened in my meetings today?
```
```
summarize my calendar for 2026-05-13
```
```
summarize my calendar for last Thursday
```
```
recap my day
```
```
meeting notes for today
```
```
what were my meetings about today?
```

### Analyse a specific meeting

```
analyse the Connected Locations Daily meeting
```
```
summarize the Backlog Refinement from 2026-05-13
```
```
analyse this meeting: https://calendar.google.com/calendar/event?eid=...
```
```
summarize the sprint review meeting from last Tuesday
```
```
what was discussed in the retrospective yesterday?
```

## Output

Results are written to `personal/meeting-notes/{YYYY-MM-DD}/` (gitignored — never committed).

```
personal/meeting-notes/
└── 2026-05-14/
    ├── 00-raw-events.md          ← raw data from Google Calendar (intermediate)
    ├── 00-daily-summary.md       ← day overview with all critical items aggregated
    ├── 09-30-connected-locations-daily.md
    ├── 11-00-backlog-refinement.md
    └── 15-00-sprint-review.md
```

### Per-meeting file structure

Each `{HH-MM}-{meeting-slug}.md` contains:

```
# Meeting Title — YYYY-MM-DD HH:MM

**Type:** standup | refinement | sprint_review | retrospective | one_on_one | general
**Duration:** X min
**Attendees:** ...

## Summary
...

## [Type-specific sections]
(standup: Done / Planned / Blockers)
(refinement: Stories / AC Gaps)
(sprint_review: Demonstrated / Accepted / Rejected / Feedback)
(retrospective: Went well / To improve / Action items)
...

## ⚠️ Critical Items
Action items, decisions, blockers, deadlines, open escalations.

## 📎 Potential Doc Updates
Links to existing docs that could be updated, or new doc suggestions.
```

### Daily summary (`00-daily-summary.md`)

- Meeting count and total time in calls
- Aggregated ⚠️ Critical Items list (all meetings, with file links)
- 📚 Documentation Opportunities (aggregated from all meetings)

## Meeting type detection

The agent detects meeting type from the title:

| Title contains | Detected type |
|---|---|
| daily, standup, stand-up, scrum | Daily Standup |
| refinement, backlog, grooming | Backlog Refinement |
| sprint review, review | Sprint Review |
| retrospective, retro | Retrospective |
| 1:1, one-on-one, sync with [name] | 1-on-1 |
| (anything else) | General meeting |

This works for any team — not just Connected Locations. Title keywords are
matched case-insensitively, so "CL Daily", "BE Standup", "Team Retro" all map
correctly.

## Gemini meeting notes

If Google Meet's Gemini feature generated notes for a meeting, they appear as
a Google Doc attachment on the calendar event. The agent reads that document
via Google Drive and uses it as the primary source for the summary.

If no notes are available, the summary is based on event metadata only
(title, attendees, description) and the file is marked with a warning.

## Human gates

You can pause between phases to review intermediate output:

- After Phase 1 (`00-raw-events.md` is written) — verify the meeting list is correct
- After Phase 2 (individual `.md` files) — review summaries before doc-connector runs

To stop after Phase 1, just say "stop here" or close the session and re-open
later, then ask "continue with meeting analysis".

## Running as a custom agent (advanced)

You can open this directory directly in Claude Code:

```bash
cd ai-workspace/agents/calendar-analyzer
claude
```

Or integrate it into a daily routine by invoking from the workspace root:

```bash
cd ai-workspace
claude --agent calendar-analyzer "analyse my calendar"
```
