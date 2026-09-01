# codebase-to-domain-doc

Turns a tree of domain definitions (or a seed list of module names) into a
business-friendly Domain Definitions document grounded in the product
codebases: each definition gets a short explanation both engineers and
business people can read, a separate evidence map ties every definition to
the docs and code that back it, and a knowledge-gaps report says what's
defined but unevidenced, what lives in code but has no definition, and where
docs and code disagree. Built for repos that change faster than their
documentation.

## Input file convention

One file per run, in either of two shapes:

**Tree mode** — `definitions-*.md`, your definitions as indented bullets
(nesting = sub-context):

```markdown
- Reputation Management
  - Review
  - Review Response
  - Auto-Reply Rule
- Listings Sync
  - DataAxle Submission
```

**Seed mode** — `seed-*.md`, module or entity names, one per line:

```markdown
Rm
Lsg
```

In seed mode the pipeline drafts the tree itself from the modules' existing
docs — and stops at a mandatory gate for you to approve it before any
research runs.

## Quick start

```bash
cd ai-workspace
export ACTIVE_PRODUCT=CB    # where the OUTPUT goes — not what gets scanned
./agents/codebase-to-domain-doc/scripts/run.sh cb-domain ~/notes/definitions-cb.md
```

The script copies the input into
`products/$ACTIVE_PRODUCT/working/cb-domain/00-inputs/`, records the current
SHA of each scanned repo, and prints the exact `/agent` invocations to run in
a Claude Code session.

Flags: `--repos Tools,ListingSyncer` (default — which codebases to scan),
`--mode tree|seed` (overrides filename detection), `--skip-gaps`,
`--interactive` (prints explicit human-gate pauses).

## Where your review time is best spent

| Gate | After | Worth it? |
|---|---|---|
| A | Phase 0 (registry) | Yes — **mandatory in seed mode** (the tree was drafted, approve it); in tree mode, wrong nesting here poisons every unit downstream |
| B | First research unit | Optional — calibrates research quality before the remaining N-1 runs |
| C | Document + gaps report | **The big one** — read `03` and `05` side by side, fix wording and *(under review)* items by editing `03-domain-definitions.md` directly |
| D | Before publishing | Mandatory — nothing is published to Confluence until you explicitly say so |

Between any phases: if an output looks wrong, edit the file. Later phases read
your edits.

## Outputs

```
products/$ACTIVE_PRODUCT/working/{domain-slug}/
├── 00-inputs/                    # your input file + repo-state.md (SHAs)
├── 01-definition-registry.md     # the tree with D-IDs, research units, repo index
├── 02-research/                  # one file per research unit, typed evidence
├── 03-domain-definitions.md      # the deliverable — business-clean, Confluence-ready
├── 04-evidence-map.md            # definition → code mapping (internal, never published)
├── 05-knowledge-gaps.md          # gap classes A–E
└── 06-publication-log.md         # Confluence publish history
```

## FAQ

**Why two repos?**
Domain concepts span the Tools monorepo and ListingSyncer (e.g. listings sync
lives in both). `--repos` controls what's scanned; `ACTIVE_PRODUCT` only picks
which product's `working/` receives the output — `ACTIVE_PRODUCT=CB` with the
default repos is the typical setup for Citation Builder domain work.

**Why is my term marked *(under review)*?**
The researcher found no doc or code evidence for it within its search budget.
The gaps report (class A) says exactly what was searched. Either point the
registry at the right module and re-run that unit, or resolve it by hand at
Gate C — the pipeline never silently drops or confirms an unevidenced term.

**How do I refresh the document after the code changes?**
Re-run run.sh with the same slug — it records the new repo SHAs.
`04-evidence-map.md` carries the refresh procedure: re-verify the rows whose
source paths changed, delete and re-run only the affected research units, then
re-run Phase 2+. D-IDs stay stable across refreshes.

**One branch was researched badly — do I re-run everything?**
No. Delete its file in `02-research/`, re-invoke `branch-researcher` for that
one unit, then re-run Phase 2 onward. Completed units are skipped
automatically.

**Does it write documentation into the repos?**
No — codebase writes are denied in this agent's settings. The output lives in
`working/` and goes to Confluence (behind Gate D) or wherever you promote it
manually.

**Does it create Jira tickets?**
No, by design — Jira write tools are denied in this agent's settings.

**Confluence publish failed / MCP not authenticated.**
The document is still complete at `03-domain-definitions.md` and pastes into
Confluence cleanly. Authenticate the atlassian MCP server and re-invoke
`confluence-publisher` — it updates the same page instead of duplicating.
