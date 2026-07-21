---
name: hypothesis-writing
description: Use when converting research findings (VPDC profile clusters, fit gaps) into testable product hypotheses with explicit evidence strength and prioritization. Required reading for the hypothesis-generator subagent.
---

# Skill: Hypothesis Writing

## When to use this skill

After research synthesis, when findings need to become statements the team can
bet on, test, and falsify. Input is a Customer Profile (and, when available, a
fit assessment). Output is a prioritized hypothesis list — NOT a roadmap, NOT
a PRD, NOT solution specs.

## The canonical format

Every hypothesis is one block:

```markdown
### HYP-3 — {short memorable name}

**We believe** {addressing pain X / enabling job Y / building change Z}
**for** {specific segment — never "users"}
**will** {observable behavior or outcome change}.
**We'll know we're right if** {signal: metric direction, test result, or observed behavior}.

Evidence: PAIN-2 (5/8 respondents, both segments), GAIN-1 (3/8)
Strength: Strong · Impact: High · Type: problem
```

Rules:
- The **for** line names a segment from the research, with its size in the data.
- The **will** line describes a change someone could observe, not an internal
  state ("users feel more confident" fails; "support tickets about X drop" passes).
- The **know we're right if** line must be falsifiable — a result that could
  come back negative. If no imaginable result would kill the hypothesis, it is
  not a hypothesis.
- Baselines you don't have are written as "current: TBD", never invented.

## Evidence strength scale

- **Strong** — 3+ respondents across ≥2 segments, or behavior-backed evidence
  (workarounds, money spent) from 3+ respondents in one segment.
- **Medium** — 2–3 respondents, single segment, at least one unprompted.
- **Weak** — a single respondent, or prompted-only evidence. Allowed, but
  labeled — a Weak hypothesis is a candidate for more research, not for building.

Strength is computed from the cited clusters' n/N counts and prompted flags —
it is not a feeling.

## Problem vs solution hypotheses

- **Problem hypothesis** — asserts a pain/job matters enough to act on.
  "We believe staggered aggregator renewals cause churn-risk frustration for
  agencies..." Prefer these when fit data is thin or the pain is newly discovered.
- **Solution hypothesis** — asserts a specific intervention will move an outcome.
  Only justified when the problem is already Strong and the fit gap is clear.

Writing a solution hypothesis on Weak problem evidence is the classic failure
mode — flag it rather than commit it.

## Prioritization

Rank by **evidence strength × estimated impact**, presented as a 2×2 table:

| | High impact | Low impact |
|---|---|---|
| **Strong evidence** | Act — top of the list | Quick wins if cheap |
| **Weak evidence** | Research first — do not build | Park |

Impact estimation may reference business context (segment size, revenue link)
but never invents numbers — "impact: High (agency segment, retention link) —
sizing TBD" is the standard.

## Discarded candidates

Ideas that failed the evidence bar are recorded in a "Discarded candidates"
section with one line of reasoning each. Preserving what you rejected and why
is this team's pattern (see the NO VALID ANYMORE convention in
`shared/domain/shape-up-method.md`) — it stops the same idea from being
re-litigated next quarter.

## Common pitfalls

- **Restating a pain as a hypothesis.** "Users find reporting painful" is a
  finding. A hypothesis says what change would follow from acting on it.
- **Unfalsifiable outcomes.** "Improve the experience" cannot come back negative.
- **Evidence-free strategy hypotheses.** "We believe going upmarket..." needs
  research citations like everything else.
- **Segment laundering.** Evidence from agencies, hypothesis "for all users".
- **Solution smuggling.** A problem hypothesis whose name is a feature
  ("HYP-2 — bulk edit button") has already decided the solution.

## Self-check before finishing

- [ ] Every hypothesis follows the We believe / for / will / know-we're-right format?
- [ ] Every hypothesis cites cluster IDs with n/N counts?
- [ ] Strength assigned per the scale, from counts — not vibes?
- [ ] The "know we're right if" line is falsifiable in every block?
- [ ] No invented baselines or sizing — "TBD" used instead?
- [ ] Weak-evidence + high-impact items marked "research first", not "build"?
- [ ] Discarded candidates section present with reasons?
