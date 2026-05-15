# Main Product — Context

> Fill in this file once. Subagents read it whenever they work on this product.
> Keep it under ~500 lines. If a subsection grows large, extract it to a sibling
> file (e.g., `architecture.md`, `glossary.md`).
>
> Information that is true across ALL products in your company belongs in
> `shared/domain/local-seo.md`, NOT here.

## What this product is

{One paragraph. Pretend you're explaining it to a new hire on day 1.}

Example:
> A B2B Local SEO platform used by digital marketing agencies and multi-location
> businesses to manage business listings across directories, run citation building
> campaigns, and monitor local search rankings.

## Who uses it

### Primary persona
{Name and 2-3 sentence description. Be specific.}

Example:
> Agency owner managing 20-200 SMB clients. They log in daily. They care most
> about white-label reporting and bulk operations. They are technically savvy
> but not engineers.

### Secondary personas
- {...}
- {...}

### Who DOES NOT use it
{Important to name. Helps the agent avoid generating PRDs that drift outside scope.}

## Business model

- **Pricing axis:** {per location / per user / per seat}
- **Plan tiers:** {list them}
- **Add-ons:** {list — Active Sync Plus, aggregators, citation builder, etc.}
- **White-label:** {yes / no / partial}
- **Billing system:** {Braintree / Stripe / other — and known limitations}

## Key product surfaces

The main areas of the product. Most PRDs are scoped to one of these.

- **Location Manager (LM)** — {what it does}
- **Connections** — {what it does}
- **Reputation** — {what it does}
- **Rankings** — {what it does}
- **{...}** — {...}

## Current state

### What's working well
- {...}
- {...}

### Current pain points
- {...}
- {...}

### Major in-flight initiatives
- {...}
- {...}

## Key metrics (for reference, not for the agent to fabricate from)

> If a PRD's Data section needs a metric, the agent should ask you for the
> current baseline rather than guessing. List here only the metrics that are
> public knowledge across the team.

- **North Star:** {metric and current rough value}
- **Activation:** {definition}
- **Retention:** {definition}
- **{...}** — {...}

## Architectural overview

{Either a paragraph or a link to `architecture.md`.}

Key services to know:
- **Listing Syncer** — {what it does}
- **Capabilities system** — {Location-level, Plan-level, what they gate}
- **{...}** — {...}

## Recent decisions worth knowing

> Decisions that shape what's possible right now. The agent should respect these
> when generating PRDs (e.g., "we decided NOT to do subscription pricing in 2026").

- {Decision} — {date} — {brief reason}
- {Decision} — {date} — {brief reason}

## What this product is NOT

{Anti-scope. Topics that are out of bounds for this product.}

- {...}
- {...}

## Glossary (product-specific)

> Terms that are specific to THIS product. General Local SEO terms go in
> `shared/domain/local-seo.md`.

- **{Term}** — {definition}
- **{Term}** — {definition}
