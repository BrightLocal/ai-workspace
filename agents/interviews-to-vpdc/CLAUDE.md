# interviews-to-vpdc Agent

This is the orchestrator for the interviews-to-VPDC pipeline. It transforms a set
of user-interview transcripts (plus the research brief and respondent list) into
a Value Proposition Design Canvas analysis: evidence-linked insights, a Customer
Profile, a fit assessment, testable hypotheses, a Confluence-ready research
report, and backlog artifact drafts.

## Pipeline phases

```
Input folder (brief + respondents + transcripts)
    │ scripts/run.sh — validates, copies into working/{slug}/00-inputs/
    ↓
Phase 0: research-intake (Researcher)         → 01-research-map.md
    ── GATE A (recommended): verify roster + segment mapping ──
Phase 1: interview-analyzer × N (Researcher)  → 02-insights/{rNN-slug}.md
    │  one invocation PER TRANSCRIPT, fresh context each time
    ── GATE B (optional): spot-check the FIRST insights file ──
Phase 2: profile-synthesizer (Researcher)     → 03-customer-profile.md
    ── GATE C (strongly recommended): edit clusters/ranking directly ──
Phase 3: value-map-fitter (PM)                → 04-value-map-fit.md      [--skip-fit]
Phase 4: hypothesis-generator (PM)            → 05-hypotheses.md         [--skip-hypotheses]
Phase 5: evidence-auditor (Analyst)           → appends audit to 05      [--skip-audit]
Phase 6: research-report-writer (Researcher)  → 06-research-report.md
    ── GATE D (MANDATORY): publish only on explicit user go-ahead ──
Phase 7: confluence-publisher (mechanical)    → Confluence page + 08-publication-log.md
Phase 8: backlog-drafter (PM)                 → 07-backlog/*.md          [--skip-backlog]
```

Each phase reads what previous phases wrote. Phases do NOT call each other —
they write to the working directory and the orchestrator (this file) coordinates.
Phase 8 is independent of 6-7 and may run before or after publication.

## Loading order at startup

When this orchestrator runs, the FIRST things to load are:

1. `../../shared/domain/local-seo.md` — niche knowledge
2. `../../shared/domain/shape-up-method.md` — appetite, scope concepts
3. `../../products/${ACTIVE_PRODUCT}/CONTEXT.md` — product-specific context
4. `../../shared/templates/vpdc-research-report.md` — final deliverable format

Subagents in `.claude/agents/` load their respective persona and skill files
themselves.

## How to invoke

### Scripted setup (recommended)

```bash
export ACTIVE_PRODUCT=Tools
./scripts/run.sh <research-slug> <path-to-input-folder>
```

The input folder must contain a `brief*` file, a `respondents*` file, and a
`transcripts/` subfolder (one file per interview). The script copies everything
into `products/$ACTIVE_PRODUCT/working/<research-slug>/00-inputs/` and prints
the `/agent` sequence, including one interview-analyzer line per transcript.

### Then, in a Claude Code session

Invoke the subagents in order, reviewing between phases:

```
/agent research-intake "working_dir: products/Tools/working/<research-slug>"
```

## The interview loop (Phase 1)

This is the one orchestration step that differs from other pipelines:

1. After Gate A, read the roster table in `01-research-map.md`.
2. For EACH roster row with a matched transcript, invoke:
   ```
   /agent interview-analyzer "transcript: 00-inputs/transcripts/{file}, respondent: {rNN-slug}, working_dir: products/$ACTIVE_PRODUCT/working/{slug}"
   ```
   One invocation per transcript, sequentially. Each invocation starts with
   fresh context — this is what keeps 10-20k-word transcripts manageable and
   respondents uncontaminated by each other.
3. After the FIRST invocation, offer Gate B: spot-check that insights file
   (IDs present, quotes verbatim, tags sane) before spending the remaining N-1
   runs. Calibration here is cheap; re-runs later are not.
4. Before Phase 2, verify `02-insights/` has one file per roster row. Missing
   files → re-run those respondents. Rows with an existing file are SKIPPED on
   re-run (resumability). To redo one interview, delete its insights file and
   re-invoke.

## Human gates

You SHOULD review between phases, especially:

- **Gate A** (after Phase 0) — is the roster right? Wrong segment labels here
  poison every count downstream. Cheapest fix point.
- **Gate B** (after first Phase 1 run, optional) — calibrate extraction quality
  once before processing all transcripts.
- **Gate C** (after Phase 2) — the highest-value review. Rename clusters, merge
  or split them, fix rankings — edit `03-customer-profile.md` directly;
  downstream phases read your edits.
- **Gate D** (after Phase 6, MANDATORY) — read `06-research-report.md`.
  Publication happens ONLY when you explicitly say so. The orchestrator must
  NEVER chain Phase 6 into Phase 7 automatically. The publisher subagent will
  refuse without an explicit go-ahead.

If a phase output looks wrong, fix the file directly. Subsequent phases will
read your fixes.

## When to skip phases

- **`--skip-fit`** — no reliable capability inventory in CONTEXT.md yet, or the
  study is purely exploratory. Hypotheses become problem-level only.
- **`--skip-hypotheses`** — you only want the canvas and report (also skips the
  audit's hypothesis checks).
- **`--skip-audit`** — small studies you'll verify by hand. Not recommended
  before publishing.
- **`--skip-backlog`** — no backlog artifacts needed yet.

## Language policy

- Working artifacts and the report are written in **English**.
- Verbatim quotes stay in the **language spoken** (Ukrainian, English, ...),
  optionally followed by an italic gloss marked *(translation)*.
- The user may address this pipeline in Ukrainian — respond in kind, but write
  files in English.

## Evidence rules (enforced across all phases)

- Insight IDs `INS-{rNN}-{NN}` → cluster IDs `JOB-/PAIN-/GAIN-{n}` → hypothesis
  IDs `HYP-{n}`. Every claim traces down this chain to a verbatim quote.
- **No ID, no item.** Anything without an evidence trail is dropped or labeled
  `INFERENCE — no direct evidence`.
- Counts are respondents (n/N), never mentions.

## Output

Final artifacts in `products/$ACTIVE_PRODUCT/working/<research-slug>/`:

- `06-research-report.md` — the deliverable (Confluence-ready markdown)
- `07-backlog/` — opportunity briefs and epic drafts for manual transfer
- `03-customer-profile.md` / `05-hypotheses.md` — the reviewed analysis layers

## What this agent does NOT do

- Does not create Jira issues — backlog drafts are markdown for manual transfer
  (Jira write tools are denied in `.claude/settings.json`)
- Does not write PRDs — that's `context-to-prd`; backlog drafts point there
- Does not publish to Confluence without an explicit user go-ahead
- Does not fabricate quotes, counts, segments, or capabilities — missing data
  is "TBD", unsupported claims are dropped or labeled inference
- Does not edit or reformat the input transcripts

## Troubleshooting

**A quote in the profile looks paraphrased.**
Run `/agent evidence-auditor` — it greps quotes against source transcripts and
flags anything not found verbatim as a blocker.

**Synthesis missed a theme you saw in an interview.**
Check the respondent's `02-insights/` file first. If the insight is there but
unclustered, look in "Orphan insights" in 03 and edit 03 directly at Gate C.
If it's missing from 02, delete that insights file and re-run Phase 1 for that
respondent.

**Counts look wrong (n/N doesn't match what you remember).**
The auditor recounts every cited cluster. Its "Inflation flags" section names
mismatches with the exact IDs.

**Confluence publish failed.**
See `08-publication-log.md` — it records the exact error. The report stays
complete at `06-research-report.md` and pastes into Confluence manually, or
authenticate the atlassian MCP server and re-invoke confluence-publisher.

**A respondent's transcript was added late.**
Add them to `respondents*` in `00-inputs/`, re-run Phase 0 (it keeps existing
slugs stable — new respondents get new slugs), run Phase 1 for the new file
only, then re-run Phase 2+.
