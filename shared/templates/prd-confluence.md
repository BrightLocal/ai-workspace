# PRD Template (Confluence Format)

> This template mirrors the structure used in this team's Confluence PRDs.
> Each section contains:
> - The literal heading (must appear verbatim in output)
> - `<!-- AGENT INSTRUCTIONS -->` comments — these guide the prd-writer agent
>   and MUST be removed from the final output
> - Content placeholder
>
> When porting back to Confluence, these markdown sections map cleanly to
> Confluence headings. Tables port correctly. Status badges (TESTED & FIXED, etc.)
> are added manually after the PRD is in Confluence — the agent does not generate them.

---

# {Feature Name}

## Summary

<!--
AGENT INSTRUCTIONS — Summary section:

The Summary is a 2x2 matrix of short paragraphs (one or two sentences each):
- The problem
- The solution
- Appetite
- Desired outcome

This is what stakeholders read first. It MUST be readable on its own without
the rest of the PRD.

For SIMPLE features: keep each cell to 1-2 sentences.
For COMPLEX features (like Aggregators): the Desired outcome cell may expand into
4 short bullet points, each one a separate business goal.

DO NOT write the Summary first if the PRD is complex. Write the deeper sections
first, then compress them into the Summary at the end.

For STRATEGY PRDs: emphasize the business model decision in the Solution cell.
For INVESTIGATION/SPIKE PRDs: leave Appetite empty; "Desired outcome" should
say "Validate that X" or "Document Y to inform a go/no-go decision".
-->

| | |
|---|---|
| **The problem** | {one or two sentences naming the pain} |
| **The solution** | {one or two sentences describing the approach} |
| **Appetite** | {e.g., "1 sprint" or "small batch" or empty for investigations} |
| **Desired outcome** | {one short sentence, OR a bulleted list for complex PRDs} |

## Desired outcome

<!--
AGENT INSTRUCTIONS — Desired outcome section:

This is the BUSINESS reason for the PRD. It should answer "if we ship this and
it works, what changes?"

Structure:
- Primary outcome (the North Star contribution)
- Secondary outcomes (supporting effects)

Use observable, measurable language. NEVER use words like "delight", "engagement"
without a metric. Always pair with a number when known: "Increase renewal rate
(target: 20% → 25%+)".

If the PM doesn't know the current baseline, write: "Increase X (current: TBD)".
NEVER fabricate baselines.

For INVESTIGATION PRDs, the desired outcome is about LEARNING, not about behavior
change. Example: "Validate that Data Axle APIs can support BrightLocal use cases
for location submission and status tracking."
-->

### Primary outcome
{...}

### Secondary outcomes
- {...}
- {...}

## The problem

<!--
AGENT INSTRUCTIONS — The problem section:

Format depends on PRD type:

IMPLEMENTATION PRD: numbered list of distinct causes/aspects of the problem.
Each numbered item has a heading-like name and 2-3 lines of explanation. See
Aggregators ("Fragmented renewal experience" / "System constraints" / "Financial
model constraints") and Connect & Sync (5 numbered points).

STRATEGY PRD: prose with embedded bullets, focusing on the strategic tension
or trade-off being addressed.

INVESTIGATION PRD: prose listing the unknowns that motivate the investigation.
"Before committing to a full public integration: We need to understand whether..."
is the canonical pattern.

WHAT NOT TO DO:
- Do not describe the solution here. The problem section ONLY describes pain.
- Do not introduce new vocabulary that hasn't appeared in the input.
- Do not soften pain with vague language. "Users are confused" is OK only if you
  back it up with what they're confused about.

CONCRETE EXAMPLES are gold. "DataAxle expires Jan 2026, Neustar expires March 2026"
makes the fragmentation problem real. Use them whenever the input provides them.
-->

{...}

## The solution

<!--
AGENT INSTRUCTIONS — The solution section:

Structure follows complexity:

SIMPLE solutions (one approach, few moving parts): prose with bullet points.

MEDIUM solutions: lettered subsections (A, B, C, D) with bullets inside.
See Connect & Sync — A) Replace separate surfaces, B) Make value visible, etc.

COMPLEX solutions (multiple components or phases): decimal numbering (1.1, 1.2, 1.3,
2.1, 2.2). See Aggregators (Purchase Model 1.1-1.3, Renewal Model 2.1-2.4).

PHASED solutions: explicit "Phase 1 / Phase 2 / Phase 3" headings with phase status
("blocked by", "TBC", "no implementation commitment"). See DataAxle.

CORE PRINCIPLES that may appear at the top of the solution:
"Core principle: Keep it simple" — this is a Shape Up convention. Use sparingly
and only when the input clearly conveys this kind of design constraint.

WHAT TO INCLUDE:
- The mechanic of the solution (how it works)
- Specific UX choices that matter for the outcome ("Bundle = same start date
  → aligned renewal date — main lever to reduce fragmentation")
- Edge cases the solution handles or explicitly defers
- Naming and copy decisions when they're load-bearing

WHAT NOT TO INCLUDE:
- Implementation details (database schema, API contracts) — those go to tech design
- Story points or estimates — those don't exist in Shape Up
- Designs themselves — those go in the Designs section as a Figma link
-->

{...}

## Designs

<!--
AGENT INSTRUCTIONS — Designs section:

This is usually a Figma link or "TBD" placeholder. The agent does NOT generate
designs.

If the input mentions specific UI elements that would benefit from a sketch (e.g.,
"two adjacent controls in the same visual row"), the agent may include a brief
ASCII or text description, but this is rare. Mostly: "Designs: [Figma link]" or
"Designs: TBD".
-->

{...}

## Data and metrics

<!--
AGENT INSTRUCTIONS — Data and metrics section:

This is the section the Analyst critic cares about most. The standard structure
(see Connect & Sync for the canonical example):

1. A table with columns: Metric type | Metric | Why it matters
   - Metric types: North Star, Primary feature metric, Secondary, Guardrail
   - Each row has a short specific metric name and a 1-line "why it matters"

2. A "Minimum events" subsection — list of snake_case event names that MUST fire

3. A "Required properties" subsection — what each event needs to carry
   (integration, location_id, customer_id, plan_context where relevant)

4. A "Diagnostics" subsection — what slices/cuts the team will look at
   (drop-off by integration, time-to-X, etc.)

For STRATEGY PRDs, this section can be lighter — sometimes just the metric table.
For INVESTIGATION PRDs, this section may say: "The integration should provide
enough visibility to: [list]" rather than a metrics table.

WHAT NOT TO DO:
- Don't list 20 events when 5 capture the funnel
- Don't reuse vague metric names ("engagement", "satisfaction") without operationalizing
- Don't skip the "Why it matters" column — it's a forcing function for clarity
-->

| Metric type | Metric | Why it matters |
|---|---|---|
| North Star | {...} | {...} |
| Primary feature metric | {...} | {...} |
| Secondary | {...} | {...} |

### Minimum events
- `{event_name_1}`
- `{event_name_2}`

### Required properties
- `integration` (when relevant)
- `location_id`
- `customer_id`
- `plan_context` (when premium gating is relevant)

### Diagnostics
- {...}
- {...}

## User stories (optional)

<!--
AGENT INSTRUCTIONS — User stories section:

NOTE the "(optional)" in the heading. Not every PRD has user stories. SKIP this
section entirely if:
- The PRD is a pure investigation/spike with no user-facing behavior
- The work is internal-only (e.g., internal API for an internal team)

If user stories ARE included, format is a Confluence-style table:

| Summary | User story | Acceptance criteria |

Where:
- "Summary" is a short tag (e.g., "Purchase", "Activation", "Renewal", or
  "Internal CB Integration") used for grouping
- "User story" is the standard "As a [role], I want to [action], so that [outcome]"
- "Acceptance criteria" is either a bullet list of conditions, or a list of
  related Jira tickets (LM-XXXX) — DO NOT generate Jira ticket numbers, leave
  them as placeholders or omit.

Mark optional features with "[Nice to have]" prefix in the user story column.

If a user story has been superseded by a different decision, mark it
"NO VALID ANYMORE: [reason]" rather than deleting. See DataAxle PRD for examples.

WHAT NOT TO DO:
- Don't generate fake Jira ticket numbers. Leave acceptance criteria as plain
  bullets unless the input explicitly mentions tickets.
- Don't write user stories for internal/technical work that has no user. Use
  "As a CB engineer..." or "As a SysAdmin..." when the user is internal —
  but only if that user has agency in the system.
- Don't pad the table. 5 strong stories beat 15 weak ones.
-->

| Summary | User story | Acceptance criteria |
|---|---|---|
| {...} | As a {role}, I want to {action} so that {outcome}. | - {...}<br>- {...} |

## Results

<!--
AGENT INSTRUCTIONS — Results section:

This section is FORWARD-LOOKING in the PRD draft. It says what we will measure
post-launch to know if the feature succeeded.

Format: short bullet list of evaluation cuts.

Example (from Connect & Sync):
- North Star change by cohorts (new locations vs existing).
- CTR uplift and connected conversion by integration.
- Change in early funnel drop-off.

For INVESTIGATION PRDs, "Results" describes the artifacts of the investigation:
"At the end of this phase, we expect to have: Working PoCs for X, Documented
understanding of Y, A clear recommendation on Z."

After the feature ships and data comes in, this section is updated WITH the
actual results — but that's a manual step, not the agent's job.
-->

After release (with sufficient traffic), evaluate:
- {...}
- {...}

## Anything else?

<!--
AGENT INSTRUCTIONS — Anything else? section:

This is the catch-all for risks, dependencies, edge cases, and notes that don't
fit elsewhere. Common contents:

- Risks (with mitigations)
- Dependencies on other teams or systems
- Decisions explicitly deferred ("White-label support: TBD in next iteration")
- Privacy/compliance notes
- Open questions

If there's nothing to add, this section can be empty or simply say
"None at this time." Don't manufacture content.
-->

### Risks
- {risk}: {mitigation}

### Open questions
- {...}
