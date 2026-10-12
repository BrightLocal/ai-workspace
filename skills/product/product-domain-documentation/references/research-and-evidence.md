# Research and Evidence Rules

## Contents
- Evidence model
- Source priority
- Current versus intended behavior
- Conflict handling
- Inference rules
- Research procedure
- Citation and traceability guidance

## Evidence model

Classify discovered evidence by what it can establish:

- **Current behavior evidence**: code, executable tests, runtime configuration, current schemas, observed product behavior, current API definitions.
- **Intent evidence**: accepted/current requirements, approved designs, decision records, product documentation, explicitly confirmed stakeholder statements.
- **Historical evidence**: old PRDs, closed tickets, migrations, deprecated docs, changelogs, previous implementations.
- **Context evidence**: discussions, support cases, interview notes, analytics, incident threads. Useful for rationale and discovery but not automatically canonical behavior.

One artifact may provide more than one type of evidence.

## Source priority

Do not use a universal ranking blindly. Rank sources according to the claim being established.

For **what the system currently does**, prefer executable/current technical evidence and direct observation.

For **what the system is intended to do**, prefer accepted current product/design decisions and canonical specifications.

For **why a decision was made**, prefer decision records and contemporaneous rationale; do not infer motive from code.

For **external platform constraints**, prefer current official vendor documentation.

Freshness, explicit status, and scope can outweigh source type.

## Current versus intended behavior

Never collapse these dimensions:

```text
actual/current behavior
intended/accepted behavior
```

Possible states:

- aligned;
- implementation lagging intent;
- documentation lagging implementation;
- intentionally divergent for a segment/platform/version;
- conflict unresolved.

When evidence differs, record the discrepancy in `open-questions.md` or a dedicated divergence section.

## Conflict handling

When two credible sources disagree:

1. Check dates, versions, status, environment, customer segment, plan, platform, and feature flags.
2. Determine whether they describe different scopes rather than a true conflict.
3. Search for later decisions or implementation changes.
4. If still unresolved, preserve both claims with their evidence and label the conflict.
5. Do not choose the more convenient interpretation.

## Inference rules

Use three internal confidence classes:

- **Verified** — directly supported by reliable evidence.
- **Inferred** — strongly suggested by multiple facts but not explicitly established.
- **Unknown** — evidence is insufficient or conflicting.

Canonical docs should primarily contain verified knowledge.

An inference may appear only when it is useful and clearly labeled, for example:

> Inference: this worker appears to be the reconciliation path because it is the only consumer of event X found in the repository. Needs confirmation.

Never turn an inference into an unqualified rule, decision rationale, SLA, permission, or external platform requirement.

## Research procedure

### Pass 1 — Vocabulary and navigation

Search the seed term, synonyms, UI labels, API names, database identifiers, and likely historical names.

Create a working glossary and list of relevant files/artifacts.

### Pass 2 — Product behavior

Find current docs, requirements, tests, UI flows, support material, and state/permission logic.

Extract actors, goals, states, rules, workflows, errors, and edge cases.

### Pass 3 — Technical context

Trace entry points into code and follow important paths through contracts, persistence, asynchronous work, and integrations.

Do not inspect every file. Focus on the paths needed to explain product behavior and implementation boundaries.

### Pass 4 — History and rationale

Use version history, tickets, decision records, commits, or discussions to explain material decisions and superseded behavior.

### Pass 5 — Gap search

Actively search for contradictions and missing cases:

- role/permission variants;
- plan/entitlement variants;
- empty and partial states;
- retries/failures;
- feature flags;
- legacy paths;
- external constraints;
- migration behavior.

## Citation and traceability guidance

When stable source references are available, record them close to the claim they support or in a compact `Sources` section.

Useful references include:

- repository path plus symbol;
- test path plus test/scenario name;
- OpenAPI/schema path;
- issue or PR ID;
- decision record ID;
- internal document link;
- official external documentation URL;
- commit/hash when historical precision matters.

Avoid noisy citations for obvious connective prose. Prioritize traceability for rules, contracts, decisions, limits, permissions, and contested claims.
