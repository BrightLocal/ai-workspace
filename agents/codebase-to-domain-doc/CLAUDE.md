# codebase-to-domain-doc Agent

This is the orchestrator for the codebase-to-domain-doc pipeline. It turns a
tree of domain definitions (or a seed list of module names) into a
business-friendly Domain Definitions document, grounded in evidence from the
product codebases: every definition is researched against the repos' existing
domain docs first and code second, the main document stays free of technical
detail, and a separate evidence map plus a knowledge-gaps report make the
result verifiable and refreshable as the code evolves.

## Pipeline phases

```
Input file (mode tree: definitions tree · mode seed: module/entity list)
    │ scripts/run.sh — validates repos, records repo SHAs, copies into 00-inputs/
    ↓
Phase 0: definition-intake (PM)               → 01-definition-registry.md
    ── GATE A: recommended in tree mode · MANDATORY in seed mode (approve the drafted tree) ──
Phase 1: branch-researcher × N (Architect)    → 02-research/{bNN-slug}.md
    │  one invocation PER RESEARCH UNIT, fresh context each time
    ── GATE B (optional): spot-check the FIRST research file ──
Phase 2: domain-doc-writer (PM)               → 03-domain-definitions.md
Phase 3: gap-auditor (Analyst)                → 04-evidence-map.md + 05-knowledge-gaps.md   [--skip-gaps drops 05 only]
    ── GATE C (strongly recommended): review 03 + 05, edit 03 directly ──
    ── GATE D (MANDATORY): publish only on explicit user go-ahead ──
Phase 4: confluence-publisher (mechanical)    → Confluence page + 06-publication-log.md
```

Each phase reads what previous phases wrote. Phases do NOT call each other —
they write to the working directory and the orchestrator (this file) coordinates.

## Loading order at startup

When this orchestrator runs, the FIRST things to load are:

1. `../../shared/domain/local-seo.md` — niche knowledge
2. `../../products/${ACTIVE_PRODUCT}/CONTEXT.md` — product-specific context
3. `../../shared/templates/domain-definitions.md` — final deliverable format

Subagents in `.claude/agents/` load their respective persona, skill, and
template files themselves.

## How to invoke

### Scripted setup (recommended)

```bash
export ACTIVE_PRODUCT=Tools   # output home only — repos scanned come from --repos
./scripts/run.sh <domain-slug> <input-file> [--repos Tools,ListingSyncer] [--mode tree|seed]
```

The input file is either a definitions tree (`definitions-*.md`, indented
markdown bullets) or a seed list of module/entity names (`seed-*.md`, one per
line). The script copies it into
`products/$ACTIVE_PRODUCT/working/<domain-slug>/00-inputs/`, records the
current SHA of each repo in `00-inputs/repo-state.md`, and prints the `/agent`
sequence.

### Then, in a Claude Code session

```
/agent definition-intake "working_dir: products/Tools/working/<domain-slug>, mode: tree, repos: Tools,ListingSyncer"
```

## Repos vs ACTIVE_PRODUCT (do not confuse them)

- `ACTIVE_PRODUCT` selects ONLY the output home:
  `products/$ACTIVE_PRODUCT/working/<domain-slug>/`. Running with
  `ACTIVE_PRODUCT=CB` while scanning the Tools and ListingSyncer repos is a
  fully supported — and typical — configuration.
- The repos to scan come exclusively from `--repos` (default
  `Tools,ListingSyncer`). Each must resolve to
  `products/{repo}/codebase/{repo}`. run.sh validates this and Phase 0 records
  the repo roots in the registry's Repo index.
- Subagents resolve repo roots from the registry, never from ACTIVE_PRODUCT.

## The research loop (Phase 1)

This is the one orchestration step that differs from other pipelines:

1. After Gate A, read the "Research units" table in `01-definition-registry.md`.
2. For EACH research unit, invoke:
   ```
   /agent branch-researcher "unit: {bNN-slug}, working_dir: products/$ACTIVE_PRODUCT/working/{domain-slug}"
   ```
   One invocation per unit, sequentially. Each invocation starts with fresh
   context — a unit maps to 1–3 modules, so the researcher reads that unit's
   module docs and targeted code without contamination from other units.
3. After the FIRST invocation, offer Gate B: spot-check that research file
   (evidence rows typed, statuses honest, no pasted code) before spending the
   remaining N-1 runs. Calibration here is cheap; re-runs later are not.
4. Before Phase 2, verify `02-research/` has one file per research unit.
   Missing files → re-run those units. Units with an existing file are SKIPPED
   on re-run (resumability). To redo one unit, delete its research file and
   re-invoke.

## Human gates

You SHOULD review between phases, especially:

- **Gate A** (after Phase 0) — is the tree right? In **seed mode this gate is
  MANDATORY**: the intake drafted the tree itself and every node is marked
  `drafted` — approve or edit it before any research spend. In tree mode it is
  recommended: wrong nesting here poisons every unit downstream. Cheapest fix
  point.
- **Gate B** (after first Phase 1 run, optional) — calibrate research quality
  once before processing all units.
- **Gate C** (after Phase 3, strongly recommended) — the highest-value review.
  Read `03-domain-definitions.md` alongside `05-knowledge-gaps.md`. Fix
  wording, resolve naming drift, decide what to do with *(under review)*
  definitions — edit 03 directly; the publisher publishes your edits.
- **Gate D** (before Phase 4, MANDATORY) — publication happens ONLY when you
  explicitly say so. The orchestrator must NEVER chain Phase 3 into Phase 4
  automatically. The publisher subagent will refuse without an explicit
  go-ahead.

If a phase output looks wrong, fix the file directly. Subsequent phases will
read your fixes.

## When to skip phases

- **`--skip-gaps`** — you only want the document and the evidence map, not the
  knowledge-gaps report. Not recommended: closing knowledge gaps is half the
  point of this pipeline, and gap class E (tech bleed) is the publish blocker
  check.

## Language policy

- Working artifacts and the document are written in **English**.
- The user may address this pipeline in Ukrainian — respond in kind, but write
  files in English.
- Definition terms supplied by the user keep the user's original wording (any
  language); naming drift against the code's Ubiquitous Language is recorded,
  never silently "fixed".

## Evidence rules (enforced across all phases)

- Every definition in the registry gets hierarchical IDs (`D-1`, `D-1.1`, ...)
  that stay stable across re-runs.
- Every research claim carries an evidence type: `doc` (path + section),
  `code` (path + symbol), or `inferred`. Doc claims that look stale are
  spot-verified; discrepancies become conflicts in the gaps report, never
  silent fixes.
- Research is **docs-first, code-second**: module `AGENTS.md` →
  `CONTRACTS.md`/`INTEGRATIONS.md` → product CONTEXT.md → only then targeted
  code reads (budget ~15 files per unit).
- No evidence → the definition stays in the document marked *(under review)*
  and gets a gap entry. Definitions are never silently dropped and behavior is
  never invented beyond evidence.

## Output

Final artifacts in `products/$ACTIVE_PRODUCT/working/<domain-slug>/`:

- `03-domain-definitions.md` — the deliverable (business-clean, Confluence-ready)
- `04-evidence-map.md` — definition → code mapping with repo SHAs (internal,
  never published; drives future refresh runs)
- `05-knowledge-gaps.md` — what's defined but unevidenced, in code but
  undefined, conflicting, drifting, or leaking tech into the doc

## Refreshing an existing document

Re-run against the same `<domain-slug>`: the registry keeps its D-IDs, run.sh
records the new repo SHAs, and `04-evidence-map.md` carries the refresh
procedure (compare SHAs, re-verify rows whose source paths changed, delete and
re-run only the affected research units).

## What this agent does NOT do

- Does not modify either codebase and does not write `AGENTS.md` files into
  the repos — its output lives in `working/` (codebase writes are denied in
  `.claude/settings.json`)
- Does not create Jira issues — Jira write tools are denied at the permission
  layer
- Does not publish to Confluence without an explicit user go-ahead, and never
  publishes `04-evidence-map.md` or `05-knowledge-gaps.md`
- Does not put technical details in the main document — code identifiers,
  paths, and symbols live in the evidence map only
- Does not rename the user's terms — naming drift is reported for the human to
  resolve at Gate A or Gate C
- Does not write PRDs — that's `context-to-prd`

## Troubleshooting

**The nesting in the document looks wrong.**
The writer follows the registry's hierarchy exactly. Fix the tree in
`01-definition-registry.md`, delete the research files for the affected units,
re-run those units, then re-run Phase 2.

**A definition is marked *(under review)* but you know it's real.**
The researcher found no evidence within its budget. Check its unit's file in
`02-research/` — the "Not found / weak evidence" section says what was
searched. Point the registry's Notes column at the right module and re-run
that unit, or accept the marker and resolve it at Gate C.

**Evidence looks stale after the code moved on.**
`04-evidence-map.md` records the repo SHAs it was built against and its
"Refresh procedure" section describes exactly which rows to re-verify. Re-run
run.sh for the same slug to capture new SHAs.

**Confluence publish failed.**
See `06-publication-log.md` — it records the exact error. The document stays
complete at `03-domain-definitions.md` and pastes into Confluence manually, or
authenticate the atlassian MCP server and re-invoke confluence-publisher.

**A new branch of definitions was added later.**
Add the rows to the registry tree (new D-IDs, existing IDs unchanged), add a
research unit for them, run Phase 1 for the new unit only, then re-run
Phase 2+.
