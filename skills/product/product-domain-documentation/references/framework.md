# Documentation Framework

## Contents
- Design principles
- Progressive depth model
- Knowledge types
- Technical Context Map
- Product behavior model
- Document splitting rules
- AI-readiness principles

## Design principles

Use documentation as a canonical knowledge layer, not as a graveyard of delivery artifacts.

Optimize simultaneously for:

1. humans discovering and understanding a product area;
2. semantic or hybrid retrieval;
3. AI agents retrieving precise context;
4. engineers implementing or changing behavior safely;
5. product teams explaining why behavior exists.

Prefer durable concepts, rules, contracts, and decisions over sprint-shaped artifacts.

## Progressive depth model

### Level 0 — Domain / capability overview

Answers:

- What is this?
- Why does it exist?
- Who uses it?
- What is in scope?
- What adjacent product areas does it depend on or affect?

Typical content: purpose, actors, scope, capability map, terminology, major lifecycle, ownership.

### Level 1 — Concepts and behavior

Answers:

- What entities and states exist?
- What must always be true?
- What permissions, eligibility, and business constraints apply?

Typical content: glossary, entities, states, business rules, invariants, eligibility, permissions.

### Level 2 — Scenarios and workflows

Answers:

- What happens when an actor performs an action?
- What alternatives and failures exist?
- What observable outcome should users and systems see?

Prefer behavior-oriented scenarios over UI-only steps.

### Level 3 — Technical context

Answers:

- What software and external systems participate?
- What contracts connect them?
- Where does state live?
- What runtime path produces the behavior?
- What operational constraints matter?

This level replaces C4 for this framework.

### Level 4 — Decisions and history

Answers:

- Why was this behavior or design chosen?
- What alternatives were considered?
- What was superseded?
- Which decisions remain unresolved?

Use product or architecture decision records when rationale is material. Do not invent missing rationale.

## Knowledge types

Depth and knowledge type are separate dimensions. A domain may contain several of these:

| Type | Primary question |
| --- | --- |
| Overview / explanation | What is it and why does it exist? |
| Behavior specification | What must the product do? |
| Reference | What exactly are the fields, states, limits, permissions, or identifiers? |
| Workflow / how-to | How does a user or system accomplish X? |
| Decision | Why was X chosen? |
| Technical context | How is the behavior realized and connected technically? |
| Runbook | What should operators do when X fails? |

Do not force all types into one document.

## Technical Context Map

Use this instead of C4. No formal diagramming notation is required.

### Responsibilities

State the technical responsibilities owned by the domain and explicit non-responsibilities.

### Touchpoints

List concrete participating surfaces such as:

- UI areas;
- repositories/packages/modules;
- services or workers;
- scheduled jobs;
- internal platforms;
- third-party integrations.

Use actual names discovered from evidence. Do not invent service boundaries.

### Contracts

Capture stable interfaces:

- REST/GraphQL/RPC endpoints;
- events and queues;
- callbacks/webhooks;
- shared schemas;
- files/import-export formats;
- auth/permission contracts.

Link machine-readable definitions when possible instead of restating them exhaustively.

### Data and state

Describe:

- key entities and identifiers;
- system/source of truth;
- persistence boundaries;
- state transitions;
- consistency or synchronization behavior;
- ownership and lifecycle of data.

### Runtime flows

Describe important cross-system behavior as short numbered flows or simple sequence diagrams.

A good runtime flow includes trigger, validation, calls/events, state changes, external side effects, and observable result.

### Operational behavior

Record only relevant constraints:

- validation boundaries;
- idempotency;
- retries/backoff;
- eventual consistency;
- rate limits;
- timeouts;
- failure handling;
- observability/alerts;
- recovery/reconciliation.

## Product behavior model

Prefer this chain:

```text
Domain / capability
  -> concepts and states
  -> business rules / invariants
  -> scenarios / workflows
  -> technical contracts
  -> implementation
```

Do not use this as the canonical chain:

```text
Product
  -> component
  -> user story
  -> implementation details
```

User stories are useful evidence about intent and change history, but they are poor durable knowledge units.

### Rules

Rules should be atomic, durable, observable or enforceable, and implementation-independent unless the implementation is itself contractual.

Good:

`A user can activate X only when at least one eligible connection exists.`

Weak:

`Disable the blue button when the table is empty.`

The second statement may be a valid UI requirement, but it should not replace the underlying product rule.

### Scenarios

Use Given/When/Then when it improves precision, but do not force Gherkin syntax for trivial behavior.

Capture:

- happy path;
- meaningful alternatives;
- boundary conditions;
- permissions;
- recoverable and terminal failures.

Avoid duplicating every test case in product documentation.

## Document splitting rules

Split documents by semantic purpose, not arbitrary length.

Keep together information an agent would normally retrieve together. Split when one file mixes distinct capabilities, audiences, statuses, or knowledge types.

Prefer a small set of focused documents to one giant PRD.

Do not duplicate authoritative schemas or API specifications into prose. Explain semantics and link the source.

## AI-readiness principles

### Stable identity

Every canonical document should have a stable `id`. Important rules should have stable semantic IDs when practical.

### Explicit status

Distinguish `draft`, `proposed`, `current`, `deprecated`, and `historical` knowledge.

### Retrieval-friendly summaries

Use a short summary, keywords, related-document IDs, and optional natural-language questions the document answers.

### Atomicity

A retrieval chunk should not need unrelated sections to be interpretable. Use descriptive headings and repeat minimal necessary context at section boundaries.

### Explicit uncertainty

Unknown is a valid documentation state. Never convert missing evidence into plausible-sounding product behavior.
