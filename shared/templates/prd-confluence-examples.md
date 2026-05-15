# PRD Reference Examples

> These are anonymized excerpts from real PRDs in this product family, used as
> few-shot examples for the prd-writer agent. They illustrate the THREE TYPES of
> PRDs and the team's voice and structural patterns.
>
> When the prd-writer agent generates a new PRD, it should match the type that
> best fits the input and follow that example's structural pattern.

---

## Type 1: Implementation PRD

**Used when:** the feature is shaped, ready to build, has design and metrics.

**Source pattern:** Connect & Sync, Aggregators Purchase Journey.

### Summary pattern (Implementation)

```markdown
| | |
|---|---|
| **The problem** | Value is unclear before connection. Users see connection controls but do not immediately understand the benefits: sync consistency, alerts, trust, and faster issue resolution. Users don't understand that enabling Active Sync requires a connected integration first. |
| **The solution** | Make dependency explicit between Connections and Active Sync. |
| **Appetite** | 1 sprint (UI/copy + analytics instrumentation). If content/design alignment is needed, this may extend to 2 sprints. |
| **Desired outcome** | Increase % of locations with ≥1 connected listing integration (North Star); Increase the conversion rate: active_sync_enabled / integration_connected (Connected → Enabled). |
```

### Problem section pattern (Implementation, multi-cause)

```markdown
1. Value is unclear before connection. Users see connection controls but do not
   immediately understand the benefits: sync consistency, alerts, trust, and
   faster issue resolution.
2. The dependency between connection and Active Sync has historically been hidden.
   Users do not naturally understand that a listing integration must be connected
   before Active Sync can be enabled.
3. The old split across separate projects and surfaces created weak momentum after
   connection. Even when a user connected an integration, the next step was easy
   to miss.
```

### Solution section pattern (Implementation, lettered)

```markdown
A) Replace separate project surfaces with one unified Connect & Sync module
- Use one container and one narrative: connect integrations, then enable Active
  Sync where available.
- Present each integration as a single row with the integration identity on the
  left and the relevant controls on the right.
- Keep Connect and Active Sync actions in the same visual line so the dependency
  is explicit instead of implied.

B) Make value visible before action
- Top-level module title: Connect & Sync.
- Support copy: "Link your business profiles to access insights, manage listings
  and enable Active Sync."
```

### Data and metrics pattern (Implementation, full)

```markdown
| Metric type | Metric | Why it matters |
|---|---|---|
| North Star | % of locations with ≥1 connected listing integration | Preserve the connections growth goal from the Connections PRD. |
| Primary feature metric | active_sync_enabled / integration_connected | Measure conversion from connection into enabled Active Sync. |
| Secondary | time_to_connect | Operational efficiency of connect flow. |
| Secondary | time_to_enable | Speed from connected to Active Sync enabled. |

### Minimum events
- connect_sync_module_viewed
- integration_connect_clicked
- integration_connected
- enable_active_sync_clicked
- active_sync_enabled
- active_sync_disabled
- active_sync_plus_cta_clicked

### Required properties
- integration
- location_id
- customer_id
- plan_context where relevant for premium gating

### Diagnostics
- Drop-off by integration: clicked to connected.
- Drop-off by integration: connected to Active Sync enabled.
- Time to connect and time to enable.
```

---

## Type 2: Strategy PRD

**Used when:** the question is about business model or approach.

**Source pattern:** Aggregators Purchase Journey (decisions about purchase model).

### Solution section pattern (Strategy, decimal-numbered)

```markdown
Core principle: Keep it simple
Do NOT over-engineer renewal consolidation.
Focus on simple purchase + strong renewal UX.

1. Purchase Model

1.1 One-time yearly purchase (per aggregator)
- Each aggregator: purchased individually; grants 12 months access
- Payment: Real money (not credits); happens in Connections interface

1.2 Bundle purchase option (key UX layer)
- Introduce "Buy multiple / bundle" at purchase time
- Options: individual / "Top 2" / "All aggregators" (discounted)
- Important: Bundle = same start date → aligned renewal date
- This is the main lever to reduce fragmentation

1.3 Capabilities model (CE dependency)
- After purchase: assign capability at Location level
- Include: aggregator_id (data_axle, neustar, locafy), start_date, expiry_date
- May be extended in future
```

### Strategy PRDs often have a "Core principle" callout at the top of the solution
that names the design constraint (e.g., "Keep it simple", "Do not break existing
revenue model"). Use this when the input clearly signals such a constraint.

---

## Type 3: Investigation/Spike PRD

**Used when:** there's uncertainty that must be resolved before committing.

**Source pattern:** DataAxle Integration Phase 1.

### Summary pattern (Investigation — Appetite empty)

```markdown
| | |
|---|---|
| **The problem** | BrightLocal currently does not support Data Axle as a listings integration + CB team creates listings manually. |
| **The solution** | Phase 1: make DA available for Locations that already pay via CB; Phase 2: Public Active Sync integration with purchase journey; Phase 3: SysAdmin implementation to simplify workflow for PH team. |
| **Appetite** | |
| **Desired outcome** | This PRD describes the investigation and initial integration work required to support Data Axle as a new listings data provider within the BrightLocal platform. |
```

### Problem section pattern (Investigation, prose)

```markdown
BrightLocal currently does not support Data Axle as a listings integration.

Before committing to a full public integration:
- We need to understand whether Data Axle's API can support the functional
  requirements expected by Active Sync.
- The CB team needs a way to integrate Data Axle into their campaign creation
  flow without waiting for a full public release.
- There is uncertainty around API capabilities, error models, and lifecycle
  behavior that introduces delivery and maintenance risk.
```

### Solution section pattern (Investigation, phased)

```markdown
Phase 1: Internal CB Integration

Implement investigation-level PoCs against Data Axle APIs:
- Create submissions
- Retrieve submission statuses

Based on PoC learnings, expose an internal API in Listing Syncer that:
- Accepts Location data from CB services
- Submits data to Data Axle
- Allows retrieval of submission processing status

This API is intended only for internal CB usage and not exposed to end users.

Phase 2: Public Active Sync Integration

A full public integration that allows Active Sync customers to use Data Axle
similarly to other listings providers.

This phase is blocked by:
- Open functional questions with Data Axle
- Unclear API limitations and behavior

No implementation commitment is made for this phase at this time.
```

### Results section pattern (Investigation, deliverables)

```markdown
At the end of this phase, we expect to have:
- Working PoCs for Data Axle submission creation and status retrieval
- Documented understanding of:
  - Submission lifecycle states
  - Error and validation behavior
  - Data returned at different processing stages
- A clear recommendation on:
  - Conditions and risks for a future public Active Sync integration
  - Workable solution for Locations that already bought DA via CB
```

---

## "NO VALID ANYMORE" pattern

When scope changes during PRD evolution, user stories are NOT deleted. They are
marked with the original story preserved and an explanation of why it changed.

```markdown
| Active Sync | As a Customer I can look up for my business data of my Location | API Search is critical blocker here (temporarily may be mocked on BE side)<br><br>**Mar 17, 2026 — User Story NO VALID ANYMORE:** we no need lookup anymore in UI because data will be submitted automatically when access is purchased. Search API we will use for mapping BL Locations with existing DA listings. |
```

This pattern preserves decision history. Apply it whenever a new context update
contradicts an existing user story.

---

## Voice samples (across all types)

### Strong opening lines

> "Aggregators are sold as one-off yearly purchases with staggered renewal dates,
> creating fragmented renewal experiences and potential user friction."

> "BrightLocal currently does not support Data Axle as a listings integration."

> "Value is unclear before connection."

These open with the problem in one direct sentence. No preamble, no
"This document outlines...".

### Strong "why it matters" entries (metrics table)

> "Preserve the connections growth goal from the Connections PRD."

> "Measure conversion from connection into enabled Active Sync."

> "Operational efficiency of connect flow."

Short, specific, points to a real reason. Avoid abstractions.

### Strong risk entries

> "North Star could be 'polluted' by non-listings integrations (GA).
> Mitigation: compute North Star using integration_type = listing."

Risk is named concretely. Mitigation is a specific technical decision, not
"we will monitor closely".
