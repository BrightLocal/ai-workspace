#!/usr/bin/env python3
"""Build config/db-table-stats.md from information_schema exports.

Inputs are the files produced by scripts/db-table-stats.sql (tables-*.csv|tsv) and
scripts/db-table-indexes.sql (indexes-*.csv|tsv), one pair per MySQL host. Row counts
and sizes are rounded to two significant figures so the committed file carries
orders of magnitude, not business numbers. Exact exports stay in the gitignored
working directory.

Usage:
  python3 -I scripts/import-db-stats.py \
      --input-dir products/Tools/working/db-stats \
      --output agents/jira-to-pr/config/db-table-stats.md

  python3 -I scripts/import-db-stats.py --tables a.csv --indexes a-idx.csv --output ...
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import glob
import math
import os
import re
import sys
from collections import defaultdict

# tier name, minimum approx rows, minimum total size in MB — first match wins
TIERS = (
    ("XL", 10_000_000, 5 * 1024),
    ("L", 1_000_000, 512),
    ("M", 100_000, 64),
)
WIDE_ROW_KB = 4.0                 # average data bytes per row above which SELECT * hurts
LOW_SELECTIVITY_CARDINALITY = 1000
LOW_SELECTIVITY_MIN_ROWS = 100_000

# schemas Tools / ListingSyncer talk to (config/local.ini.example + LS Makefile)
EXPECTED_SCHEMAS = (
    ["brightlocal", "batches", "jobs", "proxy", "profiles", "logging",
     "local_active_location", "listing_syncer"]
    + [f"shard_{n:02d}" for n in range(1, 11)]
)


def sniff_delimiter(path: str) -> str:
    with open(path, newline="", encoding="utf-8") as fh:
        head = fh.readline()
    return "\t" if head.count("\t") >= head.count(",") else ","


def read_rows(path: str) -> list[dict[str, str]]:
    delim = sniff_delimiter(path)
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=delim)
        rows = []
        for raw in reader:
            rows.append({(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()})
        return rows


def to_int(value: str | None) -> int | None:
    if value is None or value == "" or value.upper() == "NULL":
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def round_sig(value: float, sig: int = 2) -> float:
    if value == 0:
        return 0.0
    return round(value, sig - int(math.floor(math.log10(abs(value)))) - 1)


def fmt_count(rows: int | None) -> str:
    if rows is None:
        return "n/a"
    if rows == 0:
        return "0"
    if rows < 1000:
        return "<1k"
    for unit, div in (("B", 1e9), ("M", 1e6), ("k", 1e3)):
        if rows >= div:
            value = round_sig(rows / div)
            if value >= 1000 and unit != "B":      # 999.6k -> 1.0M
                continue
            text = f"{value:.0f}" if value == int(value) else f"{value:.1f}"
            return f"~{text}{unit}"
    return f"~{rows}"


def fmt_size(mb: int | None) -> str:
    if mb is None:
        return "n/a"
    if mb >= 1024:
        return f"{round_sig(mb / 1024):g} GB"
    if mb >= 1:
        return f"{round_sig(mb):g} MB"
    return "<1 MB"


def avg_row_kb(data_mb: int | None, rows: int | None) -> float | None:
    if not data_mb or not rows:
        return None
    return data_mb * 1024 / rows


def tier_of(rows: int | None, total_mb: int | None) -> str:
    rows = rows or 0
    total_mb = total_mb or 0
    for name, min_rows, min_mb in TIERS:
        if rows >= min_rows or total_mb >= min_mb:
            return name
    return "S"


def date_from_name(path: str) -> str:
    match = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(path))
    if match:
        return match.group(1)
    return dt.date.fromtimestamp(os.path.getmtime(path)).isoformat()


def load_tables(paths: list[str]) -> tuple[dict, list[str]]:
    tables: dict[tuple[str, str, str], dict] = {}
    sources: list[str] = []
    for path in paths:
        rows = read_rows(path)
        hosts = set()
        for row in rows:
            key = (row.get("host", "?"), row.get("db_schema", "?"), row.get("table_name", ""))
            if not key[2]:
                continue
            hosts.add((key[0], key[1]))
            tables[key] = {
                "host": key[0], "schema": key[1], "table": key[2],
                "engine": row.get("engine", ""),
                "rows": to_int(row.get("approx_rows")),
                "data_mb": to_int(row.get("data_mb")),
                "index_mb": to_int(row.get("index_mb")),
                "total_mb": to_int(row.get("total_mb")),
                "index_count": to_int(row.get("index_count")),
                "indexes": [],
            }
        hosts_text = ", ".join(f"{h} / {s}" for h, s in sorted(hosts)) or "unknown host"
        sources.append(f"{hosts_text} — `{os.path.basename(path)}` ({len(rows)} tables, exported {date_from_name(path)})")
    return tables, sources


def load_indexes(paths: list[str], tables: dict) -> list[str]:
    sources = []
    missing = 0
    for path in paths:
        rows = read_rows(path)
        for row in rows:
            key = (row.get("host", "?"), row.get("db_schema", "?"), row.get("table_name", ""))
            if key not in tables:
                missing += 1
                continue
            tables[key]["indexes"].append({
                "name": row.get("index_name", ""),
                "unique": row.get("uniqueness", "").lower().startswith("unique"),
                "columns": row.get("columns", ""),
                "cardinality": to_int(row.get("cardinality")),
            })
        sources.append(f"`{os.path.basename(path)}` ({len(rows)} index rows, exported {date_from_name(path)})")
    if missing:
        print(f"warning: {missing} index rows referenced tables absent from the tables export", file=sys.stderr)
    return sources


def notes_for(table: dict) -> list[str]:
    notes = []
    rows = table["rows"] or 0
    avg = avg_row_kb(table["data_mb"], table["rows"])
    if rows == 0 and not table["total_mb"]:
        notes.append("empty")
    if avg is not None and avg >= WIDE_ROW_KB:
        notes.append(f"wide rows (~{avg:.0f} KB) — never `SELECT *`")
    if table["index_count"] == 0:
        notes.append("no index at all")
    elif table["index_count"] == 1 and rows >= LOW_SELECTIVITY_MIN_ROWS:
        notes.append("only PRIMARY — any other filter is a full scan")
    return notes


def md_escape(text: str) -> str:
    return text.replace("|", "\\|")


def render(tables: dict, table_sources: list[str], index_sources: list[str]) -> str:
    today = dt.date.today().isoformat()
    for table in tables.values():
        table["tier"] = tier_of(table["rows"], table["total_mb"])

    ordered = sorted(tables.values(), key=lambda t: (-(t["total_mb"] or 0), -(t["rows"] or 0), t["table"]))
    by_tier: dict[str, list[dict]] = defaultdict(list)
    for table in ordered:
        by_tier[table["tier"]].append(table)

    present_schemas = sorted({t["schema"] for t in tables.values()})
    not_covered = [s for s in EXPECTED_SCHEMAS if s not in present_schemas]

    out: list[str] = []
    out.append("# Production database table sizes")
    out.append("")
    out.append(f"Generated {today} by `scripts/import-db-stats.py`. Do not edit by hand — re-run the")
    out.append("importer after a fresh export (`scripts/db-table-stats.sql`, `scripts/db-table-indexes.sql`).")
    out.append("")
    out.append("**Sources**")
    out.append("")
    for src in table_sources:
        out.append(f"- {src}")
    for src in index_sources:
        out.append(f"- indexes: {src}")
    out.append("")
    if not_covered:
        out.append("**Not covered yet** (no export received): " + ", ".join(f"`{s}`" for s in not_covered) + ".")
        out.append("Treat tables from these schemas as **L** until measured, and say so in the plan.")
        out.append("")
    out.append("## How to read this file")
    out.append("")
    out.append("Counts are InnoDB estimates rounded to two significant figures (±20 %); only the order of")
    out.append("magnitude matters. Sizes are data + indexes. Rules for each tier live in")
    out.append("`db-query-guidelines.md`.")
    out.append("")
    out.append("| Tier | Definition | Tables |")
    out.append("|---|---|---|")
    definitions = {
        "XL": "≥ 10M rows or ≥ 5 GB",
        "L": "≥ 1M rows or ≥ 512 MB",
        "M": "≥ 100k rows or ≥ 64 MB",
        "S": "everything else",
    }
    for name in ("XL", "L", "M", "S"):
        out.append(f"| **{name}** | {definitions[name]} | {len(by_tier.get(name, []))} |")
    out.append("")

    for name in ("XL", "L", "M"):
        rows = by_tier.get(name, [])
        out.append(f"## {name} tables ({definitions[name]})")
        out.append("")
        if not rows:
            out.append("_none_")
            out.append("")
            continue
        out.append("| Table | ~Rows | Size | Avg row | Indexes | Notes |")
        out.append("|---|---|---|---|---|---|")
        for table in rows:
            avg = avg_row_kb(table["data_mb"], table["rows"])
            avg_text = f"{avg:.1f} KB" if avg is not None else "n/a"
            idx = table["index_count"] if table["index_count"] is not None else "n/a"
            out.append(
                f"| `{table['schema']}.{table['table']}` | {fmt_count(table['rows'])} | {fmt_size(table['total_mb'])} "
                f"| {avg_text} | {idx} | {md_escape('; '.join(notes_for(table)))} |"
            )
        out.append("")

    small = by_tier.get("S", [])
    out.append(f"## S tables ({definitions['S']})")
    out.append("")
    out.append("Small enough that any indexed or even unindexed read is fine outside hot loops.")
    out.append("")
    by_schema: dict[str, list[dict]] = defaultdict(list)
    for table in small:
        by_schema[table["schema"]].append(table)
    for schema in sorted(by_schema):
        entries = sorted(by_schema[schema], key=lambda t: t["table"])
        out.append(f"**{schema}:**")
        line = ""
        for entry in (f"`{t['table']}` ({fmt_count(t['rows'])})" for t in entries):
            if line and len(line) + len(entry) + 2 > 100:
                out.append(line + ",")
                line = ""
            line = f"{line}, {entry}" if line else entry
        out.append(line)
        out.append("")

    indexed = [t for t in ordered if t["indexes"]]
    out.append("## Indexes on large tables")
    out.append("")
    out.append("Every WHERE / JOIN / ORDER BY on an L or XL table must start with the leading column of one")
    out.append("of these indexes. *Low selectivity* marks indexes whose leading column has only a handful of")
    out.append("distinct values — they do not narrow a scan on their own.")
    out.append("")
    for table in indexed:
        out.append(f"### `{table['schema']}.{table['table']}` — {table['tier']}, {fmt_count(table['rows'])} rows, {fmt_size(table['total_mb'])}")
        out.append("")
        for index in sorted(table["indexes"], key=lambda i: (i["name"] != "PRIMARY", i["name"])):
            kind = "unique" if index["unique"] else "non-unique"
            flag = ""
            if (not index["unique"] and index["cardinality"] is not None
                    and index["cardinality"] <= LOW_SELECTIVITY_CARDINALITY
                    and (table["rows"] or 0) >= LOW_SELECTIVITY_MIN_ROWS):
                flag = " — **low selectivity**"
            out.append(f"- `{index['name']}` ({kind}): {index['columns']}{flag}")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input-dir", help="directory holding tables-*.csv|tsv and indexes-*.csv|tsv")
    parser.add_argument("--tables", action="append", default=[], help="tables export (repeatable)")
    parser.add_argument("--indexes", action="append", default=[], help="indexes export (repeatable)")
    parser.add_argument("--output", required=True, help="markdown file to write")
    args = parser.parse_args()

    table_paths = list(args.tables)
    index_paths = list(args.indexes)
    if args.input_dir:
        for pattern in ("tables-*.csv", "tables-*.tsv"):
            table_paths += sorted(glob.glob(os.path.join(args.input_dir, pattern)))
        for pattern in ("indexes-*.csv", "indexes-*.tsv"):
            index_paths += sorted(glob.glob(os.path.join(args.input_dir, pattern)))
    if not table_paths:
        parser.error("no tables export found — pass --tables or an --input-dir with tables-*.csv")

    tables, table_sources = load_tables(table_paths)
    index_sources = load_indexes(index_paths, tables)
    content = render(tables, table_sources, index_sources)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(content)
    tiers = defaultdict(int)
    for table in tables.values():
        tiers[table["tier"]] += 1
    print(f"wrote {args.output}: {len(tables)} tables — " + ", ".join(f"{k}={tiers[k]}" for k in ("XL", "L", "M", "S")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
