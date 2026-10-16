# Running the daily triage automatically

A weekday-morning **Mode A triage digest**, written to a dated Markdown file and
optionally posted to Slack. Runs on this laptop via a systemd **user** timer
calling `claude -p` headless.

## Why triage only, and why nothing gets filed

The agent has three human confirmation gates (ticket → plan → implement). An
unattended run cannot answer them, so the scheduled job is deliberately
restricted to the read-only half: it looks, ranks, and reports. **Nothing is
filed, resolved, assigned or snoozed by the timer.** You read the digest and
escalate manually in a normal session.

This is also the shape the triage practice actually calls for — someone reviews
the new errors once a day and decides. The job automates the *looking*, which is
the boring part, not the *deciding*, which is the part that needs judgement.

## The property that matters most

**When the environment is unhealthy, the job produces no digest at all.**

A disconnected VPN and a genuinely quiet night look identical in Sentry output —
both are empty. A cheerful "nothing broke today" that really means "I couldn't
see anything" is worse than no report, because you act on it. So
`daily-triage.sh` verifies every precondition first and, on any failure, writes
`YYYY-MM-DD.SKIPPED.md` and posts a Slack warning saying explicitly *this is not
an all-clear*.

Checks, in order — each fails differently, so all four are separate:

1. `SENTRY_ACCESS_TOKEN` present
2. The VPN systemd unit is active
3. A `tun` interface exists (the unit can be active with no route)
4. `10.79.115.30:9200` accepts a TCP connection (the tunnel can be up but scoped
   wrong — Engineer permissions are required)

## Install

### 1. Create the environment file

systemd user services do **not** read `~/.zshrc`, so the token has to be
provided explicitly.

```bash
cat > ~/.config/sentry-daily-triage.env <<'EOF'
SENTRY_ACCESS_TOKEN=<1Password → Engineering → "Sentry Claude MCP Token">
SENTRY_DIGEST_SLACK_WEBHOOK=<optional — Slack incoming webhook URL>
EOF
chmod 600 ~/.config/sentry-daily-triage.env
```

`chmod 600` is not optional — this file holds an org-level Sentry token. It sits
outside the repo on purpose; never commit it or paste its contents into a chat.

Optional overrides: `SENTRY_DIGEST_WORKSPACE`, `SENTRY_DIGEST_VPN_UNIT`,
`SENTRY_DIGEST_MODEL` (default `sonnet`), `SENTRY_DIGEST_ES_HOST/_PORT`.

### 2. Install the units

```bash
mkdir -p ~/.config/systemd/user
cp agents/sentry-issue-investigator/scripts/systemd/sentry-daily-triage.* \
   ~/.config/systemd/user/
systemctl --user daemon-reload
```

### 3. Test before enabling

Run it once by hand, with the VPN up:

```bash
set -a; source ~/.config/sentry-daily-triage.env; set +a
agents/sentry-issue-investigator/scripts/daily-triage.sh
```

Then check `products/Tools/working/sentry/daily/$(date +%F).md`. **Also test the
failure path** — it is the half that protects you:

```bash
sudo systemctl stop openvpn@vpn.brightlocal.dev.service
agents/sentry-issue-investigator/scripts/daily-triage.sh   # expect: abort + .SKIPPED.md
sudo systemctl start openvpn@vpn.brightlocal.dev.service
```

### 4. Enable

```bash
systemctl --user enable --now sentry-daily-triage.timer
systemctl --user list-timers sentry-daily-triage.timer
```

### 5. Let it run while you're logged out

User services stop at logout unless lingering is enabled:

```bash
sudo loginctl enable-linger "$USER"
```

Without this the digest only appears on days you happen to be logged in at 08:12.

## Schedule

`Mon..Fri 08:12`, `Persistent=true`, `RandomizedDelaySec=4min`.

- **08:12, not 08:00** — an off-minute avoids the pile-up every scheduler on the
  planet creates on the hour, and nobody notices twelve minutes.
- **Weekdays only** — a Saturday digest nobody reads trains you to ignore the
  weekday ones. Monday's run still covers the weekend, since the sweep windows
  are 24h and 7d.
- **`Persistent=true`** — if the laptop was asleep at 08:12, the run fires on
  wake. Without it a closed lid means no digest *and* no sign one was missed.
- **`OnBootSec=3min`** — after a cold boot, give the VPN time to come up rather
  than aborting instantly.

## Operating it

```bash
systemctl --user list-timers sentry-daily-triage.timer   # when does it next run
journalctl --user -u sentry-daily-triage -n 50           # what happened last time
systemctl --user start sentry-daily-triage.service       # run now
systemctl --user disable --now sentry-daily-triage.timer # stop
```

Script-level logs (more detail than the journal, including the full Claude
transcript) go to `products/Tools/working/sentry/daily/run.log`.

## Output

| Path | What |
|---|---|
| `products/Tools/working/sentry/daily/YYYY-MM-DD.md` | The digest |
| `products/Tools/working/sentry/daily/YYYY-MM-DD.SKIPPED.md` | Written instead when preconditions failed |
| `products/Tools/working/sentry/daily/run.log` | Append-only run log |

`products/*/working/` is gitignored, so digests stay local. They accumulate —
prune with something like
`find products/Tools/working/sentry/daily -name '*.md' -mtime +60 -delete` if it
bothers you.

The Slack post carries only the `## TL;DR` section plus the digest path, and is
explicitly labelled *triage only — nothing was filed*.

## What actually constrains the run

**The allowlist, not the permission mode.** The script runs with
`--permission-mode bypassPermissions` because there is nobody to approve a
prompt, so safety comes entirely from `--allowed-tools` / `--disallowed-tools`.
Read tools for Sentry and Elasticsearch, plus `Read`/`Glob`/`Grep`/`Write`, are
allowed. Every Sentry, Elasticsearch and Jira **write** tool is denied
explicitly, as are `Bash`, `Edit`, and the web tools.

If you extend the prompt, **re-check that allowlist.** It is the only thing
between an unattended run and a Jira board full of robot tickets.

## Known limits

- **Jira is not used.** The Atlassian MCP authenticates interactively (OAuth) and
  is unlikely to work in a headless run, so the digest cannot dedupe against Jira
  or name the ticket that previously closed a regression. It flags the regression;
  you look up the ticket. Worth testing if you want more.
- **Laptop-bound.** No VPN, or machine off all day, means no digest — you get a
  `.SKIPPED.md` and a Slack warning instead of a false all-clear. Move the job to
  an always-on box if you want a guarantee.
- **Model default is `sonnet`** to keep a daily job cheap. Mode A is mostly
  querying and tabulating. Set `SENTRY_DIGEST_MODEL=opus` if the triage reads
  feel shallow.
- **Cost is real but small** — one Mode A sweep over two modules, five days a
  week. Watch it for the first week before assuming.

## If you outgrow this

n8n, GitHub Actions or Airflow become worth it when you want fan-out to several
destinations with retries, a visual run history, or non-engineers editing the
schedule. For one daily job on one laptop they are strictly more moving parts for
the same result — a timer and a shell script have no daemon to babysit and no
second scheduler to keep in sync.

The natural next step in that direction is moving the job to an always-on server:
same script, same units, a persistent VPN, and a digest that appears whether or
not your laptop is open.
