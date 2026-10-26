# Database query guidelines — rules by table tier

Read this together with `db-table-stats.md` (production table sizes and the index
inventory of large tables). It applies to anything that reads or writes MySQL:
native SQL, DQL, QueryBuilder, repository methods, workers and crons that iterate
over rows, Elasticsearch indexers that read MySQL, and Doctrine migrations.

Local Docker databases are nearly empty. An `EXPLAIN` there proves at best that an
index exists; it says nothing about how the query behaves on production. The
numbers in `db-table-stats.md` are the evidence to reason from.

## The one rule

Know the tier of every table you touch **before** you write the query, and write
it down in the plan's *Data volume impact* section. A table that is missing from
`db-table-stats.md` is treated as **L** until measured, and the plan says so.

## Rules by tier

### S — under 100k rows

Any reasonable query is fine. Still use the module's existing repository pattern.

### M — 100k to 1M rows (or ≥ 64 MB)

- Filter on an indexed column in request paths. Full scans are acceptable only in
  CLI commands and crons, and the plan must say the scan is intended.
- Avoid `SELECT *` when the table is flagged *wide rows*.

### L — 1M to 10M rows (or ≥ 512 MB)

Everything for M, plus:

- Every `WHERE`, `JOIN` and `ORDER BY` must be served by an index listed in
  `db-table-stats.md`, and the filter must include that index's **leading** column.
- No leading-wildcard `LIKE '%…'`, no function or cast on an indexed column, no
  `OR` across different columns (use `IN`, or `UNION` of indexed branches), no
  `NOT IN (subquery)` over the table.
- Select only the columns you need. *Wide rows* tables never use `SELECT *`.
- Paginate by keyset (`WHERE id > :lastId ORDER BY id LIMIT :n`), never by `OFFSET`.
- No `COUNT(*)` without an indexed filter in a request path. Prefer existing
  counters and summary tables.
- Batch work (backfills, re-indexing, clean-ups) is chunked by primary key with
  `LIMIT 500–1000` per chunk and a pause between chunks in workers.
- An index whose leading column is marked *low selectivity* (status, flags, booleans)
  does not narrow a scan on its own. Pair it with a selective column or pick a
  composite index that starts with one.

### XL — 10M rows and more (or ≥ 5 GB)

Everything for L, plus:

- A new or changed query needs a *Data volume impact* row naming the index used and
  the expected number of rows per call. "Depends on input" is not an answer; give a range.
- No `UPDATE` or `DELETE` without a primary-key range. Backfills are console commands:
  chunked, resumable, with progress output — never inside a migration.
- Aggregations and reporting do not run live against XL tables; they go through
  summary tables or Elasticsearch, like the existing `*_summary` / `*_summaries` tables.
- **Schema changes are HIGH risk.** An `ALTER` on an XL table can lock or run for
  hours. The plan marks it HIGH, the migration uses online DDL
  (`ALGORITHM=INPLACE, LOCK=NONE`, or `ALGORITHM=INSTANT` for a trailing column with
  a default on MySQL 8) and the PR asks for DBA review in *Additional comments*.
- Never add an index "just in case". A new index on an XL table is itself a HIGH
  risk change and needs the query it serves written next to it.

## Prefer the module's existing access pattern

- An existing repository or QueryBuilder method in the module beats new native SQL.
  New native SQL needs a one-line justification in the plan (what the ORM could not do).
- Respect module boundaries: do not query another module's tables directly. Go
  through that module's query, gateway or integration command (Deptrac blocks the
  import anyway).
- Reuse the module's names for the data you read (`$expiredConnections`, not
  `$rows`); see `coding-standards.md`.

## Migrations

- Doctrine migrations only (`migration/doctrine/Version{YYYYMMDDhhmmss}.php`,
  non-round timestamp, real `down()`), as Tools' `AGENTS.md` requires.
- Schema and data never mix: a migration changes structure; a console command moves data.
- A migration that touches a ListingSyncer-owned table is copied into ListingSyncer
  with only the namespace changed (Tools `RELATED_SERVICES.md`).
- Adding a column on L/XL: trailing position, nullable or with a default, so MySQL 8
  can apply it instantly. Adding or dropping an index on XL: online DDL + DBA review.

## What goes into the PR

*Additional comments* lists, for every L/XL table touched: the table, its tier, the
index the query relies on, and the expected rows per call. If the only evidence is
a local `EXPLAIN`, say that it ran against an empty database.

## When the stats are stale

`db-table-stats.md` carries its export date. Older than six months: ask for a fresh
export (`scripts/db-table-stats.sql`) and, until then, treat every table one tier higher
than listed. A table from a schema the file does not cover is **L** by default.
