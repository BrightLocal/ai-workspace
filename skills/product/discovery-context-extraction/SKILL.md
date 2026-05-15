---
name: discovery-context-extraction
description: Use when reading free-form input (notes, transcripts, ideas) and extracting structured product context — problem statement, persona, JTBD, constraints, success criteria. Required reading for the context-analyzer subagent.
---

# Skill: Discovery Context Extraction

## When to use this skill

Whenever you have unstructured input that needs to become a structured starting
point for product work. Typical inputs:

- Meeting notes (often messy, context-light)
- Voice memo transcripts (run-on sentences, missing punctuation)
- Slack thread copies (multiple voices, async fragments)
- A one-paragraph idea (high-level, lacking specifics)
- A bug report that's actually a feature request in disguise

The output is structured context — NOT a PRD. The PRD comes later.

## Six elements to extract

Every extraction targets these six elements. Any that you can't fill in becomes
an explicit gap, not a guess.

### 1. Implicit problem statement

What pain is being described? In one or two sentences. If multiple distinct
pains, number them.

The problem is rarely stated cleanly. You have to infer it from descriptions of
symptoms, complaints, or workarounds. Examples:

- Input: "DataAxle expires Jan, Neustar expires March, customers keep asking
  why we send them so many renewal emails"
- Extracted problem: "Aggregators are sold as one-off yearly purchases with
  staggered renewal dates, creating fragmented renewal experiences and friction
  for customers managing multiple aggregators."

### 2. Implicit user / persona

Who has this pain? Be specific. "Users" is not specific.

Specificity comes from:
- Role/segment (agency owner, multi-location brand manager, SMB DIY)
- Scale (manages 5 locations vs 500)
- Context (logs in daily vs monthly, technically savvy vs not)
- Relationship (paying customer, free trial, churned)

If the input only says "users", you flag this as an open question.

### 3. Implicit job-to-be-done

What is the user trying to accomplish? Phrase as verb-driven outcome.

Bad: "User wants to manage aggregators."
Good: "Renew all my aggregator subscriptions before they expire without thinking
about each one separately."

The JTBD names the OUTCOME the user wants, not the FEATURE you might build.

### 4. Implicit constraints

What constraints does the input mention or imply?

- **Business model** — subscription vs one-time? per-location pricing? plan tiers?
- **Technical** — existing systems mentioned? known limitations (e.g., "Braintree
  doesn't support yearly add-ons on monthly subscriptions")?
- **Organizational** — which team owns this? dependencies on other teams?
- **Time/urgency** — calendar pressure? specific deadlines? quarterly goals?

Constraints are clues to what's NOT possible, which shapes what IS.

### 5. Implicit success criteria

What would "good" look like? What metric or behavior would change?

If the input doesn't say, ask: how would WE know this worked? Sometimes the
input has language like "we're losing customers" — extract that as "reduce
churn rate" and flag whether a baseline exists.

If you can't infer success criteria at all, that's a major gap — flag it
prominently.

### 6. PRD type signal

What TYPE of PRD does this input lead to?

- **Implementation** — feature is shaped, ready to spec. Has design or design is
  imminent. Has clear metrics. "We need to add X to Y screen so users can do Z."
- **Strategy** — business model or approach decision. "Should we sell aggregators
  as subscription or one-time? Should we bundle?"
- **Investigation/Spike** — uncertainty needs resolving. "We need to figure out
  if X API can support Y. We need to validate before committing."

If the signal is mixed (e.g., "we want to launch X — but we're not sure if Y
provider can support it"), flag both signals and let the human PM decide.

## Distinguishing signal from noise

In real input, you'll encounter:
- **Signal** — actual problem, persona clues, constraints, success criteria
- **Noise** — opinions about other features, complaints about unrelated things,
  team gossip, jokes
- **Embedded decisions** — "and obviously we should use Braintree" (might be
  signal, might be premature solutioning)

Rules:
- Preserve embedded decisions as constraints, BUT flag them as "stated but
  unvalidated"
- Discard noise but note "the input mentions X but it doesn't seem related"
- Don't aggressively summarize — quote specific phrases when they're load-bearing

## Handling contradictory input

Real input often contradicts itself. Examples:
- One person in the meeting says "we want to consolidate all renewal dates"
- Another says "actually no, aligning dates breaks our financial model"

Don't smooth this over. Surface the contradiction:

> The input contains conflicting signals on renewal date alignment:
> - Voice A: "consolidate all renewal dates so users see one renewal moment"
> - Voice B: "preserve independent dates because alignment breaks upfront yearly
>   payment to aggregators"
>
> Open question: which direction does the team prefer?

This is more useful than picking one and pretending the other voice didn't exist.

## Output structure

The context-analyzer subagent uses this structure (defined in its agent file).
The skill encodes the THINKING; the subagent encodes the FORMAT.

Key principle: every assertion in the output should be traceable back to the
input. If you can't quote or paraphrase a source for a claim, it's an inference
— mark it as such.

## Calibration: when to push back vs proceed

You should ALWAYS proceed and produce structured output. But the level of
confidence you express varies:

**High confidence**: input is clear, persona is specific, problem is named,
constraints are explicit. Output reads as a clean structured doc.

**Medium confidence**: input has gaps but you can fill them with reasonable
inferences. Output includes inferences clearly labeled.

**Low confidence**: input is fragmentary or contradictory. Output is short, with
many "TBD — needs clarification" markers and a prominent "Open questions"
section at the top.

Even at low confidence, you produce output. The output's value is showing the
PM what's missing, not pretending you have answers.

## Self-check before finishing

- [ ] Did I extract all 6 elements (or explicitly flag missing ones)?
- [ ] Are claims traceable to specific phrases in the input?
- [ ] Did I distinguish explicit signal from inferences?
- [ ] Did I preserve contradictions instead of smoothing them?
- [ ] Did I flag my low-confidence inferences for the PM to validate?
- [ ] Did I avoid inventing details (specific numbers, dates, ticket IDs)?
- [ ] Did I use Local SEO vocabulary correctly without over-explaining?
