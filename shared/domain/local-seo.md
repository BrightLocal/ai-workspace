# Local SEO — Domain Knowledge

> This file is shared across all products in the workspace. It captures vocabulary,
> concepts, and patterns that are common to the Local SEO industry, regardless of
> which product you're working on.
>
> Product-specific concepts (e.g., "Active Sync Plus" — a paid tier of *your* product)
> belong in `products/{name}/CONTEXT.md`, not here.

## Core concepts

### Listings
A "listing" is a record of a business on a directory or platform. The same business
might have listings on Google Business Profile (GBP), Apple Maps, Bing Places,
Facebook, Yelp, and dozens of smaller directories. Each listing has fields like
NAP (Name/Address/Phone), hours, categories, photos, descriptions.

### NAP consistency
Name, Address, Phone — the foundational data that should match across all listings.
NAP inconsistency is one of the main signals search engines use to assess local
relevance. Most Local SEO tooling exists to detect and fix NAP inconsistencies at
scale.

### Citations
A citation is a mention of the business's NAP on the web, often on a directory.
Building citations means creating new listings on directories. Tracking citations
means monitoring which directories mention the business and whether the data is
correct.

### Aggregators
Aggregators are data providers that distribute business data to many smaller
directories at once. Buying an aggregator submission gets your data pushed to dozens
or hundreds of secondary directories. Major aggregators in the US:
- **Data Axle** (formerly Infogroup)
- **Neustar / TransUnion**
- **Locafy**
- **Foursquare**
- **Factual** (now mostly absorbed)

Aggregator data is typically sold as a yearly submission (one-time purchase per
year), not as a subscription. This shapes the purchase model of any product that
sells aggregator access.

### Sync vs Active Sync vs Insights
Different integrations serve different purposes:
- **Connection only** — read access, used to display data in dashboards (e.g., Google Analytics)
- **One-time sync** — push current data to the platform once
- **Active Sync** — continuous bidirectional sync; changes in your tool flow to the platform automatically

These distinctions matter for UX and pricing. A user expecting Active Sync may be
disappointed by an integration that only offers connection-for-insights.

### Local Pack / 3-Pack
The map+top-3-results module that appears on Google search results for local
queries. Ranking in the Local Pack is the primary outcome most Local SEO customers
care about.

### GBP (Google Business Profile, formerly GMB)
The most important integration in Local SEO. Almost every Local SEO product has
a GBP integration as a baseline. Categories, attributes, posts, Q&A, reviews —
all flow through GBP.

## Common business model patterns

### Citation Builder (CB)
A common offering: an internal team (or automated workflow) builds citations on
behalf of customers. Often sold as a one-time campaign rather than a subscription.

### Active Sync Plus (or equivalent)
A paid tier that unlocks premium integrations or premium features within
integrations. Common gating point in Local SEO products.

### White-label
Many Local SEO tools serve digital marketing agencies who resell the tool to their
SMB clients. White-label means the agency rebrands the tool. This affects:
- UX (no mention of the underlying vendor)
- Reporting (must look like the agency's own report)
- Pricing (agency pays per location, often in tiers)

### Per-location pricing
The dominant pricing axis in Local SEO. Customers pay per business location, not
per user, not per feature. This shapes everything from billing logic to capability
gating.

## Common pain points and patterns

### Sync conflicts
When the same field (e.g., business hours) is edited in multiple systems, who wins?
This is one of the hardest UX problems in the industry. Patterns include:
- Source of truth designation (e.g., GBP wins)
- Conflict notification with manual resolution
- Last-write-wins (rare, usually bad)

### Multi-location at scale
Managing 1 location is easy. Managing 1,000 locations means batch operations,
templating, and per-location override patterns. Bulk editing is a recurring
high-value feature.

### Verification flow
Many platforms require verifying ownership of a listing (postcard, phone call,
email). Verification is a frequent friction point and a common cause of
"connected but not synced" states.

## Glossary (quick reference)

- **AS** — Active Sync
- **AS+** — Active Sync Plus (premium tier)
- **CB** — Citation Builder
- **GBP** — Google Business Profile
- **LM** — Location Manager (a common product surface)
- **NAP** — Name, Address, Phone
- **DA** — Data Axle (often used in user stories)
- **PH team** — Production / publishing team (handles manual citation work)

## Maintenance

When you find yourself defining a term twice across PRDs, add it here. When a term
is product-specific (only one product uses it), put it in that product's
`CONTEXT.md` instead.
