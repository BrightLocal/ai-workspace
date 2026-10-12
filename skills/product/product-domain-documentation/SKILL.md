---
name: product-domain-documentation
description: Researches, audits, and builds canonical AI-ready product domain documentation from a short seed context such as a domain, capability, or component name. Use when documenting or investigating product areas such as Add Location Wizard or Active Sync; converting scattered PRDs, tickets, code, tests, schemas, and discussions into current-state knowledge; preparing context for Q&A, prototyping, or coding agents; or updating an existing product knowledge base. Produces product boundaries, concepts, business rules, scenarios, workflows, technical context, decisions, gaps, metadata, and traceable evidence without requiring C4 diagrams.
---

# Product Domain Documentation

Build durable product knowledge that is useful to humans, search/RAG systems, prototyping agents, and coding agents.

Treat the user's short context as a research seed, not as ground truth. Investigate before documenting. Prefer evidence over inference and explicitly expose uncertainty.

## Core model

Use progressive depth rather than C4:

1. **Domain / capability overview** — purpose, scope, actors, boundaries, adjacent capabilities.
2. **Concepts and behavior** — entities, terminology, states, invariants, business rules.
3. **Scenarios and workflows** — observable behavior, happy paths, alternatives, failures, permissions.
4. **Technical context** — responsibilities, system touchpoints, dependencies, contracts, data/state, runtime flows, failure handling, observability.
5. **Decisions and history** — rationale, tradeoffs, superseded behavior, unresolved decisions.

Do not use user stories as the canonical long-lived structure. Treat user stories, PRDs, and tickets as evidence of change or intent. Convert durable behavior into explicit rules and scenarios.

Do not require or generate C4 diagrams. If a diagram materially reduces ambiguity, use a simple flow, sequence, state, or dependency diagram with ordinary labels and no C4 notation.

Read [references/framework.md](references/framework.md) for the full documentation model.
Read [references/research-and-evidence.md](references/research-and-evidence.md) before resolving conflicting or incomplete sources.
Read [references/templates.md](references/templates.md) when creating or updating documentation files.
Read [references/evals.md](references/evals.md) when validating the skill or checking output quality.

## Workflow

### 1. Interpret the seed

Extract the likely domain/capability name, requested scope, desired depth, and any explicit constraints.

Do not demand a detailed brief. A short input such as `Active Sync` or `Document Add Location Wizard` is sufficient to start research.

If the domain boundary is ambiguous, investigate available sources first. Ask a targeted question only when the ambiguity materially blocks a correct result.

### 2. Discover evidence

Use the environment's available sources. Prefer, in order of relevance:

- user-provided files or links;
- the current repository, tests, schemas, API definitions, configuration, and code comments;
- maintained internal product/engineering documentation;
- accepted/current design or requirements documents;
- issue trackers and change history;
- internal discussions or messages;
- public documentation for external dependencies.

In a code workspace, inspect the repository before making claims about implementation.
In a connected workspace, search relevant internal sources before relying on public information.
Do not browse the public web for internal product facts when internal evidence is available.

Create an internal evidence inventory covering: source, date/version when available, what it supports, and whether it describes current behavior, intended behavior, or history.

### 3. Establish the domain boundary

Identify:

- purpose and user/customer value;
- actors and roles;
- in-scope and out-of-scope responsibilities;
- entry points and exit points;
- adjacent capabilities;
- external systems or integrations;
- core terminology.

If the investigated area is really a workflow spanning several capabilities, say so rather than forcing it into a single component hierarchy.

### 4. Reconstruct behavior

Extract durable behavior from evidence.

Represent product behavior as:

- concepts and entities;
- states and transitions;
- business rules and invariants;
- permissions and eligibility;
- scenarios and edge cases;
- failure behavior;
- user-visible and system-visible outcomes.

Use semantic rule IDs such as `active-sync.rule.requires-eligible-connection` rather than fragile sequential numbering when practical.

Acceptance criteria belong here when they describe observable product behavior. Rewrite implementation-specific acceptance criteria into behavior unless implementation itself is a contractual requirement.

### 5. Build technical context without C4

Describe engineering reality using the Technical Context Map:

- **Responsibilities** — what this domain owns technically and what it delegates.
- **Touchpoints** — repositories, modules, services, jobs, third-party systems, UI surfaces.
- **Contracts** — APIs, events, queues, schemas, callbacks, file interfaces.
- **Data and state** — entities, persistence, identifiers, state machines, ownership of truth.
- **Runtime flows** — important request/event sequences from trigger to outcome.
- **Operational behavior** — validation, retries, idempotency, rate limits, failure modes, observability.

Prefer machine-readable contracts such as OpenAPI, schemas, migrations, or typed interfaces over prose duplication. Link to them and explain only the product-relevant semantics.

### 6. Separate current, intended, and historical truth

Never silently merge conflicting sources.

For each important conflict, classify it as one of:

- `current behavior` — what the running/code-backed system appears to do now;
- `intended behavior` — what accepted product/design requirements say should happen;
- `historical behavior` — superseded behavior retained for context;
- `unknown` — insufficient evidence.

If code and accepted product intent diverge, document the divergence explicitly. Do not assume either is automatically correct.

### 7. Produce the documentation set

Prefer semantically focused Markdown files over a single large PRD.

Default package for a substantial domain:

```text
<domain-slug>/
  overview.md
  concepts-and-rules.md
  workflows.md
  technical-context.md
  decisions.md
  open-questions.md
```

Split further only when a file becomes broad enough to mix unrelated concerns. For small domains, combine files while preserving the same conceptual sections.

If a repository already has a documentation convention, follow it instead of creating a parallel hierarchy.

If the environment is writable and the user asked to create/update documentation, write the files. Otherwise return the content grouped by proposed filenames.

Use the metadata and file templates in [references/templates.md](references/templates.md).

### 8. Preserve traceability

For important claims, rules, contracts, and decisions, retain a source reference when the environment supports stable links, file paths, issue IDs, commits, or citations.

Link change artifacts to canonical knowledge rather than embedding long-lived truth only in tickets.

Do not invent decision rationale. If the decision is visible but the rationale is not, record `Rationale: unknown` and add it to open questions.

### 9. Validate for AI use

Before finalizing, verify that an unfamiliar agent could answer these questions from the docs without guessing:

- What is this domain and why does it exist?
- What is explicitly in and out of scope?
- What concepts and entities matter?
- What must always be true?
- What states and transitions exist?
- What are the main workflows and failure paths?
- What technical systems and contracts participate?
- Where does authoritative data/state live?
- What is current versus proposed or historical?
- What is still unknown or disputed?

Also verify that no unsupported inference is presented as fact and that metadata reflects document status.

## Output behavior

Start the final response with a concise domain summary and confidence/coverage note.

Then provide either:

- links/paths to created or updated files plus the most important findings and unresolved gaps; or
- the proposed file tree followed by the documentation content when file creation is unavailable.

Keep research notes separate from canonical docs. Do not fill canonical docs with speculative prose.

Match the user's language unless the existing documentation convention requires another language.
