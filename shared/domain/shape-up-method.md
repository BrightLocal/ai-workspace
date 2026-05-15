# Shape Up — Method Notes

> This file documents the parts of Shape Up that this team actually uses. It is
> not a full primer on Shape Up — read Basecamp's book for that. This is a working
> reference for how concepts apply in this workspace.

## Why this file exists

Several PRDs in the products in this workspace use Shape Up vocabulary:
"appetite", "small batch", "scope hammering", "betting table". When a subagent
writes a PRD, it must use these terms correctly — not as decoration, not as
generic project management jargon.

## Appetite

**Appetite is a budget of time.** It is not an estimate.

When the PM writes "appetite: 2 weeks small batch", they are saying: "we are
willing to spend 2 weeks on this; if we can't fit the desired outcome in 2 weeks,
we cut scope until we can".

This is the opposite of how story-pointed teams work. Story-pointed teams hold
scope fixed and let time vary. Shape Up holds time fixed and lets scope vary.

### Standard appetites in this team
- **Small batch** — typically 2 weeks, sometimes 1 sprint
- **Big batch** — typically 6 weeks
- (Some PRDs use "1 sprint, may extend to 2" — this is a softened small batch)

### When appetite is empty
If the PRD is an investigation/spike (DataAxle Phase 1 type), appetite may be
omitted. The work is "until we know enough to commit". Once committed, a follow-up
PRD with explicit appetite is written.

### How a PRD-writer agent should handle appetite
- If the input clearly states urgency or duration, write the appetite
- If the input is investigation-flavored, leave appetite empty
- If unclear, leave appetite as a placeholder: `Appetite: TBD — needs scope hammering`
- NEVER fabricate appetite from thin air

## Scope hammering

When work is in flight and threatens to exceed the appetite, you don't extend the
appetite — you cut scope. This is "scope hammering". Things you can cut:

- Edge cases — defer them as known limitations
- Polish — ship without animations, refinements, optional UX layers
- Optional features — anything labeled "nice to have" goes first
- Secondary metrics — instrument later

The PRD-writer agent should ALREADY mark optional and "nice-to-have" items in the
PRD itself, so scope hammering targets are visible from the start. Look at how
existing PRDs use "[Nice to have]" labels in user stories.

## Betting table

Shape Up teams don't have a backlog of committed features. They have a "shaped"
queue of pitches, and at a betting table the leadership decides which pitches to
fund for the next cycle.

This is mostly invisible to the PRD-writer agent (it operates after a bet has been
made), but it explains why:
- PRDs are usually written for already-committed work
- The "Desired outcome" section is heavy — the bet is justified there
- Speculative future phases (DataAxle Phase 2, Phase 3) are marked "TBC" rather
  than scoped

## Variable scope, fixed time — language patterns

When writing or reviewing a PRD, watch for language that betrays the wrong frame:

| Wrong frame (estimate-based) | Right frame (appetite-based) |
|------------------------------|------------------------------|
| "This will take 3 weeks" | "Appetite: small batch (2 weeks)" |
| "We estimate 8 story points" | "Appetite: 1 sprint" |
| "Engineering needs more time" | "If we can't ship in the appetite, what do we cut?" |
| "We added scope after kickoff" | "We re-shaped this — see decision log below" |

The right-side language reinforces the team's working model. The left-side language,
if it appears in a PRD, will create alignment friction.

## The "NO VALID ANYMORE" pattern

This team explicitly preserves outdated user stories and decisions, marking them
"NO VALID ANYMORE" with a reason, rather than deleting them. This serves two
purposes:
1. It shows the evolution of thinking, useful for new team members reading the PRD
2. It prevents regressing to a discarded approach by accident

The PRD-writer agent should respect this pattern. If a user provides updated context
that contradicts an earlier user story, the agent should mark the earlier story
as `NO VALID ANYMORE: [reason]` rather than deleting it — unless the user explicitly
asks for a clean slate.

## When this file is wrong

If the team adopts a different methodology, or this description drifts from how the
team actually works, update this file before updating the personas. Personas
reference this file; getting it right here propagates correctly.
