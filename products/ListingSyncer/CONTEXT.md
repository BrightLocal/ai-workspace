# ListingSyncer — Context

ListingSyncer (LS) is a PHP microservice that synchronises business listings across
third-party platforms and aggregators. As a secondary purpose it also backs several
API integrations used by other BrightLocal Tools features (GMB insights, review
fetching, Google Analytics). It runs as an **OpenSwoole 22** HTTP server on **port 9501**
and exposes an internal-only REST API consumed by **BrightLocal Tools** (sibling repo `../Tools`).
It also ships a Symfony console app for maintenance commands and Symfony Messenger
(AMQP/RabbitMQ) workers for async processing.

## Repository

`/home/bartek/IdeaProjects/ListingSyncer` (or `github.com/BrightLocal/ListingSyncer`).
Access via `products/ListingSyncer/codebase/ListingSyncer/` — use `git -C`, never `cd`.

## Platforms & aggregators

- **Modularised (`src/Modules/`, layered):** Bing, DataAxle, Neustar. Yelp exists as a
  module folder but is currently only a `Test/` stub.
- **Legacy (still in `src/Service/` + `src/Controller/`):** Google/GMB, Apple, Facebook,
  Twitter, Yelp, Brandify.

> Migration in progress: platform integrations are moving from `src/Service/`
> into `src/Modules/<Platform>/` with a hexagonal layout. Neustar and DataAxle are
> the most actively developed areas (epic/neustar, LM-4164 / LM-4129).

## Tech stack

- **PHP** `>=8.3`
- **Symfony** `7.0.*` (framework-bundle, console, messenger, serializer, http-client,
  validator, cache, lock, rate-limiter, uid)
- **OpenSwoole 22** (`openswoole/core 22.1.5`) via `swoole-bundle/swoole-bundle`
- **Doctrine ORM ^2** + doctrine-migrations-bundle ^3; `pixelfederation/doctrine-resettable-em-bundle`
  (Swoole-aware entity-manager reset); `ramsey/uuid-doctrine`
- **Messaging:** Symfony Messenger + AMQP (RabbitMQ)
- **Cron:** `easyswoole/crontab`
- **Observability:** Sentry (`sentry/sentry-symfony`), Prometheus (`artprima/prometheus-metrics-bundle`)
- **APIs/SDKs:** `nelmio/api-doc-bundle` (OpenAPI), `google/apiclient`, `google/gmb`,
  `google/cloud-pubsub`, `facebook/graph-sdk` (BrightLocal fork), `abraham/twitteroauth`,
  `giggsey/libphonenumber-for-php`, Redis (`predis` + `ext-redis`)
- **Private packages:** `brightlocal/php-rpc`, `brightlocal/profile-finder-client-php`
- **Dev/QA:** PHPUnit ^9.5, PHPStan ^1.2 (level 8, baseline `config/phpstan-baseline.neon`),
  ECS ^11.1 (PSR-12), `dg/bypass-finals`

## Architecture

```
src/
├── Modules/          # Modular-monolith platform integrations (Bing, DataAxle, Neustar, Yelp-stub)
├── Service/          # Legacy core logic (Google, Apple, Facebook, Twitter, Yelp, Connection, Listing, Location, …)
├── Controller/       # HTTP controllers (Symfony + Nelmio API Doc), incl. Healthcheck, Uptime, External
├── Entity/           # Doctrine ORM entities (core tables)
├── Repository/       # Core Doctrine repositories
├── Migrations/       # Doctrine migrations
├── Message/          # Async message DTOs (AMQP)
├── Worker/           # Messenger consumers + handlers
├── Cron/             # easyswoole/crontab scheduled tasks
├── Command/          # Core Symfony console commands
├── Core/ Shared/ Infrastructure/ Dto/ Form/ Event/ EventListener/ Exception/
└── Kernel.php
```

Each mature `src/Modules/<Platform>/` follows a hexagonal layout:
`Domain/` (Entity, Repository interfaces, Exception) → `Application/` (Service incl.
`Service/API/` third-party clients, DTO, Handler/Message, Serializer) →
`Infrastructure/` (Repository impls, MessageConsumer, Cron) → `Adapter/` (`CLI/`, `HTTP/`, `Form/`).

Per-module third-party API clients live under `Application/Service/API/` (e.g. Bing `ApiClient`,
Neustar `AuthenticatedClient`/`ListingClient`/`TokenClient`, DataAxle `DataAxleApiClientResolver`).
Legacy platforms (GMB, Facebook, Apple, Twitter, Yelp) use vendor SDKs from `src/Service/<Platform>/`.

## Key integration points

- **Tools → LS**: Tools calls LS over HTTP at port 9501. In Tools, configure
  `config/local.ini` → `[listingSyncer] address = "http://host.docker.internal:9501"`.
  Endpoints are internal-only. Tools-side HTTP client:
  `src/Modules/LocationManager/Services/ActiveSync/` (ListingSyncer Guzzle client via
  `ListingSyncerHttpClientFactory`, `retriesCount = 2`; 4xx not retried, 5xx retried).
  Tools can be run without LS via `make up_no_ls`.
- **LS → third-party APIs**: each platform has its own API client (module `Service/API/`
  for Bing/DataAxle/Neustar, vendor SDKs for legacy platforms).

## Reference docs

- `docs/docs/01-context.md` — product intro / system landscape
- `docs/docs/02-crons.md` — cron jobs
- `docs/docs/03.messenger-consumers.md` — RabbitMQ/Messenger consumer guide
- `docs/workspace.dsl` / `docs/workspace.json` — Structurizr C4 model (render via `make doc`, :8081)
- `src/Modules/DataAxle/Resources/docs/connection-flow.md` — DataAxle connection flow
- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc` — AI/dev context and conventions
- `YELP_REFACTORING_SUMMARY.md` — Yelp module refactor notes

> ⚠️ The previously referenced `docs/third-party-error-mapping.md` does **not** exist
> in the repo. Nearest equivalent is the DataAxle `connection-flow.md` above.

## Build / test / run

All via Docker Compose (service `ls`, container `listing_syncer`):

- `make build` / `make up` / `make down` / `make restart` — build & run Swoole server (:9501)
- `make test` — PHPUnit (`Project Test Suite` → `tests/`, `Module Test Suite` → `src/Modules/*/Test/`)
- `make phpstan` — PHPStan level 8 (baseline `config/phpstan-baseline.neon`)
- `make ecs` / `make ecs-fix` — ECS PSR-12 (`--config=config/ecs.php`)
- `make cli ARGS="..."` — run `./bin/console` (e.g. `daxle:search --ids=123`)
- `make doc` — Structurizr Lite architecture docs (:8081)
- `make db_ls_data`, `make redis_clear`, `make logs`, `make bash`

> Agent contexts should use `docker compose exec -T ls php ...`. CI: `Jenkinsfile`,
> `Dockerfile.ci`, `run-checks.sh`.