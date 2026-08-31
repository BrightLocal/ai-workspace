# Tools (BrightLocal) — Context

> Technical sections below are derived from the actual codebase. Business/persona/metrics
> sections marked **⟨TODO⟩** need your input — they can't be read from code.
> Keep under ~500 lines; extract large subsections to sibling files if needed.

## What this product is

"Tools" is BrightLocal's core web application (`package.json` name `tools-brightlocal`,
"BrightLocal Tools") — the SaaS platform behind BrightLocal's local-SEO product suite.
It lets agencies and multi-location businesses manage business locations and their
listings/citations, sync listings to directories, monitor reputation/reviews, and track
local search rankings. It is a large PHP monolith built on a custom framework
(HaploFramework, on Symfony components), mid-migration to a **modular monolith** using
**hexagonal architecture (ports & adapters)** with **CQRS** and Deptrac-enforced boundaries.
The frontend is simultaneously migrating to a **single-spa React** micro-frontend (origin ticket TEC-1300).

## Repository

`/home/bartek/IdeaProjects/Tools` (`github.com/BrightLocal/Tools`).
Access via `products/Tools/codebase/Tools/` — use `git -C`, never `cd`.
Primary AI/dev guide is `AGENTS.md` (root `CLAUDE.md` is a one-liner pointing to it);
`README.md` is minimal and points to the GitHub wiki.

## Who uses it

### Primary persona
**⟨TODO⟩** — likely agency owners/marketers managing many SMB clients (white-label,
bulk operations), per the Local SEO domain. Confirm and make specific.

### Secondary personas
- **⟨TODO⟩**

### Who DOES NOT use it
- **⟨TODO⟩** (anti-scope — helps agents avoid drifting PRDs)

## Business model

- **Pricing axis:** ⟨TODO⟩ (per location likely, given the domain)
- **Plan tiers:** ⟨TODO⟩
- **Add-ons:** Active Sync (ListingSyncer), aggregators (DataAxle, Neustar), Citation Builder — confirm full list
- **White-label:** Yes — a `WhiteLabel` module exists
- **Billing system:** Braintree + PayPal (composer SDKs present); tax via Avalara/AvaTax + Anrok

## Key product surfaces

Mapped from `src/Modules/` (~109 modules; migration target) and `src/App/` (legacy).

- **Location Manager (LM) / Location / LocationConnections / LocationDashboard / LocationSummary** —
  business location & listing management ("All Locations").
- **Connections / Aggregators** — DataAxle, Neustar, Apple, Facebook, Foursquare
  (`SocialPlatforms`, `Directory`, `Nap`); real-time sync via **ListingSyncer** (ActiveSync).
- **Google Business Profile** — `Gbpa`, `GbpPosts`, `Gmb`, `GooglePlace`, `GoogleMaps`, `GoogleApi`.
- **Reputation (RM)** — `Rm`, `Review`, `Rcw` (review widget).
- **Rankings** — `Lsg` (Local Search Grid, geo-grid), `Lrt`/`SearchRank` (Local Rank Tracker).
- **Citations** — `Ct` (Citation Tracker), `Cb` (Citation Builder), `CitationFinder`.
- **AI/insights** — `LocalBrainInsights`, `OpenAI`, `Horizon` (reporting dashboards).
- **Billing/accounts** — `Payments`, `Braintree`, `Paypal`, `Checkout`, `Subscription`,
  `CustomerSubscription`, `Purchase`, `CustomCredits`, `Tax`, `Avalara`, `Anrok`.
- **Platform/admin** — `Auth`, `OAuth`, `Security`, `Firewall`, `Sysadmin`, `API`,
  `WhiteLabel`, `FeatureFlags`, `FeatureAllowance`, `SignUp`, `Account`, `User`.

## Current state

### What's working well
- **⟨TODO⟩**

### Current pain points
- **⟨TODO⟩**

### Major in-flight initiatives (from code + git)
- **Modular-monolith + hexagonal migration** — moving `src/App/` (legacy) into `src/Modules/`
  with CQRS and Deptrac boundaries.
- **Frontend SPA migration** — legacy jQuery/Flux/Stimulus/Foundation → single-spa React 17 (TEC-1300).
- **Aggregator connections** — active work on **Neustar** and Citation Builder
  (`epic/neustar`, LM-4164 / LM-4168 / LM-4129).

## Key metrics (for reference, not for the agent to fabricate from)

- **North Star:** ⟨TODO⟩
- **Activation:** ⟨TODO⟩
- **Retention:** ⟨TODO⟩

> If a PRD's Data section needs a metric, ask for the current baseline rather than guessing.

## Architectural overview

PHP **8.3** monolith on the custom **HaploFramework** (Symfony 6.4 components). Persistence:
Doctrine ORM ^2 + DBAL ^3 (MySQL); Redis, Memcached, Elasticsearch 7, ClickHouse, Sphinx.
Messaging: Symfony Messenger + RabbitMQ (`php-amqplib`). Frontend: React 17 + Redux Toolkit,
single-spa, TypeScript 5, Webpack 5, SCSS + Tailwind (legacy jQuery/Flux/Stimulus still present).

Backend layout (`src/`):
- `Modules/` — modular-monolith target (~109 modules). Per-module hexagonal layers:
  `Adapter/` (Http, Cli, Worker) → `Application/` (Command, Query, Service, IntegrationEvent,
  IntegrationCommand) → `Domain/` (Entity, ValueObject, Repository, Service, Event) →
  `Infrastructure/` (Repository, Persistence, External, Service).
- `App/` — legacy application modules (deprecated).
- `HaploFramework/` — custom framework. `Includes/`, `Models/` — deprecated core (to be reorganized).
- `Shared/ Components/ Contracts/ Config/ Type/`.

Key services / concepts to know:
- **ListingSyncer** — separate OpenSwoole microservice (port 9501) that syncs listings to
  GMB, Facebook, Apple, Bing, Twitter, Yelp, DataAxle, Neustar. See `products/ListingSyncer/CONTEXT.md`
  and Tools' `RELATED_SERVICES.md`. Tools-side client:
  `src/Modules/LocationManager/Services/ActiveSync/`. Run Tools without it via `make up_no_ls`.
- **Capabilities / FeatureAllowance / FeatureFlags** — gate features at location/plan level. **⟨TODO⟩** — confirm exact mechanics.
- **Deptrac** — enforces module + CQRS boundaries (`.dev-tools/deptrac/`, `deptrac-modules.yaml`, `deptrac-layers.yaml`).

Architectural docs: `AGENTS.md` (primary), `CONTRIBUTING.md`, `SPA-MIGRATION-README.md`,
`.dev-tools/deptrac/README.md`, OpenAPI specs under `docs/` (location-manager, connections,
locations-overview, lsg, sign-up-v2, showcase_reviews). External "Modular Monolith ADR" at
docs.brightlocal.dev.

## Recent decisions worth knowing

- **⟨TODO⟩** — capture decisions that constrain what's possible (dates + brief reason).

## What this product is NOT

- **⟨TODO⟩** (anti-scope)

## Glossary (product-specific)

- **LM** — Location Manager (business location & listing management)
- **LSG** — Local Search Grid (geo-grid rank tracking)
- **LRT** — Local Rank Tracker (keyword rank tracking)
- **RM** — Reputation Manager (review monitoring)
- **CT / CB** — Citation Tracker / Citation Builder
- **GBP / GMB** — Google Business Profile (formerly Google My Business)
- **NAP** — Name / Address / Phone (core listing data)
- **ActiveSync / ListingSyncer** — real-time listing sync service (port 9501)
- **HaploFramework** — BrightLocal's custom Symfony-based framework
- **Horizon** — reporting dashboards surface

## Build / test commands

Docker-based (per `Makefile` + `AGENTS.md`; PHP runs via `docker compose --env-file .docker/.env exec app php ...`):

- Setup/run: `make init`, `make build`, `make up` / `make up_no_ls`, `make down`, `make setup-worktree`
- Quality: `make phpunit` (+`-coverage`), `make phpstan` (level 8), `make phpcs`,
  `make ecs` / `ecs-fix` (`--config=./config/ecs.php`), `make deptrac`, `make incremental-ci`
- Frontend (Yarn): `make frontend_builder`, `make eslint`, `make tsc`, `make jest`, `make storybook`
- DB: `make new_migration`, `make db_migration`, `make setup_db`

> CI: `Jenkinsfile`, `build.xml`, `.github/`.
