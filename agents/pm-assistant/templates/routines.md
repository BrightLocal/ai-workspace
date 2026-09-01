# Routines

> Definitions only — pm-assistant reads this to know what each routine does.
> IDs are stable. status: active | future.

- R-01 — Morning check-in · subagent: daily-planner · cadence: daily (morning) · trigger: "daily check-in", "plan my day", "план на сьогодні" · status: active
- R-02 — End-of-day review · subagent: day-reviewer · cadence: daily (evening) · trigger: "wrap up my day", "підсумуй день" · status: active
- R-03 — Backlog grooming · subagent: backlog-groomer · cadence: weekly (Fri) · trigger: "groom my backlog", "розгреби беклог" · status: active

## Future (designed, not built — do not run)

- R-04 — Scheduled runs (cron) · via harness schedule skill, invoking R-01/R-02 headlessly · status: future
- R-05 — Product-doc updates from meetings / merged PRs · status: future
- R-06 — Jira Roadmap & Confluence sync · EXPLICIT USER COMMAND ONLY · status: future
- R-07 — Meeting prep / follow-ups · status: future
