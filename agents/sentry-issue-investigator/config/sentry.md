# Sentry configuration & query cookbook

All values here were verified live against the self-hosted instance.
MCP server: `sentry-selfhosted`. Base URL: `https://sentry.bll-i.co.uk`.

## Organization

Slug: **`brightlocal`**

> **Gotcha:** `find_organizations()` returns *"You don't appear to be a member of
> any organizations"* — the MCP proxy user (Sentry user ID 42) has no org
> membership listed, but the org slug resolves fine. **Do not** call
> `find_organizations` to discover the org and conclude Sentry is unavailable.
> Always pass `organizationSlug: "brightlocal"` directly.

## Projects

The two this agent cares about:

| Project | What it is | Issue ID prefix |
|---|---|---|
| **`tools-backend`** | Tools PHP monolith — **primary target** | `TOOLS-BACKEND-…` |
| **`tools-frontend`** | Tools browser-side JS/React | `TOOLS-FRONTEND-…` |

Others on the instance, for reference: `new-tools-app`, `listing-syncer`,
`javascript`, `citationfinder`, `cbot`, `cbot-frontend`, `cbot-extension-afex`,
`custos`, `go-services`, `internal`, `mcp`, `mozfetcher`, `profilecomber`,
`profilefinder`, `rankingspider`, `sdparser`, `submitor`, `vicarius`.

`Location` and `API` are backend modules, so **default to `tools-backend`**.
Only widen to `tools-frontend` if the user asks or the symptom is clearly UI-side.

## Module scoping — the important part

Tools has no Sentry tag identifying the owning module. Scope by **stack frame
path** instead. Verified working field: **`stack.abs_path`** with leading/trailing
globs.

Culprit paths on production look like:

```
/home/sites/tools/builds/<build-hash>/src/Modules/Location/Application/Service/...
```

The build hash changes every deploy, so the leading `*/` glob is required.

### Working filters

```
# Location module family
stack.abs_path:"*/src/Modules/Location/*"

# API module family
stack.abs_path:"*/src/Modules/API/*"
```

### What does NOT work (tested, returns zero results)

```
stack.filename:"src/Modules/Location/*"     # ✗ no matches
stack.module:"Modules\\Location\\*"         # ✗ no matches
```

### Related module directories

`src/Modules/` contains several Location-adjacent modules. `*/src/Modules/Location/*`
matches **only** `Location`, not its siblings. When the user says "location module"
broadly, consider also querying:

- `Location` — core location domain (the literal reading)
- `LocationManager` — LM surface, includes `Services/ActiveSync/`
- `LocationConnections` — aggregator/directory connections
- `LocationSummary` — summary/report views
- `GeoLocationSearch`

Ask, or run the narrow filter first and mention the siblings. Don't silently
broaden — occurrence counts change a lot between the narrow and wide readings.

### Frame-level matching is a wide net

`stack.abs_path` matches if **any frame** in the stack touches that path, not just
the crash site. So `*/src/Modules/API/*` legitimately returns issues whose culprit
is elsewhere (e.g. a `LocationSummary` repository reached through an API
controller, or a Guzzle middleware frame).

**Always classify results into two buckets:**

1. **Owned by the module** — the *culprit* path is inside the module.
2. **Passing through the module** — culprit is elsewhere; the module only appears
   deeper in the stack.

Report which bucket each issue is in. Bucket 2 issues are often owned by another
team, and mislabelling them wastes the reader's time.

## Listing issues by occurrence count

The user's default ask is "ordered by number of occurrences" → **`sort: "freq"`**.

```
search_issues(
  organizationSlug = "brightlocal",
  projectSlugOrId  = "tools-backend",
  query            = 'is:unresolved stack.abs_path:"*/src/Modules/Location/*"',
  sort             = "freq",
  period           = "30d",
  limit            = 25,
)
```

- `sort: "freq"` — occurrence count (**the default for this agent**)
- `sort: "user"` — distinct users affected; use when prioritising customer impact
- `sort: "date"` — last seen; use for "what's broken right now"
- `sort: "new"` — first seen; use for "what did this deploy break"

`period` accepts only `24h`, `7d`, `14d`, `30d`, `90d`. Default to `30d`.
The **Events** count in results is scoped to that period — always state the
window alongside any count, or the number is meaningless.

### Other useful query clauses

```
is:unresolved            is:resolved      is:ignored      is:regressed
level:error              level:warning
firstSeen:-24h           lastSeen:-2h
environment:production
assigned:connected-locations-be
userCount:>100
```

Owning teams seen on Tools issues: `connected-locations-be`,
`backend-insights-be`, `citations-be`. `assigned:` is a good cross-check that a
module filter caught the right team's work.

## Triage sweep — the reactive signals

Frequency order alone is a poor triage input. Run these alongside the main list
and surface any hits **above** the frequency table.

```
# REGRESSED — a previous fix did not hold. Always check this one.
is:regressed stack.abs_path:"*/src/Modules/Location/*"

# NEW in the last 24h — pair with sort="new"
is:unresolved firstSeen:-24h stack.abs_path:"*/src/Modules/Location/*"

# STILL ACTIVE right now — pair with sort="date"
is:unresolved lastSeen:-2h stack.abs_path:"*/src/Modules/Location/*"

# CUSTOMER-VISIBLE at scale
is:unresolved userCount:>100 stack.abs_path:"*/src/Modules/Location/*"
```

**Spike detection** needs a time series, so use `search_events` with a
`count()` per interval and compare against the preceding window — `search_issues`
returns a window total, which cannot distinguish "rising fast" from "steady for
a month at the same number". The two need opposite responses.

**Release clustering.** Group by `release` to spot a cohort of issues sharing one
build; that points at the deploy rather than at any single issue, and the person
who shipped it is usually the fastest route to a fix.

```
search_events(
  organizationSlug = "brightlocal",
  projectSlug      = "tools-backend",
  dataset          = "errors",
  query            = 'stack.abs_path:"*/src/Modules/Location/*"',
  fields           = ["release", "count()"],
  sort             = "-count()",
  period           = "7d",
)
```

## Fetching one issue

Accept either form from the user and pass it straight through:

```
# Short ID
get_sentry_resource(organizationSlug="brightlocal", resourceType="issue",
                    resourceId="TOOLS-BACKEND-B77")

# Full URL — resource type is auto-detected
get_sentry_resource(url="https://sentry.bll-i.co.uk/organizations/brightlocal/issues/TOOLS-BACKEND-B77")
```

Numeric URLs (`/issues/12345/`) work too. Don't ask the user to reformat a link.

For the latest event's full stack trace, tags, and request context, follow up with
`resourceType="event"`, and `resourceType="breadcrumbs"` for the lead-up.

## Aggregate counts

`search_issues` returns grouped issues. For **counts and time series**, use
`search_events`:

```
search_events(
  organizationSlug = "brightlocal",
  projectSlug      = "tools-backend",
  dataset          = "errors",
  query            = 'stack.abs_path:"*/src/Modules/API/*"',
  fields           = ["issue", "count()"],
  sort             = "-count()",
  period           = "7d",
)
```

## Write operations — ask first

`update_issue` can resolve, ignore, and assign. It changes shared team state
visible to everyone. **Never call it unless the user explicitly asks in that
turn.** Investigating is read-only work.

## Linking out

Every response listing issues should offer the dashboard link:

```
https://sentry.bll-i.co.uk/organizations/brightlocal/issues/?project=tools-backend&query=<url-encoded-query>
```

## Reference: verified sample issues

Useful for sanity-checking that filters still behave:

- `TOOLS-BACKEND-B77` — `Modules\Location\…\AdditionalDataForwardFailedException`,
  culprit inside `Location` (bucket 1), team `connected-locations-be`.
- `TOOLS-BACKEND-B74` — `TypeError` in
  `Modules\API\Manage\Location\Infrastructure\Mapper\LocationDTOFactory`
  (bucket 1 for both `API` *and* `Location`).
- `TOOLS-BACKEND-B7A` — `Symfony\…\LogicException` in
  `Modules\API\Manage\Location\Adapter\Http\V1\Location\UpdateLocation`.
- `TOOLS-BACKEND-B72` — culprit in `LocationSummary`, surfaces under the `API`
  filter (bucket 2 — reached through an API frame).
