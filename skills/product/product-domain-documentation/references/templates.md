# Documentation Templates

## Contents
- Metadata schema
- Package structure
- Overview template
- Concepts and rules template
- Workflows template
- Technical context template
- Decisions template
- Open questions template
- Small-domain variant

## Metadata schema

Use YAML frontmatter for canonical Markdown docs. Keep it compact and machine-friendly.

```yaml
---
id: active-sync.overview
title: Active Sync
type: domain-overview
status: current
domain: active-sync
summary: Synchronizes canonical location data with supported external listings and surfaces material differences.
keywords:
  - synchronization
  - listings
  - connections
owners:
  - connected-locations
last_verified: 2026-09-25
related:
  - active-sync.rules
  - active-sync.workflows
  - active-sync.technical-context
questions:
  - What is Active Sync?
  - What is in scope for Active Sync?
---
```

Adapt values to the investigated domain. Do not copy the example facts unless verified.

Required when known:

- `id`: stable semantic identifier;
- `title`;
- `type`;
- `status`: `draft`, `proposed`, `current`, `deprecated`, or `historical`;
- `domain`;
- `summary`.

Recommended:

- `keywords`;
- `owners`;
- `last_verified`;
- `related`;
- `questions` — natural-language questions this document directly answers.

Do not fabricate owners or verification dates. If the document is generated from incomplete evidence, use `status: draft` and explain coverage in the body.

## Package structure

Default substantial-domain package:

```text
<domain-slug>/
  overview.md
  concepts-and-rules.md
  workflows.md
  technical-context.md
  decisions.md
  open-questions.md
```

Optional files when justified:

```text
  api-reference.md
  permissions.md
  state-model.md
  runbook.md
  migrations.md
  <sub-capability>/...
```

Follow an existing repository documentation convention when one exists.

## Overview template

```markdown
---
[id/type/status metadata]
---

# [Domain / capability]

## Summary
[2–4 sentences: what it is, who it serves, why it exists.]

## Scope
### In scope
[Responsibilities and product surface owned here.]

### Out of scope
[Important adjacent responsibilities owned elsewhere.]

## Actors
[Users, roles, internal systems, external actors.]

## Capability map
[Main sub-capabilities and relationships. Keep this conceptual, not org-chart driven.]

## Entry points
[Where users/systems enter this domain.]

## Lifecycle
[High-level lifecycle if meaningful.]

## Adjacent domains and dependencies
[Product-level relationships.]

## Sources
[Stable references for important claims.]
```

## Concepts and rules template

```markdown
---
[id/type/status metadata]
---

# [Domain] concepts and rules

## Core concepts
### [Concept]
Definition: ...
Identity / ownership: ...
Important relationships: ...

## States
[State definitions and allowed transitions. Use a small table or state diagram if useful.]

## Business rules

### `[domain].rule.[semantic-name]`
**Rule:** [One atomic statement that must be true.]

**Applies when:** [Scope/eligibility/segment if relevant.]

**Observable consequence:** [What users/systems can observe.]

**Evidence:** [Source reference when available.]

## Permissions and eligibility
[Role, plan, entitlement, integration, or lifecycle constraints.]

## Limits and invariants
[Durable constraints. Separate vendor limits from internal product choices.]
```

## Workflows template

```markdown
---
[id/type/status metadata]
---

# [Domain] workflows

## [Workflow name]

**Goal:** ...

**Preconditions:** ...

**Trigger:** ...

**Main flow:**
1. ...
2. ...
3. ...

**Result:** ...

**Alternatives / edge cases:**
- ...

**Failures / recovery:**
- ...

**Rules involved:** [semantic rule IDs]

**Technical flow:** [link to technical-context section if useful]
```

Given/When/Then may replace the numbered flow for behavior-heavy scenarios.

## Technical context template

```markdown
---
[id/type/status metadata]
---

# [Domain] technical context

## Responsibilities
[Technical responsibilities and non-responsibilities.]

## Touchpoints
| Touchpoint | Type | Responsibility | Source |
| --- | --- | --- | --- |
| ... | UI / module / service / worker / vendor | ... | ... |

## Contracts
| Contract | Direction | Purpose | Authoritative definition |
| --- | --- | --- | --- |
| ... | inbound/outbound/internal | ... | OpenAPI/schema/path |

## Data and state
[Entities, identifiers, persistence, sources of truth, consistency.]

## Runtime flows
### [Flow]
1. Trigger ...
2. Validate ...
3. Call/publish ...
4. Persist ...
5. Observe outcome ...

[Optional simple Mermaid sequence/flow diagram. Never C4.]

## Operational behavior
### Validation
...
### Idempotency / concurrency
...
### Retries / reconciliation
...
### External limits
...
### Failure handling
...
### Observability
...

## Known divergences
[Current implementation vs intended product behavior, if any.]
```

## Decisions template

```markdown
---
[id/type/status metadata]
---

# [Domain] decisions

## [Decision title]
**Status:** accepted / superseded / proposed / unknown

**Context:** ...

**Decision:** ...

**Rationale:** ...

**Consequences:** ...

**Alternatives considered:** ...

**Supersedes / superseded by:** ...

**Evidence:** ...
```

If rationale or alternatives are not supported, say `Unknown` rather than reconstructing them.

## Open questions template

```markdown
---
[id/type/status metadata]
---

# [Domain] open questions

## Research coverage
[What sources were available and important blind spots.]

## Unresolved product questions
- **Question:** ...
  - Why it matters: ...
  - Evidence checked: ...
  - Best current understanding: verified / inferred / unknown

## Documentation conflicts
- Source A says ...
- Source B says ...
- Scope/date/status analysis: ...
- Resolution needed: ...

## Missing technical evidence
- ...

## Suggested next verification
- ...
```

## Small-domain variant

For a small capability, use a single document with these sections:

```text
Summary
Scope
Actors and concepts
Rules and states
Workflows and failures
Technical context
Decisions
Unknowns
Sources
```

Still apply metadata, evidence, status, and current/intended/historical separation.
