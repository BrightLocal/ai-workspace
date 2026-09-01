---
name: vpdc-canvas
description: Use when building a Value Proposition Design Canvas from extracted interview insights — clustering into a Customer Profile (Jobs / Pains / Gains), mapping the Value Map (Products & Services / Pain Relievers / Gain Creators), and assessing Fit. Required reading for the profile-synthesizer and value-map-fitter subagents.
---

# Skill: Value Proposition Design Canvas (VPDC)

## When to use this skill

Two phases of interview analysis use this skill:

1. **Customer Profile synthesis** — clustering per-interview insight files into
   ranked Jobs, Pains, and Gains across all respondents.
2. **Value Map and Fit assessment** — mapping existing product capabilities
   against the profile and locating the gaps.

Input for phase 1 is extracted insight files (`INS-` items), never raw
transcripts. Input for phase 2 is the finished Customer Profile plus the
product's `CONTEXT.md`.

## Customer Profile

The profile has three blocks (Osterwalder):

- **Jobs** — what customers are trying to get done (functional, social,
  emotional, supporting).
- **Pains** — bad outcomes, obstacles, and risks they experience while doing
  those jobs.
- **Gains** — outcomes and benefits they require, expect, desire, or would be
  surprised by.

### Clustering rules

- Cluster by **underlying need**, not by wording. "Reports look unprofessional"
  and "I rebuild exports in Slides" belong to the same pain cluster; "sync broke
  silently" does not.
- Name clusters in the **respondents' own vocabulary** — lift a phrase from a
  quote where possible. Avoid abstraction-speak ("suboptimal reporting UX").
- One cluster records: ID (`JOB-{n}` / `PAIN-{n}` / `GAIN-{n}`), name, subtype
  (or severity for pains), **evidence ID list**, **respondent count as n/N**,
  **segment split**, and 1–2 representative quotes carried forward verbatim.
- A cluster with no `INS-` evidence does not exist. If you believe something is
  true but no insight supports it, label it `INFERENCE — no direct evidence` and
  keep it out of the ranked lists.
- Single-respondent clusters are allowed but must be tagged `n=1`.
- Prompted-only clusters (all evidence flagged `Prompted: yes`) must say so —
  they are candidates, not findings.

### Ranking rules

- Jobs rank by **importance**, pains by **severity**, gains by **relevance**.
- Primary sort: respondent count. Tie-break: intensity signals (workarounds,
  time/money quantified, emotion) — never your own sense of importance.
- Severity of a cluster is the severity supported by evidence, not the maximum
  any single respondent expressed.
- Never rank by loudest respondent. One vivid quote does not outrank three
  quiet confirmations.

### Contradictions are mandatory output

A profile without a "Contradictions and tensions" section is incomplete.
Segments disagreeing (agencies want X, SMBs fear X) is a first-class finding.
Record both sides with their evidence IDs and segments.

### Coverage check

Compare the clusters against the research goals and interview script topics.
Report:
- script topics that produced **no** insights (silence is a finding),
- respondents contributing zero insights to the top clusters (are they a
  different segment, or was the interview thin?).

## Value Map

Three blocks, built strictly from documented product reality:

- **Products & Services** — capabilities listed in
  `products/{ACTIVE_PRODUCT}/CONTEXT.md`. Every entry cites where in CONTEXT.md
  it comes from. **Inventing a capability is fabrication** — if you are not sure
  the product does something, it is not on the map.
- **Pain Relievers** — how a listed capability addresses a specific `PAIN-{n}`.
- **Gain Creators** — how a listed capability produces a specific `GAIN-{n}`.

A reliever/creator entry without both a capability source and a profile ID is
invalid.

## Fit assessment

For every ranked profile item, assign one fit level:

| Fit level | Meaning |
|---|---|
| `addressed` | An existing capability clearly covers it |
| `partially addressed` | Covered with caveats, workarounds, or for some segments only |
| `not addressed` | No existing capability covers it |
| `over-served` | Capability exists but no respondent evidence values it |
| `unknown` | CONTEXT.md is silent — do not guess |

The **opportunity list** is the `not addressed` (and weak `partially addressed`)
items with the highest severity/importance. Each opportunity cites its profile
IDs. No invented fit percentages, no scores pulled from the air.

## Common pitfalls

- **Clustering by keyword instead of need** — two quotes containing "report"
  may describe different pains.
- **Smoothing contradictions into an average** — surface the split instead.
- **Counting mentions instead of respondents** — n/N counts unique respondents.
- **Value Map wishfulness** — mapping a capability the product "sort of" has.
  `partially addressed` with a caveat beats an optimistic `addressed`.
- **Dropping orphan insights silently** — unclustered but notable insights go
  to an "Orphans" section, not the void.

## Self-check before finishing

- [ ] Every cluster has an ID, evidence list, n/N count, and segment split?
- [ ] Ranking follows respondent count, tie-broken by intensity — and says so?
- [ ] Contradictions section present (or explicitly "none found")?
- [ ] Coverage check present — silent script topics reported?
- [ ] Every Value Map entry cites CONTEXT.md and a profile ID?
- [ ] No fit level guessed where CONTEXT.md is silent (`unknown` used)?
- [ ] Representative quotes carried forward verbatim, original language?
- [ ] Zero solutioning — no feature proposals anywhere in the profile?
