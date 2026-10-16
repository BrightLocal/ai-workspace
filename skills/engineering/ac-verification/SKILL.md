---
name: ac-verification
description: Use when a Jira ticket's implementation must be checked against its acceptance criteria on a BrightLocal dev env (dev1..dev9) — "verify LM-1234 on dev2", "test the ticket against its ACs", "does LM-1234 work on devX?", "QA this ticket before it goes to testing", "deploy LM-1234 and check the flow", or after a QA bug report on a dev env. Turns each AC into an observable check, says how to deploy the ticket's Tools and ListingSyncer branches correctly, how to watch the flow read-only, and how to judge PASS / FAIL / NOT OBSERVED with evidence, including the dev-env failures that look like ticket bugs but are not.
---

# Skill: verify a ticket against its acceptance criteria on a dev env

**Lifecycle:** Product

Method for `agents/ticket-ac-verifier/`. Deploying follows `skills/engineering/deployer/SKILL.md`
(its policy table is binding). Reading a dev box follows the read-only rules in
`agents/dev-env-inspector/CLAUDE.md`. This file adds what neither covers: what to check, how to
tell a real bug from a dev-env problem, and how to report.

Built from the LM-4503 run on dev2 (2026-10-15/16), where three things went wrong at once: a real
ticket bug, a stale ListingSyncer database pool, and the post-deploy cache window. Every pitfall
below was hit there.

## 1. Turn each AC into an observable check

An AC is checked only when something on the env shows it. For each AC, write down:

- **Trigger:** what makes it happen (a UI action the user does, a cron, a queue message, a deploy).
- **Where to look:** a log, a request reaching ListingSyncer, the UI, a DB value the user reads.
- **Proves it:** the line or state that means PASS.
- **Disproves it:** what you would see if it were broken.

Add **regression checks** for what the change touches but the ACs do not mention, such as "LM
still saves" or "the page still loads for a location without the feature". On LM-4503 the worst
bug was a regression: every LM save failed with "This form should not contain extra fields".

Worked example (LM-4503, Foursquare diff storage):

| AC / regression | Trigger | Where to look | Proves it |
| --- | --- | --- | --- |
| LM loads for a location without Active Sync | User opens LM for location 3876 | User's browser; LS request log for the page's reads | Page renders; `GET /locations/{uuid}/settings/active-sync` with no error after it |
| LM save works and keeps the stored Foursquare AS value | User changes the phone in LM and saves | UI result; LS request log; then `active_sync_settings.foursquare_active_sync_enabled` (the user runs the query) | Save succeeds; `PUT /locations/{uuid}/settings/active-sync/updates` (seen 09:49:08); the value is unchanged |
| A CB In Progress campaign creates the listing row | User moves a CB campaign with Foursquare to In Progress | LS request log: `POST /foursquare/listing/{uuid}` | Route hit with no error after it |

If nothing read-only can show an AC (a third-party key missing on dev, prod-only data, a DB row
`dev-ssh.py` cannot read), say how it could be checked instead: a query the user runs, a unit
test, a QA step. Its verdict is NOT OBSERVED, never PASS by assumption.

## 2. Deploy the ticket correctly

- **Find the PRs in both repos.** Run `gh pr list --repo BrightLocal/Tools --state open --search "<KEY>"` and
  the same for `BrightLocal/ListingSyncer`. Read each PR's base branch and description.
  - **Stacked PRs:** deploy the ticket's own branch, which contains its base.
  - **One repo only:** a ticket can change one repo yet need another ticket's branch in the other
    (LM-4506 changed only ListingSyncer and needed Tools `task/LM-4503`). Ask which branch to pair
    with it rather than guessing.
- **Order: ListingSyncer first, then Tools.** Tools calls ListingSyncer and runs the shared
  migrations. A PR labelled "run migrations before deploy" means the Tools deploy must finish
  before the flow is exercised.
- **Deployer repo names** are `Tools` and `ListingSyncer` (verified 2026-10-16).
- **A repo already at the branch head** needs no redeploy, with one exception: a ListingSyncer
  container that has been up a day or more and idle may hold a stale MySQL pool (pitfall below).
  Redeploying it is the only sanctioned restart.
- **Verify what landed:**
  - Tools: `cat ~/tools/.revision`. The `Commit:` sha must be a prefix of the deployed sha.
  - ListingSyncer: there is no revision file. Deployer `status --repo ListingSyncer` shows the
    deployed commit. Check that the container restarted after the deploy began
    (`docker inspect --format '{{.State.StartedAt}}' listing_syncer`), then grep a line the PR
    added inside it (`docker exec listing_syncer grep -c '<marker>' /var/www/src/...`).
- **Wait about 60 s after every Tools deploy** before exercising anything. dev boxes rebuild the
  container cache, and requests in that window fail (pitfall below).
- **Feature flags:** check the flag the flow needs (e.g. `lm.foursquare.enabled`) is on for the
  customer you test with. Nothing read-only can switch it, so ask the user.

## 3. Watch the flow

Most flows need a UI step only the user can do: no browser session is available, and `curl` is
not on `dev-ssh.py`'s allowlist. So:

1. Start `scripts/watch-dev-logs.py <env> --match '<location uuid>|<location id>'` in the
   background (Bash `run_in_background`). Add `--until '<log message>'` when the flow ends in a
   line of its own, such as a cron's.
2. Ask the user to do one step, with the exact location and button, and to say when it is done.
3. The watch stops by itself at the first ListingSyncer write or error, or Tools warning or error.
   It waits 25 s for the rest of the request, then prints a digest:
   - ListingSyncer writes, and reads matching `--match`; other reads are only counted;
   - errors from both ListingSyncer logs;
   - Tools warnings and errors;
   - how many lines each source had, which is the "log was alive" proof a NOT OBSERVED needs.
4. If the user says the step is done but the watch is still waiting, stop it and run
   `--dump --since <its start time>`. A failed step with nothing in any log is the silent-4xx
   pitfall (section 4).

The watch leaves out dev-box background noise: Braintree webhook-signature errors (about every
20 min) and Planhat client errors. It reports how many lines it dropped, and `--ignore ''` keeps
everything.

Where each signal lives (all via `agents/dev-env-inspector/scripts/dev-ssh.py`):

| Signal | Command | Note |
| --- | --- | --- |
| Tools app log | `tail -n 400 /var/log/php-errors.log` | Levels vary by box. dev1 and dev2 write DEBUG/INFO; dev3's recent lines are all ERROR (2026-10-16). A missing info line proves nothing until the box is shown to write that level. |
| A Tools → ListingSyncer call failed | the same log | WARNING `Guzzle wrong response` with the LS URI and status code, then ERROR `max retries count is reached`. |
| Did a Tools action reach ListingSyncer? | `docker exec listing_syncer tail -n 600 /var/www/var/log/dev.log` | `request.INFO: Matched route "…"` lines carry the method and URI. |
| ListingSyncer errors | `docker logs --since <time>Z --tail 2000 listing_syncer` | Console format (`09:17:41 ERROR [app] …`). |
| Deployed Tools commit | `cat /home/sites/tools/.revision` | Re-check before the final report, since others redeploy. |
| Web server logs | `ls -l /var/log/nginx/` | The per-site logs (`<env>.brightlocal.dev.ssl-{access,error}.log`) are `640 www-data:adm` and unreadable as `sites`. Their mtime is a hint; the user can `sudo tail` them. |

Both ListingSyncer logs start fresh on every LS deploy. Dump the window into the report before
redeploying LS, including a redeploy that only clears a stale pool.

## 4. Judge each AC

Verdicts are the inspector's three, plus one for ACs:

- **PASS:** quoted evidence shows the expected behaviour.
- **FAIL:** quoted evidence shows something else.
- **NOT OBSERVED:** nothing either way. Show that the log source was alive in that window.
- **DEFERRED:** the team agreed to build this part later. Name where it was agreed (PR, comment)
  and its follow-up ticket, and flag it when no ticket exists. On LM-4503, "Submission Pending in
  LM" was a follow-up in the PR with no ticket. Never PASS.

Classify every failure before calling it a ticket bug:

| Symptom | Cause | What to do |
| --- | --- | --- |
| Tools logs `Guzzle wrong response` code 500 for LS URIs; LS container output `ERROR [app] … 2006 MySQL server has gone away` | LS MySQL pool went stale while the container idled | Dev-env issue. Dump the LS logs into the report, redeploy LS via Deployer to restart it, then re-run the step. |
| `Braintree … no matching public key`, Planhat `Client error` | Background noise on dev boxes | Not related to the ticket. The watch leaves these out by default. |
| Web requests return 500 with `Failed to create "/var/cache/tools/temp/tools": mkdir(): Permission denied`, for up to about a minute after a Tools deploy | Container cache rebuild window | Dev-env issue. Wait and retry. Not a bug unless it persists. |
| The UI reports a failed save and no log anywhere moved | A 4xx validation error, which Tools does not log | Reproduce the request through the Symfony form in a unit test. LM-4503: LM posts back the whole state it loaded, so a new DTO key needs a field in the LM form. Or ask for the DevTools Network response. |
| Blank page, no server error | A frontend exception (e.g. LM's `initial_state.ts` reading a null integration) | Check the shape of the data the page gets. A null where the frontend expects an object is the usual cause. |
| `Deployer rejected the session` | Expired `deployer-sid` cookie | Ask once and write it to `personal/credentials/deployer.env` (deployer skill → Credential). |
| `<env> is reserved by <colleague>` | Someone else holds it | See the agent's reservation step. Never work around it silently. |

A ticket bug gets a suspected cause and, where possible, a failing regression test written
locally (it failed with exactly `This form should not contain extra fields` on LM-4503). It is
fixed only with the user's go-ahead, through the normal branch → QA checks → push → redeploy loop,
then the affected checks are re-run.

## 5. Report

Write `products/<Product>/working/<KEY>/ac-check-<env>-<YYYY-MM-DD>.md`:

```markdown
# <KEY> on <env> — <date>
Jira status: … · Deployed: Tools <branch> @ <sha> (verified how), ListingSyncer <branch> @ <sha> (verified how)
Window checked: <from>–<to> UTC · Test data: location <id> (<uuid>), customer …

| # | AC / regression | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | … | PASS | `<the part of the line that decides it>` at 09:49:08 |

Queries for the user: … (numbered, read-only, built from the branch's migrations)
Dev-env issues seen (not ticket bugs): …
Ticket bugs found: … (cause, fix commit or proposal)
Open: … (what still needs a person: test data, a flag, a DB query, a QA step)
```

Build the queries from the branch's migrations, not from memory: key types differ between tables.
On LM-4503 the Foursquare tables key on `location_uuid BINARY(16)` (`UUID_TO_BIN('<uuid>')`), while
`active_sync_settings` keys on the string `location_id`.

In chat, give the verdict per AC and the file path. For QA or Jira, draft a note that leads with
the plain-language result and keeps the technical details short at the end. Post it only after
the user approves.

**Personal data:** dev-box logs carry customer data (location names, phones, user ids). Quote
only the part of a line the verdict needs, and keep raw log dumps out of the report.
