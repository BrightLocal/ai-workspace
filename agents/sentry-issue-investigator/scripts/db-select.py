#!/usr/bin/env python3
"""Read-only MySQL query runner for the sentry-issue-investigator agent.

Three layers stop this script from mutating production:

1. Statement parsing — string literals and comments are blanked (so payloads
   cannot hide in `--`, `#`, or `/*! ... */`), multi-statement input is
   rejected, the leading keyword must be in an allowlist, and a blocklist
   catches DML/DDL anywhere in the remaining text.
2. Server-side read-only transaction — the statement runs inside
   START TRANSACTION READ ONLY. Verified against Percona 8.0.46: MySQL rejects
   INSERT/UPDATE/DELETE with error 1792. NOTE: it does NOT block DDL — CREATE /
   ALTER / DROP trigger an implicit commit and execute anyway. So layer 2
   backstops DML only; for DDL, layer 1 is the sole barrier.
3. Rollback on exit — nothing this script opens is ever committed.

Because layer 2 has that DDL hole, a parser bug would be the only thing between
a malformed statement and a schema change. Connect with a GRANT SELECT-only
database user; that is the sole airtight guarantee. See config/db.env.example.

The DSN is never echoed, and passwords are redacted from error output.

Usage:
    export TOOLS_PROD_DB_DSN='mysql://user:pass@host:3306/dbname'
    ./db-select.py "SELECT id, name FROM locations WHERE id = 4135533"
    ./db-select.py --json --limit 20 "SHOW CREATE TABLE locations"
    echo "DESCRIBE locations" | ./db-select.py -

Exit codes: 0 ok, 2 rejected by guard, 3 connection/query error, 4 bad usage.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from urllib.parse import unquote, urlparse

try:
    import pymysql
except ImportError:  # pragma: no cover
    sys.stderr.write(
        "error: pymysql is not installed. Install it with: pip install pymysql\n"
    )
    raise SystemExit(3)


DEFAULT_DSN_ENV = "TOOLS_PROD_DB_DSN"
DEFAULT_LIMIT = 100
MAX_LIMIT = 1000
DEFAULT_TIMEOUT = 30

# A statement must START with one of these.
ALLOWED_LEADING = ("select", "show", "describe", "desc", "explain", "with")

# Rejected anywhere in the comment-free statement.
# Each entry is (compiled pattern, human-readable label).
BLOCKED = [
    (r"\binsert\b", "INSERT"),
    (r"\bupdate\b", "UPDATE"),
    (r"\bdelete\b", "DELETE"),
    (r"\bdrop\b", "DROP"),
    (r"\balter\b", "ALTER"),
    (r"\bcreate\b", "CREATE"),
    (r"\btruncate\b", "TRUNCATE"),
    (r"\brename\b", "RENAME"),
    # REPLACE( is a legitimate string function; REPLACE INTO is not.
    (r"\breplace\b(?!\s*\()", "REPLACE"),
    (r"\bgrant\b", "GRANT"),
    (r"\brevoke\b", "REVOKE"),
    (r"\block\s+tables\b", "LOCK TABLES"),
    (r"\bunlock\s+tables\b", "UNLOCK TABLES"),
    (r"\bset\b", "SET"),
    (r"\bcall\b", "CALL"),
    (r"\bdo\b", "DO"),
    (r"\bhandler\b", "HANDLER"),
    (r"\bprepare\b", "PREPARE"),
    (r"\bexecute\b", "EXECUTE"),
    (r"\bdeallocate\b", "DEALLOCATE"),
    (r"\bload\s+data\b", "LOAD DATA"),
    (r"\bload_file\b", "LOAD_FILE"),
    (r"\binto\s+outfile\b", "INTO OUTFILE"),
    (r"\binto\s+dumpfile\b", "INTO DUMPFILE"),
    (r"\bget_lock\b", "GET_LOCK"),
    (r"\bbenchmark\b", "BENCHMARK"),
    (r"\bsleep\b", "SLEEP"),
    (r"\bflush\b", "FLUSH"),
    (r"\breset\b", "RESET"),
    (r"\bkill\b", "KILL"),
    (r"\bshutdown\b", "SHUTDOWN"),
    (r"\bstart\s+transaction\b", "START TRANSACTION"),
    (r"\bcommit\b", "COMMIT"),
    (r"\brollback\b", "ROLLBACK"),
    (r"\bsavepoint\b", "SAVEPOINT"),
    (r"\buse\b", "USE"),
]
BLOCKED = [(re.compile(pattern), label) for pattern, label in BLOCKED]


class Rejected(Exception):
    """The statement failed the guard. Never reaches the database."""


def strip_for_analysis(sql: str) -> str:
    """Remove string literals and comments so keyword checks can't be bypassed.

    String and identifier literals are blanked rather than deleted so that a
    column value like 'update the thing' cannot trip the blocklist, while
    /*! ... */ MySQL execution comments and -- hidden payloads cannot hide one.
    """
    out = []
    i = 0
    n = len(sql)
    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        # -- line comment (MySQL requires whitespace/EOL after --)
        if ch == "-" and nxt == "-" and (i + 2 >= n or sql[i + 2] in " \t\r\n"):
            while i < n and sql[i] != "\n":
                i += 1
            continue
        # # line comment
        if ch == "#":
            while i < n and sql[i] != "\n":
                i += 1
            continue
        # /* block comment */ — including /*! ... */ execution comments,
        # whose contents MySQL *does* run, so we must not silently drop them.
        if ch == "/" and nxt == "*":
            executable = sql[i + 2 : i + 3] in ("!", "+")
            end = sql.find("*/", i + 2)
            body = sql[i + 2 : end if end != -1 else n]
            # Keep the body of executable comments visible to the checks.
            out.append(" " + (body if executable else "") + " ")
            i = (end + 2) if end != -1 else n
            continue
        # quoted literals: ' " `
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            while i < n:
                if sql[i] == "\\" and quote != "`":
                    i += 2
                    continue
                if sql[i] == quote:
                    # doubled quote is an escaped quote
                    if i + 1 < n and sql[i + 1] == quote:
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            out.append(" '' ")
            continue

        out.append(ch)
        i += 1

    return "".join(out)


def guard(sql: str) -> str:
    """Validate the statement. Returns the statement to execute, or raises."""
    original = sql.strip()
    if not original:
        raise Rejected("empty statement")

    analysis = strip_for_analysis(original).strip()

    # Allow exactly one optional trailing semicolon.
    analysis_no_tail = analysis.rstrip().rstrip(";").rstrip()
    if ";" in analysis_no_tail:
        raise Rejected(
            "multiple statements are not allowed — send one SELECT at a time"
        )

    lowered = analysis_no_tail.lower()

    leading = re.match(r"[a-z_]+", lowered)
    if not leading or leading.group(0) not in ALLOWED_LEADING:
        got = leading.group(0).upper() if leading else "(none)"
        raise Rejected(
            f"statement must start with one of "
            f"{', '.join(k.upper() for k in ALLOWED_LEADING)} — got {got}"
        )

    # WITH ... must resolve to a SELECT, never a CTE-driven DML.
    if leading.group(0) == "with" and not re.search(r"\bselect\b", lowered):
        raise Rejected("WITH clause must contain a SELECT")

    # Every SHOW form in MySQL is read-only, and several carry otherwise-blocked
    # keywords (SHOW CREATE TABLE, SHOW TABLE STATUS). The single-statement check
    # above already ran, so skipping the keyword blocklist here is safe.
    if leading.group(0) != "show":
        for pattern, label in BLOCKED:
            match = pattern.search(lowered)
            if match:
                raise Rejected(
                    f"forbidden keyword {label} at offset {match.start()} — "
                    "this runner is read-only"
                )

    # Send the original text (comments and all); the guard analysed a
    # normalised copy, MySQL should see exactly what the user wrote.
    return original.rstrip().rstrip(";").rstrip()


def env_row_limit() -> int:
    """Default row cap, overridable via $TOOLS_PROD_DB_ROW_LIMIT."""
    raw = os.environ.get("TOOLS_PROD_DB_ROW_LIMIT")
    if not raw:
        return DEFAULT_LIMIT
    try:
        return max(1, min(int(raw), MAX_LIMIT))
    except ValueError:
        sys.stderr.write(
            f"warning: ignoring non-numeric $TOOLS_PROD_DB_ROW_LIMIT={raw!r}\n"
        )
        return DEFAULT_LIMIT


def parse_dsn(dsn: str) -> dict:
    """Parse mysql://user:pass@host:port/db into pymysql kwargs."""
    if "://" not in dsn:
        raise SystemExit(
            "error: DSN must look like mysql://user:pass@host:3306/dbname"
        )

    parsed = urlparse(dsn)
    if parsed.scheme not in ("mysql", "mysql+pdo", "pdo-mysql", "mysqli"):
        raise SystemExit(f"error: unsupported DSN scheme '{parsed.scheme}'")
    if not parsed.hostname:
        raise SystemExit("error: DSN is missing a host")

    return {
        "host": parsed.hostname,
        "port": parsed.port or 3306,
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "database": (parsed.path or "/").lstrip("/") or None,
    }


def redact(text: str, secrets: list[str]) -> str:
    for secret in secrets:
        if secret:
            text = text.replace(secret, "***")
    return text


def render_table(columns: list[str], rows: list[tuple]) -> str:
    if not columns:
        return "(no columns)"
    cells = [[("NULL" if v is None else str(v)) for v in row] for row in rows]
    widths = [len(c) for c in columns]
    for row in cells:
        for idx, value in enumerate(row):
            widths[idx] = max(widths[idx], min(len(value), 80))

    def line(values: list[str]) -> str:
        return " | ".join(
            (v if len(v) <= 80 else v[:77] + "...").ljust(widths[i])
            for i, v in enumerate(values)
        )

    out = [line(list(columns)), "-+-".join("-" * w for w in widths)]
    out.extend(line(row) for row in cells)
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a single read-only SQL statement against a MySQL DSN.",
    )
    parser.add_argument(
        "sql",
        help="the statement to run, or '-' to read it from stdin",
    )
    parser.add_argument(
        "--dsn",
        default=None,
        help=f"DSN override; prefer the ${DEFAULT_DSN_ENV} env var so the "
        "password stays out of shell history and process listings",
    )
    parser.add_argument("--limit", type=int, default=env_row_limit(),
                        help=f"max rows to print (default {DEFAULT_LIMIT} or "
                             f"$TOOLS_PROD_DB_ROW_LIMIT, cap {MAX_LIMIT})")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                        help=f"connect/read timeout in seconds "
                             f"(default {DEFAULT_TIMEOUT})")
    parser.add_argument("--json", action="store_true",
                        help="emit JSON instead of an aligned table")
    parser.add_argument("--explain-guard", action="store_true",
                        help="validate the statement and exit without connecting")
    args = parser.parse_args()

    sql_input = sys.stdin.read() if args.sql == "-" else args.sql

    try:
        statement = guard(sql_input)
    except Rejected as exc:
        sys.stderr.write(f"REJECTED: {exc}\n")
        return 2

    if args.explain_guard:
        print("OK — statement passed the read-only guard (not executed)")
        return 0

    dsn = args.dsn or os.environ.get(DEFAULT_DSN_ENV)
    if not dsn:
        sys.stderr.write(
            f"error: no DSN. Set ${DEFAULT_DSN_ENV} or pass --dsn.\n"
        )
        return 4

    limit = max(1, min(args.limit, MAX_LIMIT))
    conn_args = parse_dsn(dsn)
    secrets = [conn_args["password"], dsn]

    conn = None
    try:
        conn = pymysql.connect(
            host=conn_args["host"],
            port=conn_args["port"],
            user=conn_args["user"],
            password=conn_args["password"],
            database=conn_args["database"],
            connect_timeout=args.timeout,
            read_timeout=args.timeout,
            write_timeout=args.timeout,
            autocommit=False,
            charset="utf8mb4",
        )
        with conn.cursor() as cur:
            # Layer 2: the server rejects DML from here on (error 1792).
            # DDL is NOT covered — see the module docstring.
            cur.execute("START TRANSACTION READ ONLY")
            cur.execute(statement)
            columns = [d[0] for d in (cur.description or [])]
            rows = cur.fetchmany(limit)
            truncated = cur.fetchone() is not None
        conn.rollback()  # Layer 3: never commit.
    except Exception as exc:  # noqa: BLE001 — surface any driver error safely
        sys.stderr.write(
            "error: "
            + redact(f"{type(exc).__name__}: {exc}", secrets)
            + "\n"
        )
        return 3
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass

    if args.json:
        print(json.dumps(
            {
                "columns": columns,
                "rows": [
                    [None if v is None else
                     (v if isinstance(v, (int, float, bool)) else str(v))
                     for v in row]
                    for row in rows
                ],
                "row_count": len(rows),
                "truncated": truncated,
            },
            indent=2,
            default=str,
        ))
    else:
        print(render_table(columns, list(rows)))
        print(f"\n({len(rows)} row{'s' if len(rows) != 1 else ''}"
              + (f", truncated at --limit {limit}" if truncated else "")
              + ")")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
