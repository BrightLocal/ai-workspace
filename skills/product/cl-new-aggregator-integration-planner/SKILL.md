---
name: cl-new-aggregator-integration-planner
description: >-
  Plans (and can drive, phase by phase) the FULL end-to-end integration of a NEW listing
  aggregator / directory syncer across BrightLocal Tools + ListingSyncer — the same scope we
  followed for DataAxle, Locafy and Neustar. Use this whenever someone wants to add, integrate,
  onboard, wire up, or "do the full scope for" a new aggregator, publisher network, listing
  partner or sync provider (e.g. "integrate Hotfrog / Yext / Foursquare", "add a new syncer",
  "what's needed to connect <provider>", "plan the <X> aggregator work"). Also triggers on partial
  states ("we started <X>, finish it") — it maps what exists vs what's missing. It gates on two
  inputs up front (integration name + API documentation), produces an ordered, per-phase plan with
  exact reference files to copy from, the right clarifying questions, and the branch / migration / QA
  conventions baked in — and then **creates the Jira tickets** (a parent plus one per phase) so the
  work is tracked. Prefer this over ad-hoc planning for any multi-repo aggregator work.
---

# New Aggregator Integration Planner (Connected Locations)

## What this is

Adding a new listing aggregator (a partner Tools syncs business data to — like DataAxle, Locafy/Hotfrog,
Neustar/Localeze) is a **backend feature that spans two repositories** and roughly **seven work areas**.
Done ad hoc it's easy to miss a piece (a feature flag, an Active Sync column, the "mark Submitted" step,
the async backlink update). This skill encodes the full scope, the order, the exact code to model each
part on, and the questions to ask — so the plan is complete and each phase is verifiable before moving on.

The reference integrations live on branches (fetch them; they are not all on `master`):

- **Neustar** — `epic/neustar` — the most complete reference (covers all 7 areas incl. async backlinks).
- **Locafy (Hotfrog)** — `epic/locafy` (+ `task/LM-4162`, `task/LM-4173`) — AUS-only, simpler sync.
- **DataAxle** — `master` — the additional-data flow is already wired here.

Repos (never `cd`; use `git -C`): Tools = `products/Tools/codebase/Tools`, ListingSyncer (LS) =
`products/ListingSyncer/codebase/ListingSyncer`. Read `references/reference-map.md` for the exact
file paths per phase — keep it open while planning.

## How to work

This is a **planner first**. Produce the ordered plan below, then implement phase by phase with a human
gate between phases (each phase has its own PR-sized diff and verification). Don't implement blindly —
several phases depend on answers you must collect first, and on whether the API is synchronous or async.

### Step 0 — Gate on inputs and scope (do this before any code)

Ask the user and do not start the API-client phase until you have (a) and (b):

1. **(a) Integration name** — the canonical token used everywhere (e.g. `locafy`, `neustar`). Note any
   brand vs token split (Locafy↔Hotfrog, Neustar↔Localeze). This becomes `Integration::X`,
   `Connection::X`, `lm.x.enabled`, module `Modules/X`, columns `x_*`, `shouldSendToX`.
2. **(b) API documentation** — a file or URL for the aggregator's API. The API client (Phase 1) cannot be
   designed without it. If it's missing, stop and ask; do not guess the wire format.
3. **Sync mode** — is submission **synchronous** (response returns the result/links immediately) or
   **asynchronous** (submit → later poll/callback for status + backlinks)? This decides Phases 1 & 7.
4. **CB trigger set** — which Citation Builder **publishers / networks / aggregators**
   (`Modules\Cb\Domain\Publisher\Entity\PublisherMetadata`) should cause a connection to be established
   when a CB campaign carrying them moves to "In Progress"? (Neustar groups `AGGREGATOR_NEUSTAR` +
   `NETWORK_YP` + `NETWORK_GPS`.) Also confirm which of those must flip to **Submitted** (Phase 6).
5. **Allowed countries** — which countries may this connection be offered in? (Locafy = AUS only;
   Neustar/DataAxle = USA + CAN.) Drives Phase 3.

Then set up branches per `shared/engineering/git-conventions.md` (ADR-0019): create `task/<TICKET>` in
**both** repos off the relevant epic base, matching branch names across repos (see `RELATED_SERVICES.md`).
Confirm the base with the user (a new aggregator usually branches off the integration epic, not `master`,
because it builds on shared plumbing that may not be merged yet — this exact mismatch has bitten us).

### Step 1 — Present the phased plan

Lay out the seven phases (below) as an ordered plan: for each, what to build, the reference to copy from
(`references/reference-map.md`), the inputs it depends on, and how it's verified. Mark which phases are
blocked on the API doc or on the sync-vs-async answer. Also write the plan to a file (e.g.
`docs/<TICKET>/plan.md` in Tools) so it can be attached to the parent Jira ticket. Get the plan approved.

### Step 2 — Create the Jira tickets (one per phase)

Once the plan is approved, create the tracking tickets via the Atlassian MCP (`createJiraIssue`; use
`createIssueLink` to link them). Confirm these first, don't assume:

- **Project** — default **`LM`** (Connected Locations); ask if different.
- **Parent** — create a parent **Task/Story** "Integrate <X> aggregator" summarizing the effort (paste the
  plan / attach `plan.md`), or link under an existing epic if the user names one.
- **Issue type & labels** — child tickets as `Task` (or sub-tasks of the parent if the project uses them),
  labelled `BackEnd`; carry over `GOAL*` labels if the user gives one.

Create **one child ticket per phase (1–7)**. Each ticket's description = that phase's scope + the exact
reference files (from `references/reference-map.md`) + its verification/acceptance criteria + which repo(s)
it touches. Encode ordering: set `blockedBy` / "depends on" links so Phase N+1 is blocked by Phase N, and
flag the two hard dependencies explicitly — **Phase 1 is blocked until the API doc is provided**, and
**Phase 7's shape depends on the sync-vs-async answer**. Report the created ticket keys/URLs (parent +
seven) back to the user. Prefer the `plan-ticket` skill if the user would rather review each ticket in
plan mode before it's created; otherwise create them directly here.

Then implement **one phase per ticket**, each on its own `task/<PHASE-TICKET>` branch(es) with its own PR(s)
and QA — matching the phase → ticket → PR cadence.

---

## The seven phases

### Phase 1 — ListingSyncer: API client + inbound endpoint  *(needs: name + API doc + sync mode)*
Create `src/Modules/<X>/` in LS mirroring the Neustar module (Domain / Application / Infrastructure /
Adapter). Core pieces: the API client under `Application/Service/API/` (auth + listing + token clients as
the doc requires), request/response DTOs, field mappers, a `ListingService`/`ListingCreator`/`ListingUpdater`
+ `SubmissionHandler`, a `Request` domain entity + repository, and Doctrine migrations for the module's
tables. Expose an HTTP `ListingController` (`POST/PUT/GET /x/listing/{locationUUID}` + a status endpoint)
that Tools calls. **Async APIs** additionally need a submission-status checker + cron and a status/backlink
representation. Tools side: a thin `ApiClient` (`Modules/Location/Application/Service/Integration/X/`) over
the shared `listingSyncerHttpClient`.
Verify: LS testing CLI (Phase 2) can push a listing and you can inspect the real API response.

### Phase 2 — Testing CLI commands (both repos)
LS: `Adapter/CLI/` push / update / check-status commands (model on the Locafy/Neustar CLI commands) so you
can exercise the client and read raw responses. Tools: a console command to drive a sync for a location.
These are how you learn the real response structure and confirm sync-vs-async behaviour before wiring the
product flows. Verify: run against a test location/account; capture response shapes for later phases.

### Phase 3 — Tools: feature flag + availability query  *(needs: allowed countries)*
Add `Config\Feature::LM_X_ENABLED = 'lm.x.enabled'` + a Doctrine migration seeding the `feature_flags` row
(ships **off**). Add `IsXIntegrationAvailableQuery` + handler (gate = FF enabled **and** location owned by
customer **and** country ∈ allowed) mirroring `IsNeustarIntegrationAvailableQueryHandler`. Add
`Connection::ALLOWED_X_COUNTRIES` + `GetXConnectionAllowedCountriesQuery`/handler, and gate the aggregator
into `GetSupportedIntegrationsQueryHandler`. Verify: unit tests for FF-off / wrong-country / wrong-owner /
happy path; the aggregator shows on LM only for allowed countries with the flag on.

### Phase 4 — Tools: connection trigger + Active Sync enable  *(needs: CB trigger set)*
Add a `Cb\Application\Listeners\XConnectionRequestListener` subscribed to `CampaignStatusUpdated` →
`onCampaignInProgress` that, when the campaign carries one of the agreed publishers/networks/aggregators
(and it's purchased / not "unavailable"), checks `IsXIntegrationAvailableQuery` and dispatches the Locafy/
Neustar-style `ConnectLocationCommand`. The connect handler dispatches `Events::ON_LOCATION_X_CONNECTED`.
Add an `XActiveSyncListener` on that event → `ToggleActiveSyncForConnectionCommand(..., Integration::X, true)`,
and add `Integration::X` to `ToggleActiveSyncForConnectionHandler::hasConnection()` + the `ActiveSync`
settings DTO. Add LS `active_sync_settings` `x_*` columns — **migration in Tools + identical copy in LS**
per `RELATED_SERVICES.md` (`active_sync_settings` is LS-owned). Register listeners in both services loaders.
Cross-module command dispatch must go through the `IntegrationCommand` layer (Deptrac). Verify: campaign →
In Progress establishes the connection and flips `x_active_sync_enabled = 1` for eligible customers.

### Phase 5 — Tools + LS: sync on "Save & Sync"  *(depends on Phase 3 + 4)*
Tools: in `DataTransformer` set `metadata.shouldSendToX` from `IsXIntegrationAvailableQuery`, and add an
`x` section to the outbound additional-data payload via an `XTransformer` — using **LocationManager-local
DTOs** (not the Location module's) to keep module boundaries clean. LS: add `shouldSendToX` to the incoming
`Metadata` DTO + `MetadataType`, an `x` sub-form/field on the `Update` form + `AdditionalData` DTO, a
`Modules/X/Application/Service/AdditionalData/Updater`, and a **feature-flag-gated** dispatch block in
`UpdateDispatcher` (`if shouldSendToX` → sync, else log skip; bump the WaitGroup). The updater must sync
**only when the connection is established and Active Sync is enabled for X**. Verify: FF on + AUS/allowed +
connected + AS on → LS syncs on save; FF off → LS logs skip.

### Phase 6 — Mark CB publishers/aggregators "Submitted" on connection creation
When a **new** connection object is created, LS dispatches an `XConnectionCreated` AMQP message → a Tools
`LiteWorker` consumes it → `MarkPublisher…SubmittedCommand` flips the campaign's relevant publisher/
aggregator directory rows `To Do → Submitted` (+ `date_submitted`), never downgrading `Live`. **Include the
aggregator's own directory**, not just its networks (this was a real bug on LM-4202). Fires only on
connection creation, not every upsert. Verify: new connection → YP/GPS/aggregator rows become Submitted;
repeat upserts change nothing.

### Phase 7 — Directory backlinks after processing  *(sync mode dependent)*
**Async**: the aggregator later returns the directories/URLs where the listing went live — via the
status-check flow (cron/poll) or a callback. Map those to the CB campaign publisher directories and upgrade
`Submitted → Live` with the URL (Neustar's live/backlink flow). GPS-style networks that never return a
backlink correctly stay `Submitted`. **Sync**: links may be available in the submit response — update the
directories directly. Verify: after processing, the campaign directories show Live with correct URLs;
non-returning networks remain Submitted.

---

## Conventions to enforce (every phase)

- **Branches**: ADR-0019 (`task/<TICKET>` etc.), matching names across both repos, no `agent/` prefix.
  Commits = Conventional Commits, **no AI co-author footer** (`shared/engineering/git-conventions.md`).
- **Migrations**: authoritative in Tools `migration/doctrine/` (`namespace Migrations`), and for any
  **LS-owned table** (e.g. `active_sync_settings`, `x_*`) add an **identical** copy in LS `src/Migrations/`
  (`namespace DoctrineMigrations`). See `RELATED_SERVICES.md`.
- **Cross-module writes**: dispatch via `Application/IntegrationCommand/` (Deptrac blocks another module's
  private `Application/Command/*`). Keep new DTOs local to the consuming module.
- **QA before each commit** — **Tools**: `make phpstan` (L8), `make phpunit`, `make ecs`, `make deptrac`,
  `make di-check` (fix everything, incl. DI). **LS**: `make phpstan`, `make phpunit`, `make ecs`.
- **LS tests** live under `src/Modules/*/Test/` and are phpstan-analysed; LS runs **PHPUnit 9** → use a
  `/** @covers … */` docblock (not `#[CoversClass]`) and **Prophecy** for final classes (not `createMock`).
- Run the app / CLI to verify behaviour end-to-end, not just tests (esp. the sync round-trip).

## Reference map

`references/reference-map.md` lists the exact files to copy from per phase, per reference integration
(Neustar / Locafy / DataAxle) and which branch each lives on. Read it before planning or implementing a phase.
