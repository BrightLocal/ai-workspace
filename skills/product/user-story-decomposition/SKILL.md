---
name: user-story-decomposition
description: Use when breaking down a feature into user stories for the User stories section of a PRD. Covers the Confluence-table format used by this team, when to omit user stories, the [Nice to have] marker, and the NO VALID ANYMORE pattern.
---

# Skill: User Story Decomposition

## When to use this skill

When you need to produce the User stories table section of a PRD, or when
revising user stories in an existing PRD.

## Format (this team's convention)

User stories live in a Confluence-style table with three columns:

| Summary | User story | Acceptance criteria |
|---|---|---|
| {tag} | As a {role}, I want to {action} so that {outcome}. | - {AC 1}<br>- {AC 2} |

### Summary column

A short tag (1-3 words) used for grouping related stories. Examples from real PRDs:
- `Purchase`, `Renewal`, `Activation & Value` (Aggregators)
- `LM`, `Connect & Sync`, `Active Sync Plus` (Connect & Sync)
- `Internal CB Integration`, `Active Sync` (DataAxle)

The tag is NOT the user role. It's the functional area or workflow phase.

### User story column

Standard format: `As a {role}, I want to {action}, so that {outcome}.`

Roles in this product family typically include:
- "user" (when the persona is generic)
- "Customer" (often capitalized, when distinguishing from internal users)
- "CB engineer", "PH team member", "SysAdmin" — for internal-facing stories
- "agency owner", "multi-location business owner" — for specific external personas

Pick the most specific role the input supports. Don't default to "user" if you
have a clearer signal.

### Acceptance criteria column

A bullet list of conditions that must be true for the story to be considered done.

Format options:
1. **Pure conditions** (most common):
   - "AS+ add-on is bought and active for the Location"
   - "FF is ON"

2. **Linked Jira tickets** (only if input provides them):
   - LM-3865: Add feature flag for Data Axle (RELEASED)
   - LM-3914: Add DataAxle availability check based on FF addon (RESOLVED)

3. **Mixed conditions and ticket references** — see DataAxle PRD for examples.

NEVER invent Jira ticket numbers. If input doesn't mention tickets, use plain
condition bullets.

## When to OMIT the user stories section

The section is marked "(optional)" in the template for a reason. Skip it entirely
when:

- The PRD is a pure investigation/spike with no user-facing behavior
- The work is internal plumbing where no user (internal or external) is the
  consumer (e.g., a service refactor)
- The "users" of the work are other developers, not customers, and acceptance is
  better captured as technical criteria (use the Anything else? section instead)

DO include user stories when:
- The PRD describes user-visible behavior
- There's a workflow with multiple steps that need separate validation
- The team has explicitly agreed the feature ships in increments

## Special markers

### `[Nice to have]` prefix

Use in the User story column to mark scope-hammering targets:

```
| Renewal | As a Customer, I want to get a discount for renewing | - 25% discount applied at renewal |
| Active Sync | [Nice to have] possibly notify by email | - email sent on submission status change |
```

These are the FIRST things to cut if appetite is exceeded. By marking them
explicitly, you give the team clear cut targets without removing the items.

### "NO VALID ANYMORE: [reason]"

When a previous user story is superseded by a new decision, do NOT delete it.
Mark it with the date and reason:

```
| Active Sync | As a Customer I can look up for my business data of my Location | API Search is critical blocker here.<br><br>**Mar 17, 2026 — User Story NO VALID ANYMORE:** we no need lookup anymore in UI because data will be submitted automatically when access is purchased. |
```

This pattern preserves decision history. Apply when:
- New input contradicts an existing story
- Scope was reduced, removing the story's relevance
- The mechanic changed (e.g., manual flow → automatic flow)

DO NOT use this pattern for stories that were only edited or refined. Use it
only for genuine reversals of direction.

## Decomposition heuristics

### One story per user goal, not per UI element

Bad (UI-decomposed):
- As a user, I want to click the Buy button
- As a user, I want to see a confirmation modal
- As a user, I want to enter my payment details

Good (goal-decomposed):
- As a user, I want to buy a single aggregator (in one flow)
- As a user, I want to buy multiple aggregators together to save money
- As a user, I want to be notified before my aggregator expires

### Vertical slices, not horizontal layers

Each story should be END-TO-END from the user's perspective. Don't split into
"frontend story" + "backend story" + "database story".

### Mark optional features explicitly

If a story is genuinely optional, say so:
- `[Nice to have]` prefix
- Or in acceptance criteria: "Optional in v1, required for v2"

This matches Shape Up scope hammering — you want clear cut targets.

### Aim for 5-10 strong stories per PRD

Less than 5: probably under-decomposed, the team won't have clear handoff points.
More than 10: probably over-decomposed, you're doing engineering's job.

If you have 15+ stories, consider splitting the PRD itself into two PRDs.

## Quality checks

Before finalizing:

- [ ] Every story has an obvious user value (the "so that" clause is meaningful)
- [ ] No story is purely technical (those go in Anything else? or tech design)
- [ ] AC are observable (you can tell when they're met)
- [ ] No invented Jira tickets
- [ ] Optional items marked with `[Nice to have]`
- [ ] Superseded items marked NO VALID ANYMORE (not deleted) if relevant
- [ ] 5-10 stories total (not 1, not 20)

## When this skill doesn't help

If the input doesn't provide enough for stories, the right move is to flag this
as an open question, not invent stories. Possible signals:
- Input is purely strategic ("we should do X") with no user behavior described
- Input is investigation-flavored
- Input is at the wrong level (architecture, not feature)

In these cases, skip the user stories section and explain why in the agent's
output: "User stories omitted — input describes strategic direction without
specific user-visible behavior."
