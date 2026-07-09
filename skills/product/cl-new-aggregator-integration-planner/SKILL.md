---
name: cl-new-aggregator-integration-planner
description: >-
  Plans the FULL end-to-end integration of a NEW listing aggregator / directory syncer across
  BrightLocal Tools + ListingSyncer — the same scope we followed for DataAxle, Locafy and Neustar.
  This is a PLANNING skill only: it produces the plan and the Jira tickets and then stops — it never
  writes code, never sets up branches, and never asks whether to start implementation. Use this whenever someone wants to add, integrate,
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
Neustar/Localeze) is a **backend feature that spans two repositories** and roughly **eight work areas**.
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

This is a **planning skill only**. Its entire job is to produce the ordered plan and the Jira tickets
(each with a description, acceptance criteria, and dependency links) — then **stop**. Do **not** write
code, create branches, or open PRs, and **never ask whether to start implementing**. Implementation is a
separate effort a developer (or the `bl-engineer` skill) picks up from the tickets later. Each phase below
is written as the *content of a ticket* (scope + how it will be verified), not as steps for you to execute
now. Several phases carry dependencies you must resolve while planning (missing answers, API doc, sync-vs-async).

### Step 0 — Gate on inputs and scope

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

Also settle the **branch base** and **record it in the plan** for the implementer to use later (do NOT
create branches). Per `shared/engineering/git-conventions.md` (ADR-0019) the work will use `task/<TICKET>`
branches with matching names across both repos (see `RELATED_SERVICES.md`); confirm the base with the user
— a new aggregator usually branches off the integration epic, not `master`, because it builds on shared
plumbing that may not be merged yet (this exact mismatch has bitten us). This is captured as guidance in
the tickets, not acted on here.

### Step 1 — Present the phased plan

Lay out the eight phases (below) as an ordered plan: for each, what to build, the reference to copy from
(`references/reference-map.md`), the inputs it depends on, and how it's verified. Mark which phases are
blocked on the API doc or on the sync-vs-async answer. Also write the plan to a file (e.g.
`docs/<TICKET>/plan.md` in Tools) so it can be attached to the parent Jira ticket. Get the plan approved.

### Step 2 — Create the Jira tickets (one per phase)

Once the plan is approved, create the tracking tickets via the Atlassian MCP (`createJiraIssue`; use
`createIssueLink` to link them). Confirm these first, don't assume:

- **Project** — default **`LM`** (Connected Locations); ask if different.
- **Parent** — create a parent **Task/Story** "Integrate <X> aggregator" summarizing the effort (paste the
  plan / attach `plan.md`), or link under an existing epic if the user names one.
w- **Issue type & labels** — child tickets as `Task` (or sub-tasks of the parent if the project uses them);
  label each `BackEnd` or `FrontEnd` per its workflow; carry over `GOAL*` labels if the user gives one.

Create **at least one child ticket per phase (1–8)**, and **split frontend from backend into separate
tickets** wherever a phase has non-trivial frontend work — the team tracks FE and BE separately. Concretely:
- **Phase 3** → a `BackEnd` ticket (FF + availability query) **and** a `FrontEnd` ticket (the Connections-
  section tile on the LM edit page).
- **Phase 4** → a `BackEnd` ticket (connection trigger + AS enable) **and** a `FrontEnd` ticket (tile shows
  the connected state).
- **Phase 8** → a `BackEnd` ticket (failed-requests/resubmit endpoints + providers) **and** a `FrontEnd`
  ticket (the Sysadmin dashboard UI).
- Phases 1, 2, 5, 6, 7 are backend-only unless the user flags a UI need.
Make each `FrontEnd` ticket `blockedBy` its `BackEnd` counterpart (the UI needs the data/flag/endpoint first).

Every ticket MUST have two clearly separated sections:

- **Description** — the phase's scope, which repo(s) it touches, and the exact reference files to copy from
  (`references/reference-map.md`).
- **Acceptance criteria** — a checklist (`* [ ] …`) of objectively verifiable outcomes, taken from that
  phase's "Verify:" line. These are how QA/reviewers sign the ticket off.

**Encode the dependency order so it's obvious what goes first, second, …** — set `blockedBy` / "depends on"
links (via `createIssueLink`) between the child tickets. The default chain is linear (Phase N+1 blocked by
Phase N), with these specific rules:

- **Phase 1** is blocked until the **API doc** is provided (note it on the ticket).
- **Phase 3** (FF + availability) and **Phase 4** (connection trigger + AS) block **Phase 5** (Save&Sync).
- **Phase 6** (mark Submitted) depends on **Phase 1** (connection-created event/endpoint) and **Phase 4**.
- **Phase 7** depends on the **sync-vs-async** answer and on **Phase 6**.
- **Phase 8** (failed-submissions dashboard) depends on **Phase 1** (needs the LS failed-requests + resubmit
  endpoints) and the request-status tracking; it can otherwise proceed in parallel with 5–7.

Also state the ordering in plain words in the parent ticket (a numbered list) so the sequence is legible
without reading the link graph. Report all created ticket keys/URLs (parent + every child, BE and FE) to
the user.
Prefer the `plan-ticket` skill if the user would rather review each ticket in plan mode before it's
created; otherwise create them directly here.

**Stop after the tickets are created and reported.** This skill's job ends here — do not start any phase,
do not create branches or PRs, and do not ask the user whether to begin implementing. Each ticket already
carries the guidance a developer (or the `bl-engineer` skill) needs to pick it up later; the phase → ticket
→ PR cadence is theirs to run, not this skill's.

---

## The eight phases (ticket content — for planning, not for executing now)

### Phase 1 — ListingSyncer: API client + inbound endpoint  *(needs: name + API doc + sync mode)*
**First, map the API doc's endpoints to their roles.** Before designing the client, work out from the
documentation which endpoint does what — at minimum: (a) **submission** (create/update a listing in the
external source), (b) **reading the current listing data** already held by the aggregator, and (c)
**retrieving backlinks / the live directory URLs** after processing. **If the doc is ambiguous and you
cannot confidently decide which endpoint serves which role, ASK the user** — don't guess. Record the
chosen endpoint-to-role mapping in the Phase 1 ticket, since Phases 5 (submission), and 6–7 (status +
backlinks) all depend on it, and the sync-vs-async shape follows from whether backlinks come back on the
submission response or only from a separate poll/callback.
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
into `GetSupportedIntegrationsQueryHandler`. **Frontend (separate FrontEnd ticket):** surface the new
integration in the **Aggregators section** of the Location Manager edit page (the "Connect & Sync" area) —
the same place DataAxle and Neustar appear, **not** the Connections/social tiles. Add it to
`AggregatorsSection.tsx` (the `AGGREGATORS` list + an `is<X>Enabled` prop) and pass the enabled flag from
the backend availability/FF. Verify: unit tests for FF-off / wrong-country / wrong-owner / happy path (BE);
the aggregator appears in the LM edit-page **Aggregators** section only for allowed countries with the flag
on (FE).

### Phase 4 — Tools: connection trigger + Active Sync enable  *(needs: CB trigger set)*
Add a `Cb\Application\Listeners\XConnectionRequestListener` subscribed to `CampaignStatusUpdated` →
`onCampaignInProgress` that, when the campaign carries one of the agreed publishers/networks/aggregators
(and it's purchased / not "unavailable"), checks `IsXIntegrationAvailableQuery` and dispatches the Locafy/
Neustar-style `ConnectLocationCommand`. The connect handler dispatches `Events::ON_LOCATION_X_CONNECTED`.
Add an `XActiveSyncListener` on that event → `ToggleActiveSyncForConnectionCommand(..., Integration::X, true)`,
and add `Integration::X` to `ToggleActiveSyncForConnectionHandler::hasConnection()` + the `ActiveSync`
settings DTO. Add LS `active_sync_settings` `x_*` columns — **migration in Tools + identical copy in LS**
per `RELATED_SERVICES.md` (`active_sync_settings` is LS-owned). Register listeners in both services loaders.
Cross-module command dispatch must go through the `IntegrationCommand` layer (Deptrac). **Frontend
(separate FrontEnd ticket):** once establishment works, the aggregator must be **visible as connected in
the Aggregators section** of the LM edit page — the `AggregatorsSection.tsx` entry added in Phase 3 must
reflect the established/connected state (status/chip), like DataAxle and Neustar, not just availability.
Verify: campaign → In Progress establishes the connection, flips `x_active_sync_enabled = 1` for eligible
customers (BE), and the LM edit-page **Aggregators** section shows the integration as connected (FE).

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

### Phase 8 — Failed-submissions admin dashboard (Tools Sysadmin)  *(needs: Phase 1 endpoints)*
Add a Sysadmin dashboard so support can **review failed submissions for the new integration and resubmit
them**, modelled on the Neustar listings dashboard. Tools: `src/App/Sysadmin/<X>/ListingsDashboard/` with a
list action (fetch failed requests via the Tools `ApiClient` → LS) and a resubmit action, plus its
assets/template. LS: expose (or reuse) the request endpoints the dashboard drives — list failed requests,
fetch one, and resubmit — backed by a `FailedRequestsProvider` and a `RequestResubmitter`; async
integrations key off the `Request` status/error captured in Phase 1/7. Depends on Phase 1 (the LS
failed-requests + resubmit endpoints and request tracking must exist); otherwise independent of 5–7.
Verify: a deliberately-failed submission appears in the dashboard with its error, and "Resubmit" re-queues
it and moves it out of the failed list on success.

---

## Conventions to enforce (every phase)

- **Branches**: ADR-0019 (`task/<TICKET>` etc.), matching names across both repos, no `agent/` prefix.
  Commits = Conventional Commits, **no AI co-author footer** (`shared/engineering/git-conventions.md`).
- **Migrations**: authoritative in Tools `migration/doctrine/` (`namespace Migrations`), and for any
  **LS-owned table** (e.g. `active_sync_settings`, `x_*`) add an **identical** copy in LS `src/Migrations/`
  (`namespace DoctrineMigrations`). See `RELATED_SERVICES.md`.
- **Cross-module writes**: dispatch via `Application/IntegrationCommand/` (Deptrac blocks another module's
  private `Application/Command/*`). Keep new DTOs local to the consuming module.
- **QA before each commit** — **Tools BE**: `make phpstan` (L8), `make phpunit`, `make ecs`, `make deptrac`,
  `make di-check` (fix everything, incl. DI). **LS**: `make phpstan`, `make phpunit`, `make ecs`.
  **Tools FE** (Connections tile, dashboard UI): `make eslint`, `make tsc`, `make jest`.
- **LS tests** live under `src/Modules/*/Test/` and are phpstan-analysed; LS runs **PHPUnit 9** → use a
  `/** @covers … */` docblock (not `#[CoversClass]`) and **Prophecy** for final classes (not `createMock`).
- Run the app / CLI to verify behaviour end-to-end, not just tests (esp. the sync round-trip).

## Reference map

`references/reference-map.md` lists the exact files to copy from per phase, per reference integration
(Neustar / Locafy / DataAxle) and which branch each lives on. Read it while planning a phase / writing its
ticket so the ticket description points at the exact files the implementer will copy from.
