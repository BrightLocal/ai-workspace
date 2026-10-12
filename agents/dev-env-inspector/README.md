# dev-env-inspector

Checks how a feature branch behaves on a dev environment (`dev1`..`dev9`): confirms the right commit
is actually deployed, then reads Tools logs, the `listing_syncer` container's logs, worker error
logs and cron schedules, and reports a PASS / FAIL / NOT OBSERVED verdict per expectation with
quoted evidence.

## It is read-only — by construction

Nothing is created, modified or deleted on a dev box. Anything that has to change on an env goes
through Deployer (`agents/dev-env-deployer/`).

- All SSH goes through `scripts/dev-ssh.py`, which runs commands as `sites`
  (`sudo su - sites -c …`, same as doing it by hand) only after validating them:
  allowlisted read-only programs, pipes but no `;` `&&` `>` subshells or background jobs, no
  `rm`/`cp`/`tee`/`sed`/`awk`/editors, `docker` limited to `ps/logs/inspect/stats/top/exec <read-only cmd>`,
  no follow modes, no `.env`/secret reads. Every argument is re-quoted, so `$(…)` and backticks
  arrive as literal text.
- Direct `ssh`, `scp`, `sftp`, `rsync` are denied for Claude in `.claude/settings.json`.

## Try it

```
check LM-4503 on dev4
what's happening with the listing_syncer container on dev2?
check the logs on dev6 for the foursquare upload cron
```

It can't trigger crons/workers itself — it'll tell you when the next scheduled run is, or ask you to
trigger the action and then read that time window.

## Requirements

`ssh devX` working non-interactively from this machine (key-based, VPN up) and passwordless
`sudo su - sites` on the box. Reports land in
`products/<Product>/working/<feature>/dev-check-<env>-<date>.md`.
