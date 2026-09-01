# interviews-to-vpdc

Turns a folder of user-interview transcripts into a Value Proposition Design
Canvas analysis: evidence-linked insights per interview, a ranked Customer
Profile (Jobs / Pains / Gains), a Value Map fit assessment against the product,
testable hypotheses, a Confluence-ready research report, and backlog artifact
drafts. Every claim traces back to a verbatim quote — the pipeline is built so
you can audit any line of the report down to the transcript.

## Input folder convention

Prepare one folder per study:

```
~/Research/q3-agency-churn/
├── brief.md           # research goals + interview script (any name matching brief*)
├── respondents.md     # respondent list with segments (any name matching respondents*)
└── transcripts/
    ├── interview-oksana.md    # one file per interview (md or txt)
    ├── interview-james.txt
    └── ...
```

The respondent list should give each person a label and a segment. Filenames in
`transcripts/` should be recognizably related to those labels — Phase 0 matches
them and asks (via the Anomalies section) when it can't.

## Quick start

```bash
cd ai-workspace
export ACTIVE_PRODUCT=Tools
./agents/interviews-to-vpdc/scripts/run.sh q3-agency-churn ~/Research/q3-agency-churn/
```

The script copies inputs into
`products/$ACTIVE_PRODUCT/working/q3-agency-churn/00-inputs/` and prints the
exact `/agent` invocations to run in a Claude Code session — including one
`interview-analyzer` line per transcript.

Flags: `--skip-fit`, `--skip-hypotheses`, `--skip-audit`, `--skip-backlog`,
`--interactive` (prints explicit human-gate pauses).

## Where your review time is best spent

| Gate | After | Worth it? |
|---|---|---|
| A | Phase 0 (roster) | Yes — wrong segments poison every count downstream |
| B | First interview analyzed | Optional — calibrates extraction before the remaining N-1 runs |
| C | Customer Profile | **The big one** — rename/merge/re-rank clusters by editing `03-customer-profile.md` directly |
| D | Final report | Mandatory — nothing is published to Confluence until you explicitly say so |

Between any phases: if an output looks wrong, edit the file. Later phases read
your edits.

## Outputs

```
products/$ACTIVE_PRODUCT/working/{research-slug}/
├── 01-research-map.md        # goals, script topics, roster (r01, r02, ...)
├── 02-insights/              # one file per interview, atomic INS-tagged insights
├── 03-customer-profile.md    # ranked Jobs/Pains/Gains + contradictions
├── 04-value-map-fit.md       # capability mapping + opportunity areas
├── 05-hypotheses.md          # We-believe blocks + evidence audit
├── 06-research-report.md     # the deliverable — Confluence-ready
├── 07-backlog/               # opportunity briefs + epic drafts (manual transfer)
└── 08-publication-log.md     # Confluence publish history
```

## FAQ

**My transcripts are in Ukrainian (or mixed languages).**
Fine. Analysis and artifacts are written in English; quotes stay verbatim in
the original language with an italic *(translation)* gloss.

**How big can a transcript be?**
Each interview is processed in its own subagent invocation with fresh context —
10-20k words per transcript is fine. 5-15 interviews per study is the designed
range.

**One interview was analyzed badly — do I re-run everything?**
No. Delete its file in `02-insights/`, re-invoke `interview-analyzer` for that
one transcript, then re-run Phase 2 onward. Already-analyzed interviews are
skipped automatically.

**Does it create Jira tickets?**
No, by design — Jira write tools are denied in this agent's settings. Backlog
artifacts are markdown drafts you transfer manually. PRD-ready opportunities
point to the `context-to-prd` pipeline.

**Confluence publish failed / MCP not authenticated.**
The report is still complete at `06-research-report.md` and pastes into
Confluence cleanly. Authenticate the atlassian MCP server and re-invoke
`confluence-publisher` — it updates the same page instead of duplicating.
