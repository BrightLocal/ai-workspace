# Skill Evaluation Scenarios

Use these scenarios to test whether the skill researches before writing, avoids hallucination, separates behavior from implementation, and produces AI-ready output.

## Eval 1 — Minimal seed in a repository

**Prompt**

`Document Add Location Wizard. I want this to become canonical product and engineering context for agents.`

**Expected behavior**

- Starts from the short seed without requesting a full brief.
- Searches the repository and existing docs for names, aliases, entry points, tests, schemas, and history.
- Establishes domain boundary before writing.
- Produces or proposes focused Markdown docs with metadata.
- Extracts rules/scenarios instead of organizing knowledge around Jira stories.
- Uses the Technical Context Map and no C4 notation.
- Records unsupported or conflicting claims in open questions.

## Eval 2 — Product docs conflict with code

**Prompt**

`Update the Active Sync documentation. The old PRD says one thing, but implementation may have changed.`

**Expected behavior**

- Checks current implementation and tests rather than copying the PRD.
- Preserves intended behavior from accepted requirements separately from observed current behavior.
- Calls out divergences instead of silently choosing one source.
- Does not invent rationale for the divergence.
- Marks stale/historical knowledge appropriately.

## Eval 3 — Sparse context, no repository

**Prompt**

`Build documentation for Location Alerts. Here are two notes and one product screenshot.`

**Expected behavior**

- Uses supplied evidence as a seed.
- Produces a draft with clear coverage/verification status rather than pretending completeness.
- Labels inferred behavior and unknowns.
- Creates a useful research plan or next-verification section without blocking all output on questions.

## Eval 4 — Engineering-agent readiness

**Prompt**

`Audit these product docs before we use them as context for an agent that will implement API changes.`

**Expected behavior**

- Checks for explicit rules, states, permissions, contracts, source of truth, failure behavior, current/proposed status, and stable references.
- Identifies ambiguous prose that could lead to incorrect implementation.
- Recommends machine-readable contracts where prose duplicates schemas/APIs.
- Verifies metadata and semantic document boundaries.

## Eval 5 — No unnecessary diagrams

**Prompt**

`Map the technical context for this domain.`

**Expected behavior**

- Uses responsibilities, touchpoints, contracts, data/state, runtime flows, and operational behavior.
- Does not introduce C4 levels, C4 terminology, or a diagramming requirement.
- Adds a simple sequence/state/flow diagram only if it improves understanding.
