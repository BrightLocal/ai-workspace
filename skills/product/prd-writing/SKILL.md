---
name: prd-writing
description: Use when writing a PRD that follows this team's Confluence template. Covers all three PRD types (Implementation, Strategy, Investigation/Spike), how to structure each section, common pitfalls, and template-binding patterns. Required reading for the prd-writer subagent.
---

# Skill: PRD Writing (Confluence template)

## When to use this skill

When writing or revising any section of a PRD that will land in this team's
Confluence space. The skill encodes the team's specific format, voice, and
section-level expectations.

## The three PRD types

Before writing anything, decide which type you're producing. The shape of every
section depends on this.

### Type 1: Implementation PRD

**Signal:** the feature is shaped, ready to build. Designs exist or are imminent.
There are concrete metrics. Appetite is clear.

**Section behavior:**
- Summary: all 4 cells filled including specific Appetite
- Problem: numbered list of distinct causes
- Solution: lettered (A, B, C, D) for 2-4 components, decimal (1.1, 1.2) for 5+
- Designs: Figma link or specific design status
- Data and metrics: full table + minimum events + required properties + diagnostics
- User stories: full table with acceptance criteria
- Results: forward-looking evaluation cuts
- Anything else?: risks with mitigations

**Reference:** Connect & Sync, Aggregators Purchase Journey.

### Type 2: Strategy PRD

**Signal:** the question is about business model, approach, or design constraint.
Less about "build this UI" and more about "we will or will not do X".

**Section behavior:**
- Summary: heavier on "Solution" cell (the strategic call)
- Problem: prose with embedded bullets, focused on the strategic tension
- Solution: often opens with "Core principle: ..." callout. Decimal numbering for
  components.
- Designs: often "TBD" or omitted
- Data and metrics: lighter — sometimes just the metric table without full event lists
- User stories: high-level job stories, often without acceptance criteria
- Results: outcome cuts from the strategic call

**Reference:** Aggregators Purchase Journey (the business model decision).

### Type 3: Investigation/Spike PRD

**Signal:** uncertainty must be resolved before committing. Phrases like "we
need to understand if X is possible", "go/no-go decision", "spike", "PoC".

**Section behavior:**
- Summary: Appetite cell is EMPTY. Desired outcome cell describes a learning goal.
- Problem: prose listing the unknowns. "Before committing to X, we need to
  understand Y."
- Solution: structured as Phase 1 (current commitment) / Phase 2 (TBC, blocked by) /
  Phase 3 (TBC). Phase 1 has full detail; later phases marked "no implementation
  commitment is made".
- Designs: usually "TBD" or omitted
- Data and metrics: instead of behavior metrics, list "what we want to measure
  during the spike" (API error rates, lifecycle timing, etc.)
- User stories: often omitted entirely. If included, internal-engineer or
  internal-tool stories.
- Results: deliverables of the investigation ("Working PoCs for X, Documented
  understanding of Y, A clear recommendation on Z")

**Reference:** DataAxle Integration Phase 1.

## Section-level guidance

### Summary

The 2x2 matrix structure. Cells are SHORT — 1-2 sentences each.

For complex Implementation PRDs, the Desired outcome cell can expand into 4
short bullets, each one a separate business goal. Aggregators is the canonical
example:
- Maximize adoption (Allow easy purchase, Enable single or multi)
- Increase renewal rate (target: 20% → 25%+)
- Avoid business & technical risk (Preserve revenue model, Avoid Braintree limits)

Don't start with the Summary. Write it LAST, by compressing the deeper sections.

### Desired outcome

Two subsections: Primary outcome, Secondary outcomes.

Primary outcome connects to a North Star metric. Secondary outcomes are supporting
effects. Use observable language. Pair with numbers when known.

For Investigation PRDs, the desired outcome describes LEARNING:
> "Validate that Data Axle APIs can support BrightLocal use cases for location
> submission and status tracking."

### The problem

Format depends on type (see above). Universal rules:
- ONE sentence opener that names the pain directly
- Concrete examples wherever possible (specific dates, specific user actions)
- Do not describe the solution here

### The solution

Structural choice depends on complexity:
- 1 component → prose with bullets
- 2-4 components → lettered (A, B, C, D)
- 5+ or multi-stage → decimal (1.1, 1.2, 2.1)
- Phased uncertainty → Phase 1, Phase 2 (blocked), Phase 3 (TBC)

For Strategy PRDs, open with a "Core principle:" callout if the input justifies
one.

What to include: the mechanic, UX choices that matter for the outcome, edge
cases handled or deferred, naming/copy decisions when load-bearing.

What to exclude: implementation details (DB schema, API contracts), estimates,
designs themselves.

### Designs

This is almost always "TBD" or a Figma link. Do not generate ASCII mockups
unless the input explicitly describes a layout that benefits from one.

### Data and metrics

For Implementation PRDs, full structure:

```
| Metric type | Metric | Why it matters |
|---|---|---|
| North Star | ... | ... |
| Primary feature metric | ... | ... |
| Secondary | ... | ... |
| Guardrail | ... | ... |

### Minimum events
- snake_case_event_names

### Required properties
- integration, location_id, customer_id, plan_context

### Diagnostics
- Drop-off cuts, time measurements
```

For Investigation PRDs, replace metrics table with: "The integration should
provide enough visibility to: [list]".

For Strategy PRDs, often just the metric table without events/properties.

### User stories

Confluence-style table: Summary | User story | Acceptance criteria

- Summary column: short tag for grouping ("Purchase", "Activation", "Renewal")
- User story: standard "As a [role], I want to [action], so that [outcome]"
- Acceptance criteria: bullet list of conditions

Mark optional features with `[Nice to have]` prefix in user story column.

Do NOT generate Jira ticket numbers. Acceptance criteria are plain bullets unless
input explicitly mentions tickets.

OMIT this section if:
- Pure investigation/spike with no user-facing behavior
- Internal-only work where the user is purely internal AND the work is plumbing

### Results

Forward-looking evaluation cuts. Short bullet list.

For Investigation PRDs, list the artifacts of the investigation, not metrics.

### Anything else?

Catch-all: risks (with mitigations), dependencies, deferred decisions, privacy
notes, open questions.

If empty, write "None at this time." or omit the section.

## Universal voice rules

### Forbidden phrases (mark generic AI output)

- "leverage", "synergy", "ecosystem"
- "robust", "comprehensive", "holistic"
- "delight", "engage" without a metric
- "seamless", "frictionless"
- "This document outlines..."
- "It is important to note that..."
- "best-in-class", "world-class"

### Required habits

- Active voice
- Present tense for current state, future tense for the plan
- Specific numbers when known, "TBD" when not — never invented
- Numbered/lettered hierarchy in solution sections
- Concrete examples in problem section

### "NO VALID ANYMORE" pattern

When updated context contradicts an earlier user story, mark the original story
as `NO VALID ANYMORE: [reason]` rather than deleting. This preserves decision
history and prevents accidental regression to a discarded approach.

## Common pitfalls

### Mixing PRD types
Picking "Implementation" structure but the input is really "Strategy" — leads to
under-specified user stories and over-specified solution structure. Or vice versa.
When in doubt, ask: is this about WHAT to build (Strategy) or HOW we'll build it
(Implementation)?

### Inventing baselines
Writing "current renewal rate: 20%" when the input never said that. Always:
"current: TBD".

### Smoothing over ambiguity
Phase 1 (context-analyzer) flags open questions. The PRD writer should NOT
silently resolve them. Either get clarification, or write "TBD — needs scope
hammering with team".

### Generating Jira tickets
Tasks with LM-XXXX numbers are added MANUALLY post-PRD, or via `jira-to-pr` agent.
The PRD writer never invents these.

### Bloating user stories
5 strong stories beat 15 weak ones. If a story doesn't have meaningful acceptance
criteria, it's probably not strong enough to include.

## Self-check before finishing

Mental checklist:
- [ ] PRD type chosen and structure matches
- [ ] Summary written last, compresses deeper sections
- [ ] Problem section opens with one direct sentence
- [ ] Solution structure matches complexity (lettered/decimal/phased)
- [ ] No fabricated numbers/dates/tickets
- [ ] No generic AI vocabulary (see Forbidden phrases)
- [ ] User stories included only if appropriate
- [ ] All "AGENT INSTRUCTIONS" comments stripped from output
- [ ] All `{...}` placeholders replaced or marked TBD
