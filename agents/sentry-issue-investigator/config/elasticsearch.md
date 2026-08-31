# Elasticsearch (production logs) — configuration & query cookbook

MCP server: `elasticsearch`. Every fact below was verified live on 2026-08-24.

## Which indices matter

| Index pattern | Contents | Use it? |
|---|---|---|
| `logstash-YYYY.MM.DD` | **All production app/web logs** (filebeat → logstash) | **Yes — this is the one** |
| `docker-logs-YYYY.MM.DD` | Docker GELF container logs | No — only `mcp-prod` on `mcp-01` |
| `.ds-mysql-*` | MySQL data streams | Rarely |
| `.internal.alerts-*`, `.kibana-*` | Kibana/alerting internals | Never |

**Retention is ~31 days** (on 2026-08-24 the oldest was `logstash-2026.07.25`).
Sentry keeps issues longer than the logs do — if a Sentry issue's `lastSeen` is
older than ~31 days, say plainly that the logs have rolled off rather than
reporting "no logs found", which reads like the request succeeded and found
nothing.

Query multiple days with a wildcard: `logstash-2026.08.*`, or comma-separated
exact names. Prefer the narrowest span that covers the Sentry event window —
each day is ~5M docs.

## Field map for `logstash-*`

ECS 8.0 via filebeat 8.11.1. All string fields are `text` with a `.keyword`
subfield.

| Field | Type | Notes |
|---|---|---|
| `@timestamp` | `date` | **Ingest** time — see the skew warning below |
| `message` | `text` + `.keyword` | The raw log line. Main search target |
| `event.original` | `text` | Copy of the raw line |
| `log.file.path` | `text` + `.keyword` | **The log-source selector.** Use `.keyword` |
| `host.name` | `text` + `.keyword` | `web-01`…`web-05`, `workerman01`…`12`, etc. |
| `agent.name` | `text` + `.keyword` | Usually same as host |
| `input.type`, `tags`, `ecs.version`, `@version` | | Rarely useful |

**Aggregations and `term` filters must use `.keyword`.** Plain `text` fields have
fielddata disabled and will error with
`Fielddata is disabled on [container_name]…`.

### Timestamp skew — read this before correlating

`@timestamp` is when filebeat **shipped** the line, while the line's own embedded
timestamp is when the event **happened**. Observed lag ranges from
sub-second to a few seconds, and `php-errors.log` lines were seen ~2s behind.

So when correlating with a Sentry event, **widen the window** — `±2 minutes`
around the Sentry timestamp, not `±2 seconds` — and confirm using the timestamp
inside `message`, not `@timestamp`.

## Log sources (`log.file.path.keyword`)

Doc counts are for a single day (2026-08-24), to convey relative volume.

| Path | Host(s) | What it is | Volume/day |
|---|---|---|---|
| `/usr/share/filebeat/transfer/tools-ssl-access.log` | `web-01`…`05` | **nginx access log for tools.brightlocal.com** | 1.87M |
| `/usr/share/filebeat/php/php-errors.log` | `web-*`, `workerman*` | **PHP error/warning log** | 892k |
| `/usr/share/filebeat/transfer/tools-ssl-error.log` | `web-*` | nginx error log (very low volume, high signal) | 11 |
| `/usr/share/filebeat/php/workerman.log` | `workerman01`…`12` | Workerman background workers | 105k |
| `/usr/share/filebeat/php/tools/crunz-output.log` | `web-*` | Cron (Crunz) output | 48k |
| `/usr/share/filebeat/php/tools/crunz-errors.log` | `web-*` | Cron errors (high signal) | 8 |
| `/var/log/listing_syncer/prod.log` | `listing-syncer-03/04` | **ListingSyncer / ActiveSync** | 1.04M |
| `/usr/share/filebeat/transfer/api-gateway.log` | `apigateway` | Go API gateway | 469k |
| `/usr/share/filebeat/transfer/access.log` | various | Other vhosts' access log | 973k |
| `/usr/share/filebeat/transfer/location_service.log` | | Location service (tiny) | 124 |
| `/usr/share/filebeat/transfer/bro_server.log` | `broserver` | Browser-automation server | 1.23M |
| `/usr/share/filebeat/transfer/geo-map.log` | `geomap` | Geo map service | 573k |
| `citation-finder.log`, `profile-finder*.log`, `serp-inspector.log`, `keywordfinder.log`, `bing_search.log`, `cf-ssl-access.log`, `vicarius.log` | | Other services | low |

### Which source for which Sentry issue

- **Culprit in `src/Modules/API/…`** → `tools-ssl-access.log` (find the HTTP
  request), then `php-errors.log`.
- **Culprit in `src/Modules/Location*/…`, aggregator/sync symptoms** →
  `listing_syncer/prod.log` **and** `tools-ssl-access.log`.
- **Worker/`Adapter/Worker`/Messenger frames** → `workerman.log`.
- **Cron/`Adapter/Cli` frames** → `crunz-output.log` + `crunz-errors.log`.
- **502/504/timeout symptoms** → `tools-ssl-error.log`.

> **`php-errors.log` is not a mirror of Sentry.** Sentry captures thrown
> exceptions; this file mostly carries warnings, notices, and deprecations. On
> 2026-08-24 it had 109 lines mentioning `Modules` and **zero** matching
> `Location AND Exception`, while Sentry had plenty of Location exceptions. Not
> finding your exception here is normal and is **not** evidence the issue is
> stale. The access log is the more reliable correlation route.

## Access-log line format

```
[CL: 103.22.142.112|RAY:a3012a245ef4756a-LHR] [24/Aug/2026:09:00:07 +0000]
"POST /seo-tools/admin/rm/reports/623832/reviews/199372535/gmb/respond HTTP/2.0"
500 2 "<referer>" "<user-agent>" 2.387 [SSL: 0SUCCESS]
[Upstream: 10.79.155.24:8080|500|2.386]
```

Fields in order: client IP, Cloudflare Ray ID, local timestamp, request line,
**status**, bytes, referer, user agent, **total seconds**, SSL result,
upstream `addr|status|seconds`.

The **Ray ID** is the best correlation key — it is unique per request, so once
you have it from one line you can pivot across every source that logged it.

## The three controls — run these before any negative verdict

A zero-hit query is only evidence once you have shown the query *could* have
hit. These are the recipes for the C1–C3 controls required by Mode C.

### C1 — retention

Arithmetic, not a query: is the Sentry event timestamp within ~31 days of today?
If not, stop — the verdict is `UNTESTABLE (outside retention)`, and no amount of
querying changes that.

### C2 — source coverage  (does this source have anything at all here?)

Same source, same window, same host — **minus** the discriminating term. If this
returns 0, the source shipped nothing for that host/window and a negative on the
real query means nothing.

```json
{
  "size": 0,
  "query": {"bool": {"filter": [
    {"term": {"log.file.path.keyword": "/usr/share/filebeat/php/workerman.log"}},
    {"term": {"host.name.keyword": "workerman03"}},
    {"range": {"@timestamp": {"gte": "2026-08-24T08:58:00Z", "lte": "2026-08-24T09:02:00Z"}}}
  ]}}
}
```

`0` here → `UNTESTABLE (no source coverage)` and a **Mode H gap type 4** (the app
may well be logging; filebeat isn't shipping it). It is *not* a refutation.

Cheap variant when you don't yet know which host: drop the `host.name` term and
add a terms agg on `host.name.keyword` to see who reported at all.

### C3 — pattern capability  (can this pattern ever match?)

Run the discriminating pattern **alone**, across a wide window and no source
filter. If it matches nothing anywhere, your query is broken — not the
hypothesis.

```json
{"size": 1, "_source": ["message"],
 "query": {"query_string": {"query": "AdditionalDataForward", "default_field": "message"}}}
```

This control exists because of the documented traps below: `match_phrase` across
a PHP namespace backslash and multi-wildcard patterns both return 0 for
perfectly present data. **Without C3 those look exactly like a refuted
hypothesis.** If C3 fails, rewrite the query using `AND`-joined terms and re-run
before recording anything.

### Verdict table

| C1 | C2 | C3 | Query result | Verdict |
|---|---|---|---|---|
| pass | pass | pass | hits | `CONFIRMED` |
| pass | pass | pass | 0 | `REFUTED` |
| pass | pass | **fail** | any | Query is broken — fix and re-run, record nothing |
| pass | **fail** | — | any | `UNTESTABLE (no source coverage)` → Mode H gap 4 |
| **fail** | — | — | any | `UNTESTABLE (outside retention)` → Mode H gap 7 |

## Verified query recipes

### Pick a log source and tail it

```json
{
  "size": 20,
  "_source": ["@timestamp", "message", "host.name"],
  "query": {"bool": {"filter": [
    {"term": {"log.file.path.keyword": "/usr/share/filebeat/php/php-errors.log"}}
  ]}},
  "sort": [{"@timestamp": "desc"}]
}
```

### Find 5xx responses  ✅ 20 hits

Status codes sit mid-line, so anchor on the request-line suffix:

```json
{"query_string": {"query": "message:(\"HTTP\\/2.0\\\" 500\" OR \"HTTP\\/1.1\\\" 500\")"}}
```

### Match a URL path  ✅ 5,232 hits for `/api/v1`

```json
{"match_phrase": {"message": "/api/v1"}}
```

`match_phrase` is the right tool for paths and slugs (`"location-manager"` →
4,527 hits).

### Correlate a Sentry event to its HTTP request

```json
{
  "size": 50,
  "_source": ["@timestamp", "message", "host.name"],
  "query": {"bool": {
    "filter": [
      {"term": {"log.file.path.keyword": "/usr/share/filebeat/transfer/tools-ssl-access.log"}},
      {"range": {"@timestamp": {"gte": "2026-08-24T08:58:00Z", "lte": "2026-08-24T09:02:00Z"}}}
    ],
    "must": [{"query_string": {"query": "message:(\"HTTP\\/2.0\\\" 500\")"}}]
  }},
  "sort": [{"@timestamp": "desc"}]
}
```

Then pivot on the Ray ID: `{"match_phrase": {"message": "a3012a245ef4756a"}}`.

### PHP namespaces in log lines

Namespaces appear backslash-escaped (`Modules\\Cb\\Adapter\\Http\\…`). The
analyzer splits on backslashes, so:

| Query | Result |
|---|---|
| `{"match": {"message": "Modules"}}` | ✅ 109 |
| `{"query_string": {"query": "Modules AND Cb", "default_field": "message"}}` | ✅ 21 |
| `{"query_string": {"query": "message:*Modules*"}}` | ✅ 109 (case-insensitive) |
| `{"match_phrase": {"message": "Modules Location"}}` | ❌ 0 — phrase across a backslash does not match |
| `{"query_string": {"query": "message:*Upstream*500*"}}` | ❌ 0 — multi-wildcard across tokens fails |

**Use `AND`-joined terms for namespaces, not `match_phrase`.**

### Count before you fetch

Cheap way to test a filter's selectivity without pulling documents:

```json
{
  "size": 0,
  "query": {"bool": {"filter": [
    {"term": {"log.file.path.keyword": "/usr/share/filebeat/php/php-errors.log"}}
  ]}},
  "aggs": {
    "modules":   {"filter": {"match": {"message": "Modules"}}},
    "exception": {"filter": {"match": {"message": "Exception"}}}
  }
}
```

### Group by host or source

```json
{"size": 0, "aggs": {
  "by_host":   {"terms": {"field": "host.name.keyword", "size": 30}},
  "by_source": {"terms": {"field": "log.file.path.keyword", "size": 40}}
}}
```

## Output size discipline

`list_indices` on `*` returns ~74KB and gets truncated to a file. **Never call
it with `*`.** Use a narrow pattern (`logstash-2026.08.*`) or skip it entirely —
the index naming is documented above and does not change.

Always set `size` explicitly (10–50) and restrict `_source` to the fields you
need. Access-log messages are long; 50 unfiltered hits is a lot of tokens.

## Read-only discipline

The `elasticsearch` MCP server exposes **write** tools: `create_index`,
`delete_index`, `add_document`, `update_document`, `delete_document`,
`update_by_query`, `delete_by_query`, `bulk`.

This agent must use **only** `search`, `count_documents`, `get_mappings`,
`list_indices`, `get_aliases`, `get_templates`, `get_cluster_health`. Never call
a write tool against production logs — not even to "test". There is no
undo.
