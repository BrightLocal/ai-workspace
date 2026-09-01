---
name: interview-insight-extraction
description: Use when mining a single user-interview transcript for atomic, evidence-linked insights tagged as Job / Pain / Gain (VPDC taxonomy). Required reading for the interview-analyzer subagent.
---

# Skill: Interview Insight Extraction

## When to use this skill

Whenever you process ONE interview transcript into a structured insights file.
This skill covers a single transcript at a time — cross-interview synthesis is a
different skill (`vpdc-canvas`). Typical inputs:

- A recorded-call transcript (two or more speakers, timestamps or not)
- Auto-generated transcripts (imperfect punctuation, misattributed lines)
- Interview notes taken live (fragmentary, interviewer shorthand)

The output is a list of atomic insights — NOT a summary, NOT themes, NOT
recommendations. Themes come later, from someone who sees all interviews.

## What an atomic insight is

One insight = one need, one pain, or one gain, held by this one respondent.

Tests for atomicity:
- If you can split it into two statements that could be true independently, split it.
- If it needs the word "and" to be accurate, it is probably two insights.
- If it describes the respondent's context rather than a need/pain/gain
  (e.g., "manages 40 locations, team of 3"), tag it `Context`, not J/P/G.

Bad (compound): "Struggles with reporting and wants better GBP sync."
Good (two insights): one Pain about report assembly, one Job about keeping GBP
listings accurate.

## VPDC tagging taxonomy

Every insight gets exactly one primary tag:

- **Job** — something the respondent is trying to accomplish. Subtype it:
  - `functional` — a task ("keep NAP consistent across 200 listings")
  - `social` — how they want to be perceived ("look proactive in front of clients")
  - `emotional` — how they want to feel ("stop worrying that a listing silently broke")
  - `supporting` — buying/setup/co-creation jobs ("compare tools before renewing")
- **Pain** — a bad outcome, obstacle, or risk. Assign severity from the
  respondent's own signals:
  - `critical` — costs significant time/money, has a workaround, or provokes
    strong emotion
  - `moderate` — annoying, recurring, but tolerated
  - `minor` — mentioned once, low intensity
- **Gain** — an outcome or benefit they want or enjoy. Subtype it:
  - `required` — without it the solution doesn't work for them
  - `expected` — basic, assumed ("reports should look professional")
  - `desired` — would love it, asks for it
  - `unexpected` — delight they didn't know to ask for
- **Context** — segment facts, environment, tool stack, scale. Not ranked later,
  but essential for segmentation.

When a respondent proposes a FEATURE ("you should add a PDF export button"),
do not tag the feature. Extract the underlying pain or job it points to, and note
the proposed feature in the insight body as the respondent's suggestion.

## Quote selection rules

Every J/P/G insight carries at least one verbatim quote:

- **Verbatim means verbatim.** Original language, original words, including
  filler if it carries intensity. Never cleaned up, never translated in place.
- An English gloss may follow the quote in italics, explicitly marked
  *(translation)*.
- Include the interviewer's question above the quote when the answer is
  meaningless without it.
- Prefer quotes about **past behavior** ("last month I...") over opinions
  ("I think...") over hypotheticals ("I would...").
- Record a rough location (timestamp, or "~2/3 through, reporting section")
  so the quote can be found again.

## ID assignment

- IDs follow `INS-{rNN}-{NN}`: respondent slug from the research map (`r01`,
  `r02`, ...) plus a sequential number within this interview (`INS-r03-07`).
- Numbers are sequential in transcript order and are NEVER reused or renumbered,
  even if you delete a draft insight — gaps are fine, collisions are not.

## The `Prompted` flag

Mark `Prompted: yes` when the insight comes from an answer to a leading or
closed question ("Would you use X?", "Is reporting painful for you?").
Mark `Prompted: no` when the respondent raised the topic or the question was
open ("Walk me through your Monday"). Downstream ranking discounts prompted
insights; hiding the flag corrupts the whole pipeline.

## How many insights

Target 15–40 per interview. Under 15 usually means you summarized instead of
extracting; over 40 usually means you recorded conversational filler. When over
budget, prioritize: behavior-backed pains > jobs > gains > context.

## Common pitfalls

- **Paraphrasing inside quote blocks.** The quote line is sacred. If you need to
  shorten, use ellipses `[...]` and keep the surrounding words exact.
- **Tagging a feature request as a pain.** "Wants a bulk edit button" is not a
  pain; "spends a day per client updating hours one location at a time" is.
- **Severity inflation.** A single mention without intensity signals is `minor`,
  even if it sounds important to you.
- **Extracting the interviewer.** Interviewer summaries ("so what I'm hearing
  is...") are not evidence, even when the respondent says "yeah".
- **Losing the segment.** Always carry the respondent's segment from the research
  map into the file header — synthesis is blind without it.

## Self-check before finishing

- [ ] Every insight has an `INS-{rNN}-{NN}` ID, a primary tag, and (for J/P/G) a verbatim quote?
- [ ] Quotes are in the original language, untranslated, unpolished?
- [ ] Every quote has a rough location in the transcript?
- [ ] Prompted answers are flagged `Prompted: yes`?
- [ ] No compound insights that should be split?
- [ ] Feature requests converted to underlying needs, with the suggestion noted?
- [ ] Insight count is 15–40 (or a stated reason why not)?
- [ ] The file header carries respondent slug, segment, and source transcript filename?
