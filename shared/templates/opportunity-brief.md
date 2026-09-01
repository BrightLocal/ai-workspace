# Opportunity Brief Template

> Used by the interviews-to-vpdc backlog-drafter. One brief per opportunity area.
> `<!-- AGENT INSTRUCTIONS -->` comments MUST be removed from the final output.
> The DRAFT banner MUST be kept — these files are for manual transfer to the
> backlog; the pipeline never creates Jira issues.

---

> **DRAFT — for manual transfer to the backlog. This pipeline does not create Jira issues.**

# Opportunity: {name}

## Linked hypotheses

<!--
AGENT INSTRUCTIONS: list the HYP IDs this opportunity rests on, with their
strength labels. An opportunity with only Weak hypotheses should say
"research first" in Suggested next step.
-->

- {HYP-n — name (Strength)}

## The problem

<!--
AGENT INSTRUCTIONS: 2-4 sentences from the profile clusters — the pain/job in
the respondents' vocabulary, with evidence IDs and n/N counts inline. One
verbatim quote max. No solutioning in this section.
-->

{problem statement} ({PAIN-n, n/N})

## Who has it

{segment, with its size in the study — e.g. "Agency segment (5/8 respondents)"}

## Evidence summary

| Cluster | n/N | Severity/Type | Key insight IDs |
|---|---|---|---|
| {PAIN-n — name} | {n/N} | {severity} | {INS-…} |

## Possible solution directions

<!--
AGENT INSTRUCTIONS: 2-4 bullets, explicitly non-committal — directions, not
designs. If a respondent suggested a feature, it may appear here attributed as
their suggestion. Mark speculative directions clearly.
-->

- {direction — non-committal}

## Suggested next step

<!--
AGENT INSTRUCTIONS: exactly one of: "Validate: {what and how}" (Weak/Medium
evidence), "Spike: {question to resolve}" (feasibility unknown), or
"Draft a PRD via the context-to-prd pipeline" (Strong evidence + clear fit gap).
-->

{next step}
