# Domain Definitions Template (Confluence Format)

> This template defines the main deliverable of the codebase-to-domain-doc
> pipeline. Each section contains:
> - The literal heading (must appear verbatim in output)
> - `<!-- AGENT INSTRUCTIONS -->` comments — these guide the domain-doc-writer
>   agent and MUST be removed from the final output
> - Content placeholder
>
> The document is business-language only: no code identifiers, paths, class or
> table names anywhere. Technical evidence lives in the companion evidence map
> (never published). When porting to Confluence, headings and tables map cleanly.

---

# {Domain area} — Domain Definitions

## Summary

<!--
AGENT INSTRUCTIONS — Summary section:

One table stakeholders can read on its own. Scope: one sentence naming the
domain area covered. Status stays "Draft" until the human marks otherwise.
"Last verified against code" comes from 00-inputs/repo-state.md's capture date —
NEVER invent it. This provenance line is the only near-technical line allowed
in the document.
-->

| | |
|---|---|
| **Scope** | {one sentence: what domain area this covers} |
| **Status** | Draft |
| **Last verified against code** | {YYYY-MM-DD} |

## How to read this document

<!--
AGENT INSTRUCTIONS — How to read section:

2-3 sentences, no more: a nested definition is meaningful within its parent's
context; *(under review)* marks terms whose meaning could not yet be confirmed
against current product behavior. Do not explain the pipeline or the IDs'
origin here.
-->

{2-3 sentences}

## Definitions

<!--
AGENT INSTRUCTIONS — Definitions section:

Hierarchy via heading levels following the registry's D-ID depth exactly:
### D-1 · {Term} → #### D-1.1 · {Term} → ##### D-1.1.1 · {Term}.
Registry order, every registry definition exactly once, nothing added.
Each definition: 1-3 sentences meeting the domain-definition-writing skill's
quality bar. Optional "*Also known as:*" line — business synonyms only.
Definitions with not-found / inferred-only / conflict status keep their best
honest explanation plus the *(under review)* marker after the term.
No code identifiers, ever.
-->

### D-1 · {Term}

{1–3 sentence business explanation}

*Also known as:* {business synonym, or omit the line}

#### D-1.1 · {Term} *(under review)*

{best honest explanation}

## Definitions under review

<!--
AGENT INSTRUCTIONS — Under review section:

One bullet per *(under review)* definition: ID, term, and a one-line
business-friendly reason ("meaning could not be confirmed against the current
product behavior", "the term was not found in the product's documentation").
NO technical detail — what was searched and where lives in the knowledge-gaps
file, not here. If nothing is under review, write "None — all definitions are
confirmed." and keep the section.
-->

- {D-x · Term — one-line reason}

## Glossary index

<!--
AGENT INSTRUCTIONS — Glossary index:

Alphabetical by term, every definition in the document, no exceptions.
This is the Confluence-searchability net — NEVER trim it.
-->

| Term | ID | Parent |
|---|---|---|
| {term} | {D-x} | {parent term or —} |
