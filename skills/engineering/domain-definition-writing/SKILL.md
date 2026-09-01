---
name: domain-definition-writing
description: Use when writing business-friendly domain definition documents from codebase research. Covers the definition quality bar, business-language rules, hierarchy and nesting rules, naming drift handling, and pitfalls. Required reading for the domain-doc-writer subagent.
---

# Skill: Domain Definition Writing

## When to use this skill

When writing or revising a Domain Definitions document — a hierarchical
glossary of what the product's concepts mean, readable by both a backend
engineer and an account manager. The document's job is shared vocabulary, not
system documentation: the full DDD module docs (`AGENTS.md` in the repos) own
the technical truth; this document owns the business meaning.

## The definition quality bar

Every definition must pass all of these:

- **The term is a noun phrase** — "Review Response", not "Responding to
  reviews".
- **1–3 sentences.** The first sentence says what the thing IS. Optional
  second/third sentences say who acts on it or benefits from it, and its
  lifecycle — only when that lifecycle is business-meaningful.
- **The day-one test:** a new account manager on their first day understands
  it without asking a follow-up question or opening another document.
- **Evidence-bound:** every claim in the definition traces to the research
  evidence. When evidence covers only part of the meaning, write the covered
  part — never round up to the full story you suspect is true.

## Business-language rules

**Forbidden** in the document:

- Class, table, endpoint, or file names; any camelCase or snake_case
  identifier; `src/` paths
- HTTP verbs, queue/framework/database vocabulary
- "entity", "enum", "DTO", "service", "repository" in their code senses
- Generic filler: "leverage", "robust", "comprehensive", "seamless",
  "holistic" (see the PM persona's forbidden list — it applies here too)

**Allowed** (this is domain language, not tech bleed):

- Product and feature names (Active Sync, Citation Tracker)
- Directory names (Google Business Profile, Yelp, Apple Maps)
- Business statuses spelled as words: "a review can be unread, responded, or
  flagged for action" is domain language; `ReviewStatus::ACTION_REQUIRED` is
  not.

## Hierarchy rules

- **Nest only for context, not for navigation.** A child definition belongs
  under a parent only when the child is meaningful ONLY inside the parent's
  context ("Review Response" under "Review"). If a concept stands on its own,
  it is a sibling, not a child.
- **Lifecycle states are not children.** Statuses of a concept belong inside
  that concept's explanation, not as nested definitions.
- **Max depth 3** (D-1.1.1). Deeper nesting means the tree is modeling the
  code structure, not the domain.
- **2–9 children per parent.** One child means the split is artificial; ten+
  means a middle layer is missing.
- **Sibling coherence test:** all children of one parent should answer the
  same kind of question. If one child is a thing and its siblings are
  processes, something is mis-nested.

## Naming rules

- The user's term is the heading. When research shows the code's Ubiquitous
  Language uses a different term, keep the user's term and record the drift —
  renames are a human decision (Gate A or Gate C), never the writer's.
- *Also known as:* carries business-recognizable synonyms only — a product's
  old marketing name qualifies; a class name never does.

## Good/bad examples

**Bad** (tech bleed, padding, invented behavior):
> A Review (see `ReviewEntity`) is a comprehensive record persisted in the
> review table that leverages the directory integration layer. Reviews are
> automatically re-synced every 6 hours.

**Good** (the bar — short, business-true, evidence-bound):
> A Review is a customer's public rating and comment about a business location
> on a directory such as Google or Yelp. Businesses can respond to reviews on
> directories that support responses.

**Bad** (lifecycle states nested as children):
> D-2 Review · D-2.1 Unread Review · D-2.2 Responded Review

**Good** (lifecycle inside the parent):
> D-2 Review — "…A review starts unread and moves to responded once the
> business replies."

## Common pitfalls

- **Tech bleed** — a single identifier in an otherwise clean document breaks
  the contract with business readers. Self-grep before finishing.
- **A feature list masquerading as a domain model** — definitions describe
  concepts, not screens or buttons.
- **Inventing behavior beyond evidence** — plausible-sounding cadences,
  automations, and defaults that no research row supports.
- **Over-nesting** — mirroring the module/folder structure instead of the
  business structure.
- **Encyclopedic definitions** — if it needs a fourth sentence, the extra
  content is either lifecycle (fold into sentence 2–3), a child definition, or
  documentation that belongs elsewhere.
- **Silently dropping unevidenced definitions** — they stay in the document
  marked *(under review)* and get a gap entry; the human decides their fate.

## Self-check before finishing

- [ ] Every definition passes the day-one test
- [ ] No forbidden vocabulary — self-grep for `src/`, `::`, camelCase and
      snake_case tokens
- [ ] Every registry definition appears exactly once; nothing added beyond
      the registry
- [ ] Hierarchy matches the registry; no lifecycle-states-as-children
- [ ] Unevidenced or conflicted definitions carry *(under review)*
- [ ] All `{placeholders}` replaced or marked TBD
- [ ] All `<!-- AGENT INSTRUCTIONS -->` comments stripped from output
