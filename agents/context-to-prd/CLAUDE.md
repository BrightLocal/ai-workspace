# context-to-prd Agent

This is the orchestrator for the context-to-PRD pipeline. It transforms free-form
input (notes, transcripts, ideas, voice memos transcribed) into a draft PRD that
follows this team's Confluence template.

## Pipeline phases

```
Input (free context)
    ↓
Phase 1: context-analyzer (PM perspective)
    → writes 01-context.md
    ↓
Phase 2: metrics-checker (Analyst perspective)
    → writes 02-metrics-review.md
    ↓
Phase 3: prd-writer (PM perspective, template-bound)
    → writes 03-prd.md
    ↓
Phase 4: feasibility-reviewer (Architect perspective)
    → appends to 03-prd.md
    ↓
Output: 03-prd.md (ready for human review and Confluence paste)
```

Each phase reads what previous phases wrote. Phases do NOT call each other —
they write to the working directory and the orchestrator (this file) coordinates.

## Loading order at startup

When this orchestrator runs, the FIRST things to load are:

1. `../../shared/domain/local-seo.md` — niche knowledge
2. `../../shared/domain/shape-up-method.md` — appetite, scope hammering
3. `../../products/${ACTIVE_PRODUCT}/CONTEXT.md` — product-specific context
4. `../../shared/templates/prd-confluence.md` — output format
5. `../../shared/templates/prd-confluence-examples.md` — voice and patterns

Subagents in `.claude/agents/` load their respective persona files automatically.

## How to invoke

### Quickest (interactive)
```
cd ai-workspace
export ACTIVE_PRODUCT=BrightLocal
claude
> /agent context-analyzer "Here's the context: <paste notes here>"
```

The orchestrator pattern: invoke each subagent in sequence, reviewing outputs
between phases.

### Scripted
```bash
./scripts/run.sh <feature-slug> <path-to-input.md>
```

The script creates `products/$ACTIVE_PRODUCT/working/<feature-slug>/` and runs
all four phases in sequence. Pause for human review between phases is supported
via `--interactive` flag.

## Human gates

You SHOULD review between phases, especially:
- After Phase 1 (context-analyzer) — verify the PM understood the input correctly.
  This is the cheapest place to catch misalignment.
- After Phase 3 (prd-writer) — read the draft PRD before the architect reviews.
  Sometimes you'll want to skip Phase 4 entirely.

## When to skip phases

- **Skip Phase 2 (metrics-checker):** investigation/spike PRDs may not have
  measurable outcomes yet. Pass `--skip-metrics` to scripts.
- **Skip Phase 4 (feasibility-reviewer):** strategy PRDs that don't propose
  specific implementation. Pass `--skip-feasibility`.

## Output

Final artifact: `products/$ACTIVE_PRODUCT/working/<feature-slug>/03-prd.md`

This is markdown. Paste into Confluence — the heading hierarchy will map directly.
Tables port. Status badges (TESTED & FIXED, RESOLVED, etc.) are added manually
in Confluence after the fact — the agent does not generate them.

## What this agent does NOT do

- Does not generate Jira tickets (that's `jira-to-pr` agent's domain)
- Does not draft designs (designs section will say "TBD" or contain a placeholder)
- Does not estimate engineering effort beyond appetite
- Does not invent metrics, baselines, or numbers — flags them as "TBD" instead
- Does not submit anything to Confluence (manual paste is intentional — gives
  you a final review step)

## Troubleshooting

**Agent's PRD doesn't sound like our PRDs.**
Check that `shared/templates/prd-confluence-examples.md` is loading. Voice and
voice samples come from there.

**Agent fabricated a baseline metric.**
This is a bug in the prd-writer. The persona explicitly forbids this. File a
correction — paste the offending line + "this should have said TBD" — and the
prd-writer will improve.

**Agent skipped User Stories section.**
That's intentional for some PRDs (especially internal-only or pure investigation).
If you want them, add to the input: "include user stories".

**Agent's appetite is wrong.**
Appetite should come from the input. If the input doesn't specify, the agent
should leave it as "Appetite: TBD — needs scope hammering". Verify your input
included a duration cue.
