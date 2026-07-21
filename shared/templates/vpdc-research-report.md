# VPDC Research Report Template (Confluence Format)

> This template defines the final deliverable of the interviews-to-vpdc pipeline.
> Each section contains:
> - The literal heading (must appear verbatim in output)
> - `<!-- AGENT INSTRUCTIONS -->` comments — these guide the research-report-writer
>   agent and MUST be removed from the final output
> - Content placeholder
>
> When porting to Confluence, headings and tables map cleanly. Verbatim quotes
> stay in the language they were spoken in — an English gloss in italics marked
> *(translation)* may follow.

---

# {Research title}

## Summary

<!--
AGENT INSTRUCTIONS — Summary section:

One table stakeholders can read on its own. Fill from 01-research-map.md.
Respondents cell: "n=8 (5 agency, 3 SMB)" style — counts and segments, no names.
Status: "Draft" until the human marks otherwise. Period: interview date range,
or "TBD" if the brief doesn't state it. NEVER invent dates.
-->

| | |
|---|---|
| **Research question** | {one sentence from the brief} |
| **Respondents** | {n=N (segment breakdown)} |
| **Period** | {date range or TBD} |
| **Status** | Draft |

## Method and respondents

<!--
AGENT INSTRUCTIONS — Method section:

2-4 sentences: interview format, script focus (from the brief), how respondents
were segmented. Then the anonymized roster table — slugs and segments only,
never full names or companies. If the brief describes recruitment, one line on it.
-->

{method paragraph}

| Respondent | Segment | Notes |
|---|---|---|
| r01 | {segment} | {one-line context, e.g. "manages 40 locations"} |

## Customer Profile

<!--
AGENT INSTRUCTIONS — Customer Profile section:

Three ranked tables from 03-customer-profile.md. Preserve the ranking and the
n/N evidence counts exactly — do not re-rank, do not round "3/8" to "many".
Representative quote: verbatim, original language, the strongest single quote
already carried forward in 03. Evidence column: cluster's INS IDs (comma-separated;
truncate to first 3 + "…" if long — the full list lives in the appendix).
-->

### Jobs

| Rank | Job | Type | Evidence | Segments | Representative quote |
|---|---|---|---|---|---|
| 1 | {JOB-n — name} | {functional/social/emotional/supporting} | {INS-…} ({n/N}) | {split} | {verbatim quote} |

### Pains

| Rank | Pain | Severity | Evidence | Segments | Representative quote |
|---|---|---|---|---|---|
| 1 | {PAIN-n — name} | {critical/moderate/minor} | {INS-…} ({n/N}) | {split} | {verbatim quote} |

### Gains

| Rank | Gain | Type | Evidence | Segments | Representative quote |
|---|---|---|---|---|---|
| 1 | {GAIN-n — name} | {required/expected/desired/unexpected} | {INS-…} ({n/N}) | {split} | {verbatim quote} |

## Value Map and Fit

<!--
AGENT INSTRUCTIONS — Value Map and Fit section:

From 04-value-map-fit.md. If the fit phase was skipped, replace this section's
body with a single line: "Fit assessment was not run for this study." — do not
improvise one. Capabilities named here must be the ones sourced from CONTEXT.md
in 04; fit levels are addressed / partially addressed / not addressed /
over-served / unknown. Keep the gap notes short.
-->

| Profile item | Rank | Product capability | Fit | Gap note |
|---|---|---|---|---|
| {PAIN-n} | {rank} | {capability or —} | {fit level} | {one line} |

### Opportunity areas

- {opportunity — cites PAIN-/GAIN- IDs}

## Key insights

<!--
AGENT INSTRUCTIONS — Key insights section:

5-8 numbered narrative findings — the "so what" of the study. Each finding is
2-4 sentences ending with its evidence IDs in parentheses. Draw from the top
clusters, the contradictions, and the coverage check (silence on a scripted
topic can be a key insight). No solutioning here. No finding without IDs.
-->

1. {finding} ({PAIN-2, INS-r01-04, INS-r05-01})

## Contradictions and segment differences

<!--
AGENT INSTRUCTIONS — Contradictions section:

From 03. Each tension: both sides, their segments, their evidence IDs.
If 03 records none, write "No material contradictions surfaced across segments."
— do not delete the section.
-->

- {tension: side A (segment, IDs) vs side B (segment, IDs)}

## Hypotheses

<!--
AGENT INSTRUCTIONS — Hypotheses section:

From 05-hypotheses.md AFTER the evidence audit. Hypotheses the audit marked
"unsupported" move to the "Parked pending evidence" subsection — never silently
dropped, never presented as supported. Keep the We believe / for / will /
know-we're-right wording intact. If the hypotheses phase was skipped, state that
in one line.
-->

| ID | Hypothesis | Evidence | Strength | Impact |
|---|---|---|---|---|
| HYP-1 | {We believe … for … will …} | {cluster IDs (n/N)} | {Strong/Medium/Weak} | {High/Low} |

### Parked pending evidence

- {HYP-n — one-line reason from the audit, or "None."}

## Recommended next steps

<!--
AGENT INSTRUCTIONS — Next steps section:

3-6 bullets max. Tie each to a hypothesis or opportunity area. Typical shapes:
"validate HYP-2 with a pricing test", "draft a PRD for the top opportunity via
the context-to-prd pipeline", "recruit SMB respondents — segment underrepresented
(coverage check)". No effort estimates, no dates unless the brief set them.
-->

- {next step}

## Appendix: evidence index

<!--
AGENT INSTRUCTIONS — Evidence index:

Every INS ID cited anywhere above resolves here. This section makes the report
self-verifying — NEVER trim it to save space. Quotes verbatim, original language.
Sort by respondent, then by insight number.
-->

| ID | Quote (verbatim) | Respondent | Segment |
|---|---|---|---|
| INS-r01-04 | {quote} | r01 | {segment} |
