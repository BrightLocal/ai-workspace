# Target environment: local (Vadym's laptop)

This file is the ONLY place that says *where and how* the jira-to-pr agent builds, tests and
verifies. The orchestrator, implementer and verifier read it at the start of every run (the
run prompt names it as "Target environment"). Agent prompts never hard-code these commands —
if a command here turns out to be wrong, say so in the run's `verification.md` instead of
improvising a different stack operation.

Selected by `TARGET_ENV=local` (the default). Another environment (e.g. a future AI-dev
server) gets its own `config/environments/<name>.md` with the same sections.

## Repos

The agent works in Vadym's real checkouts. The stacks below serve whatever is checked out there,
so the agent's branch is what gets verified.

| Repo | Workspace path (relative to ai-workspace root) | Real path | Default branch |
|---|---|---|---|
| Tools | `products/Tools/codebase/Tools` | `/home/lenovo/brightLocal/Tools` | `master` |
| ListingSyncer (LS) | `products/ListingSyncer/codebase/ListingSyncer` | `/home/lenovo/brightLocal/ListingSyncer` | `master` |

- The agent runs with cwd `agents/jira-to-pr`, so from cwd the repos are
  `../../products/Tools/codebase/Tools` and `../../products/ListingSyncer/codebase/ListingSyncer`.
  The real paths are what `git -C` and the container mounts see; use either, never a copy.
- Remotes are SSH (`git@github.com:`); inside the poller container git rewrites them to HTTPS
  with `GH_TOKEN` (container git config only). Never edit a repo's `.git/config`.
- No cloning in this environment — `scripts/clone-repos.sh` is not used.

## Containers

Vadym starts and stops the stacks himself. Check with `docker ps --format '{{.Names}}'`;
if a container you need is not running, report it (the verifier returns it in `containersDown`);
the orchestrator asks on the ticket. Never start it.

| Container | What it is | Code mounted at |
|---|---|---|
| `listing_syncer` | LS app — OpenSwoole HTTP server under supervisord (service `ls` in LS `docker-compose.yml`) | `/var/www` |
| `tools-app-1` | Tools app — php-fpm (service `app` in Tools `docker-compose.yml`, compose project `tools`) | `/app` |
| `tools-nginx-1` | Tools nginx in front of `tools-app-1` | `/app` (read-only) |
| `tools-workerman-1` | Tools workerman long-running workers | `/tools` |
| `tools-db-1` | Shared MySQL (Percona 8.0, service `db` in Tools `docker-compose.yml`) — used by BOTH LS and Tools | — |

Container names other than `listing_syncer` and `tools-app-1` are derived from the Tools compose
project (`tools-<service>-1`); confirm with `docker ps` before relying on them.

Do NOT use `docker compose exec` from the Tools repo: its compose file needs `UID`/`GID`/
`WORKERMAN_VHOST` set and fails to parse otherwise. Use `docker exec <container>` directly.

## Unit tests / static checks

Run from inside the container; PHP and its extensions exist only there. Paths are relative to
the repo root (which is the container's working directory).

**ListingSyncer** (`listing_syncer`, working dir `/var/www`):

```bash
docker exec listing_syncer php -d memory_limit=5G ./vendor/bin/phpunit <path>
docker exec listing_syncer ./vendor/bin/phpstan analyze <path> -c ./config/phpstan.ci.neon --memory-limit=5G
docker exec listing_syncer ./vendor/bin/ecs check <path> --config config/ecs.php
```

**Tools** (`tools-app-1`, working dir `/app`):

```bash
docker exec tools-app-1 ./vendor/bin/phpunit <path>
docker exec tools-app-1 ./vendor/bin/phpstan analyze <path> -c ./config/phpstan.ci.neon --memory-limit=5G
docker exec tools-app-1 ./vendor/bin/ecs check <path> --config config/ecs.php
```

Notes:
- Use `config/phpstan.ci.neon`, NOT `config/phpstan.neon` (Tools' plain config errors on
  disallowed-calls params).
- PHPStan scope excludes DI config files (`Resources/config/services-*.php`); analysing one
  directly returns "No files found to analyse" — that is not a failure.
- `ecs check ... --fix` is allowed for files the run changed.
- Run tests for the touched areas only, not the full suite.
- Headless runs have no TTY: do not add `-t` to `docker exec`.

## Reloading code

Without a reload, HTTP and worker checks hit the code each process booted with. Reload inside the
running container — never restart the container. The exact commands below are **starting
points; the verifier discovers and confirms them from the repo's config on the first run**
(LS: `Dockerfile.run.local`, `.docker/swoole.conf`; Tools: `docker-compose.yml`,
`Dockerfile.workerman.local`, `.docker/config/php/*.ini`) and records what worked in
`verification.md`. If no reload works for a check, that check is UNVERIFIABLE ("Could not
verify"), never PASS. Never signal PID 1 inside a container, except `-USR2` to the php-fpm
master (graceful reload).

| Process | Candidate reload |
|---|---|
| Symfony container cache (both repos) | `docker exec listing_syncer bin/console cache:clear` / `docker exec tools-app-1 bin/console cache:clear` |
| LS OpenSwoole server (`ls:server:run --api`, supervisord program `swoole`, `autorestart=true`) | `docker exec listing_syncer supervisorctl restart swoole`; fallback: kill the `ls:server:run` process so supervisord restarts it |
| Tools php-fpm (`tools-app-1`) | Per-request PHP — code changes are usually live; if opcache serves stale code, discover the reload (e.g. `kill -USR2 1` for php-fpm master) on first run |
| Tools workerman workers (`tools-workerman-1`) | Discover on first run; killing the worker process lets the container's process manager restart it. Never `docker restart`. |

## Migrations

Both repos use Doctrine migration classes (never plain `.sql` files).

| Repo | Location | Namespace | Apply one | Roll back one |
|---|---|---|---|---|
| LS | `src/Migrations/` | `DoctrineMigrations` | `docker exec listing_syncer bin/console doctrine:migrations:execute 'DoctrineMigrations\VersionX' --up -n` | same with `--down -n` |
| Tools | `migration/doctrine/` | `Migrations` | `docker exec tools-app-1 bin/console doctrine:migrations:execute 'Migrations\VersionX' --up -n` | same with `--down -n` |

- Tools also has its own wrapper (`bin/console db:migration:migrate`, used by `make db_migration`).
  Do NOT run "migrate all" in either repo — only execute the run's own migration versions.
  If the Tools `doctrine:migrations:execute` command is not available, confirm the targeted
  equivalent with `docker exec tools-app-1 bin/console list` on first run.
- LS and Tools share one MySQL (`tools-db-1`, schema `brightlocal`). **Mirrored migrations**
  (the same migration in both repos for a shared table) are executed from ONE repo only —
  running the mirror as well fails with duplicate table/column.
- Every applied migration is rolled back (`--down`) at the end of verification, and the
  rollback is itself a check (verify the schema is back to its prior state).
- New LS tables are prefixed `ls_` (index names too).

## Database

The shared DB holds Vadym's own local data. Read freely, write only what the run created.

Read-only SQL (preferred — mysql client inside the DB container):

```bash
docker exec tools-db-1 sh -c 'mysql -uroot -p"$(cat /run/secrets/db_root_password)" brightlocal -e "SELECT ..."'
```

Alternatives through the apps: LS `docker exec listing_syncer bin/console dbal:run-sql "SELECT ..."`;
Tools `docker exec tools-app-1 bin/console doctrine:dbal:sql "SELECT ..."` (its output for
`SHOW` statements is misleading — prints "0 rows affected" instead of rows; prefer the mysql client).

Rules:
- `SELECT` / `SHOW` / `DESCRIBE` only, except for rows the run itself inserted as test fixtures
  (record their ids; delete them during cleanup) and the run's own migrations (apply + roll back).
- Never `UPDATE` / `DELETE` / `TRUNCATE` / `DROP` / `ALTER` anything the run did not create.

## Base URLs

Running HTTP checks from inside the stack containers avoids depending on how the poller container
is networked; prefer that.

| Stack | From inside the stack | From the host | Source |
|---|---|---|---|
| LS API | `docker exec listing_syncer curl -s http://localhost:9501/...` | `http://localhost:9501` | LS `docker-compose.yml` (`9501:9501`), `.env` `SWOOLE_HTTP_SERVER_PORT=9501` |
| Tools web | verifier: discover from `Tools/.docker/config/nginx/tools.conf` on first run | `https://local.tools.brightlocal.cc` (port 80 redirects to HTTPS) | Tools nginx `tools.conf`, `.docker/.env` `FORWARD_HTTP(S)_PORT` |
| Tools API | verifier: discover from `Tools/.docker/config/nginx/tools.conf` on first run | `https://api.local.tools.brightlocal.cc` | Tools nginx `tools.conf` |

Whether `curl` exists in a given container, and how authentication works for a given endpoint,
is discovered on first use and written into `verification.md`.

## Dependencies

Never install dependencies (`composer install` / `composer update`, on the host or inside a
container). After checking out the ticket branch, compare each touched repo's `composer.lock`
with its installed `vendor/`. The agent's cwd is `agents/jira-to-pr` (`run-agent.sh` cds there),
so the path is relative to it:

```bash
node server/poller/lockcheck.js <repoPath>
```

Exit `0` = matches; `3` = mismatch (one `name: locked X, installed Y` line per package);
`2` = `composer.lock` or `vendor/composer/installed.json` missing. On `3` or `2`: post a marked
comment listing the output and asking Vadym to run `composer install`, then end the run with
`needs_input`.

## Forbidden

- Starting, stopping, restarting, removing or rebuilding containers: `docker start|stop|restart|rm|kill`,
  `docker compose up|down|start|stop|restart`, `make up` (it also brings up `tools-ls-1`, which
  clashes with Vadym's separate LS stack).
- `composer install` / `composer update` anywhere, including via `docker exec`.
- Wrapping any forbidden command in `docker exec ... sh -c '...'` (or any other wrapper) is
  still forbidden — the rule is about the operation, not the command prefix.
- Writes to DB rows the run did not create; "migrate all" commands.
- Touching uncommitted work in the checkouts: no `git stash`, `git reset --hard`, `git checkout -- .`,
  `git clean`.
- Merging PRs, force-pushing, deleting branches the run did not create.
