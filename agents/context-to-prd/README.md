# context-to-prd Agent

Transforms free-form input (notes, transcripts, ideas) into a draft PRD that
follows this team's Confluence template.

## What it does

Takes raw context (e.g., "we need a way for users to renew all their aggregators
at once because right now they expire on different dates and it's confusing")
and produces a structured PRD with all the team's standard sections — problem,
solution, appetite, desired outcome, metrics, user stories, results.

## What it does NOT do

- Does not generate Jira tickets — `jira-to-pr` agent does that.
- Does not draft designs — Designs section will say "TBD".
- Does not estimate engineering — beyond Shape Up appetite.
- Does not invent metrics or baselines — flags them as TBD instead.

## How it works

Four phases, each in its own subagent context window. Phases communicate via
files in the working directory.

```
Input (free context)
    ↓
Phase 1: context-analyzer (PM perspective)  →  01-context.md
    ↓
Phase 2: metrics-checker (Analyst critic)   →  02-metrics-review.md
    ↓
Phase 3: prd-writer (PM, template-bound)    →  03-prd.md
    ↓
Phase 4: feasibility-reviewer (Architect)   →  appends to 03-prd.md
    ↓
Final: 03-prd.md (ready for human review and Confluence paste)
```

## Quick start

### 1. Prepare your input

Create a markdown file with your raw context. It can be:
- Meeting notes
- Voice memo transcript
- A Slack thread copy-pasted
- A single paragraph idea
- A doc someone sent you

The agent handles messy input — that's the point.

Save it somewhere, e.g., `~/scratch/aggregators-renewal-input.md`.

### 2. Pick the active product

```bash
export ACTIVE_PRODUCT=Tools   # or pet-project
```

### 3. Run the pipeline

From the workspace root:

```bash
./agents/context-to-prd/scripts/run.sh \
    aggregators-renewal-flow \
    ~/scratch/aggregators-renewal-input.md
```

The script:
- Creates `products/$ACTIVE_PRODUCT/working/aggregators-renewal-flow/`
- Copies your input to `00-input.md`
- Prints the Claude Code invocations to run in sequence

### 4. Run the subagents

In Claude Code (from the workspace root):

```
/agent context-analyzer
> read products/BrightLocal/working/aggregators-renewal-flow/00-input.md and produce 01-context.md
```

After Phase 1 completes, review `01-context.md`. If the analyzer misunderstood
something, fix the file directly before continuing — Phase 2 and 3 will read
your corrections.

```
/agent metrics-checker
> review the context for measurability and produce 02-metrics-review.md
```

```
/agent prd-writer
> read 01-context.md and 02-metrics-review.md and write the PRD to 03-prd.md
```

```
/agent feasibility-reviewer
> review the PRD for feasibility and append your findings
```

### 5. Final review and paste

Open `products/$ACTIVE_PRODUCT/working/aggregators-renewal-flow/03-prd.md`.
- Read the PRD top to bottom
- Read the architect's review at the bottom
- Decide what to incorporate from the review
- Strip the architect's review section if you're pasting only the PRD
- Strip any `<!-- prd-writer note: -->` HTML comments
- Paste the rest into a new Confluence page

## Skip flags

For investigation/spike PRDs that don't have measurable outcomes:
```bash
./scripts/run.sh feature-slug input.md --skip-metrics
```

For strategy PRDs that don't propose specific implementation:
```bash
./scripts/run.sh feature-slug input.md --skip-feasibility
```

For full human-gated workflow with explicit pause prompts:
```bash
./scripts/run.sh feature-slug input.md --interactive
```

## Inspecting outputs

Every phase writes a file. You can read them all and trace the agent's reasoning:

```
products/BrightLocal/working/aggregators-renewal-flow/
├── 00-input.md             ← your raw input
├── 01-context.md           ← what the PM-analyzer extracted
├── 02-metrics-review.md    ← what the analyst flagged
└── 03-prd.md               ← final PRD + appended architect review
```

If a phase output looks wrong, fix the file directly. Subsequent phases will
read your fixes.

## When to bypass the pipeline

Sometimes you don't need the whole pipeline. Examples:

- **Quick PRD revision** — just open `03-prd.md` and `/agent prd-writer` to
  rewrite a specific section.
- **Just metrics review** — paste an existing PRD as `03-prd.md` and run only
  Phase 2.
- **Architect critique on someone else's PRD** — paste it as `03-prd.md` and
  run only Phase 4.

The agent files are independent — you can call any of them on any input that
fits their description.

## Tuning

If outputs consistently miss your team's voice, edit:
- `shared/personas/product-manager.md` — for PM voice
- `shared/templates/prd-confluence-examples.md` — add more examples
- `shared/domain/local-seo.md` — for vocabulary

If outputs are technically wrong about your product, edit:
- `products/BrightLocal/CONTEXT.md` — product-specific facts go here

## Troubleshooting

See `CLAUDE.md` in this directory for more troubleshooting tips.
