#!/usr/bin/env python3
"""Watch a dev box's Tools and ListingSyncer logs while someone exercises a flow, then print what happened.

Polls until ListingSyncer gets a write (POST/PUT/PATCH/DELETE) or logs an error, Tools logs a warning
or error, or a line matches --until. Then waits --settle seconds for the rest of the request and prints
a digest of the window: ListingSyncer writes and errors (reads only as counts per route), the
ListingSyncer container's own errors, Tools warnings and errors, and every line matching --match.
--dump prints the digest straight away.

Read-only: every remote command goes through agents/dev-env-inspector/scripts/dev-ssh.py.
Needs: Python 3.9+, the BrightLocal VPN.

    watch-dev-logs.py dev2 --match '1f1c8729-baaf-6fc2-b773-6678abeec678'
    watch-dev-logs.py dev2 --since 09:45 --dump

Exit codes: 0 something was seen (or --dump), 3 nothing seen before --timeout, 2 usage or SSH error.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import NoReturn

LS_LOG = "docker exec listing_syncer tail -n {lines} /var/www/var/log/dev.log"
LS_STDOUT = "docker logs --since {since} --tail 2000 listing_syncer"
TOOLS_LOG = "tail -n {lines} /var/log/php-errors.log"

LS_TIME = re.compile(r"^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})[^]]*\] ")
TOOLS_TIME = re.compile(r"^\[(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2}) UTC\] ")
LS_PROBLEM = re.compile(r"^\[[^]]+\] [\w.-]+\.(ERROR|CRITICAL|ALERT|EMERGENCY): ")
LS_SHOWN = re.compile(r"^\[[^]]+\] [\w.-]+\.(WARNING|ERROR|CRITICAL|ALERT|EMERGENCY): ")
LS_STDOUT_PROBLEM = re.compile(r"\b(ERROR|CRITICAL|ALERT|EMERGENCY)\b|Fatal error|Uncaught")
TOOLS_PROBLEM = re.compile(r'"level_name":"(WARNING|ERROR|CRITICAL|ALERT|EMERGENCY)"|\] PHP (Fatal|Parse|Warning|Recoverable)')
ROUTE = re.compile(r'Matched route "([^"]+)"')
METHOD = re.compile(r'"method":"([A-Z]+)"')
URI = re.compile(r'"request_uri":"https?://[^/"]+([^"]*)"')
CREDENTIALS_IN_URL = re.compile(r"(://[^:/@\s]+:)[^@\s]+@")
# Fire on their own on dev boxes (Braintree webhook signature checks, Planhat sync).
DEFAULT_IGNORE = r"Braintree|api\.planhat\.com"
WRITES = {"POST", "PUT", "PATCH", "DELETE"}
MAX_LINE = 400


class RemoteError(Exception):
    pass


@dataclass
class Window:
    since: datetime
    ls: list[str]
    ls_stdout: list[str]
    tools: list[str]
    notes: list[str] = field(default_factory=list)


def fail(message: str) -> NoReturn:
    print(f"[watch] {message}", file=sys.stderr)
    sys.exit(2)


def find_dev_ssh() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "agents" / "dev-env-inspector" / "scripts" / "dev-ssh.py"
        if candidate.is_file():
            return candidate
    fail("agents/dev-env-inspector/scripts/dev-ssh.py not found above this script")


def remote(dev_ssh: Path, env: str, command: str, with_stderr: bool = False) -> list[str]:
    try:
        result = subprocess.run(
            [sys.executable, "-I", str(dev_ssh), env, command],
            capture_output=True, text=True, timeout=120,
        )
    except subprocess.TimeoutExpired as error:
        raise RemoteError(f"'{command}' timed out (is the VPN up?)") from error
    if result.returncode != 0:
        raise RemoteError(f"'{command}' failed: {result.stderr.strip()[:300] or f'exit {result.returncode}'}")
    return (result.stdout + (result.stderr if with_stderr else "")).splitlines()


def box_now(dev_ssh: Path, env: str) -> datetime:
    lines = remote(dev_ssh, env, "date -u +%Y-%m-%dT%H:%M:%S")
    return datetime.strptime(lines[-1].strip(), "%Y-%m-%dT%H:%M:%S")


def parse_since(value: str, now: datetime) -> datetime:
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%H:%M:%S", "%H:%M"):
        try:
            parsed = datetime.strptime(value, fmt)
        except ValueError:
            continue
        if fmt.startswith("%H"):
            parsed = now.replace(hour=parsed.hour, minute=parsed.minute, second=parsed.second)
        return parsed
    fail(f"--since must be HH:MM[:SS] (box UTC, today) or YYYY-MM-DDTHH:MM:SS, got '{value}'")


def stamped(lines: list[str], pattern: re.Pattern[str], fmt: str, since: datetime, name: str, notes: list[str]) -> list[str]:
    kept, oldest = [], None
    for line in lines:
        found = pattern.match(line)
        if not found:
            continue
        at = datetime.strptime(found.group(1), fmt)
        oldest = oldest or at
        if at >= since:
            kept.append(line)
    if oldest is not None and oldest > since:
        notes.append(f"{name}: the lines read only reach back to {oldest:%H:%M:%S}; earlier ones were not read")
    return kept


def read_window(dev_ssh: Path, env: str, since: datetime, lines: int) -> Window:
    notes: list[str] = []
    ls = stamped(remote(dev_ssh, env, LS_LOG.format(lines=lines)), LS_TIME, "%Y-%m-%dT%H:%M:%S", since, "ListingSyncer dev.log", notes)
    stdout = remote(dev_ssh, env, LS_STDOUT.format(since=f"{since:%Y-%m-%dT%H:%M:%S}Z"), with_stderr=True)
    tools = stamped(remote(dev_ssh, env, TOOLS_LOG.format(lines=lines)), TOOLS_TIME, "%d-%b-%Y %H:%M:%S", since, "Tools php-errors.log", notes)
    return Window(since, ls, stdout, tools, notes)


def request(line: str) -> tuple[str, str, str] | None:
    route, method = ROUTE.search(line), METHOD.search(line)
    if route is None or method is None:
        return None
    uri = URI.search(line.replace("\\/", "/"))
    return method.group(1), route.group(1), uri.group(1) if uri else ""


def is_write(line: str) -> bool:
    found = request(line)
    return found is not None and found[0] in WRITES


def without(lines: list[str], ignore: re.Pattern[str] | None) -> list[str]:
    return [line for line in lines if ignore is None or not ignore.search(line)]


def triggered(window: Window, until: re.Pattern[str] | None, ignore: re.Pattern[str] | None) -> bool:
    ls, stdout, tools = without(window.ls, ignore), without(window.ls_stdout, ignore), without(window.tools, ignore)
    if until is not None and any(until.search(line) for line in ls + stdout + tools):
        return True
    return (
        any(is_write(line) or LS_PROBLEM.search(line) for line in ls)
        or any(LS_STDOUT_PROBLEM.search(line) for line in stdout)
        or any(TOOLS_PROBLEM.search(line) for line in tools)
    )


def tidy(text: str) -> str:
    text = CREDENTIALS_IN_URL.sub(r"\1***@", re.sub(r"\s{2,}", " ", text)).strip()
    return text if len(text) <= MAX_LINE else text[:MAX_LINE] + " …"


def ls_line(line: str) -> str:
    stamp = LS_TIME.match(line)
    body = re.sub(r' \{"file":.*$', "", line[stamp.end():] if stamp else line)
    return tidy(f"{stamp.group(1)[-8:] if stamp else '??:??:??'} {body}")


def tools_line(line: str) -> str:
    stamp = TOOLS_TIME.match(line)
    clock, body = (stamp.group(1)[-8:], line[stamp.end():]) if stamp else ("??:??:??", line)
    try:
        record = json.loads(body)
    except ValueError:
        return tidy(f"{clock} {body}")
    context = record.get("context")
    context = {k: v for k, v in context.items() if k != "exception"} if isinstance(context, dict) else {}
    text = f"{clock} {record.get('level_name', '?')} {record.get('message', '')}"
    if context:
        text += " " + json.dumps(context, ensure_ascii=False, separators=(",", ":"))
    return tidy(text)


def report(env: str, window: Window, until_now: datetime, match: re.Pattern[str] | None, ignore: re.Pattern[str] | None) -> None:
    hit = (lambda line: match is not None and match.search(line) is not None)
    ignored = sum(len(lines) - len(without(lines, ignore)) for lines in (window.ls, window.ls_stdout, window.tools))
    ls, stdout, tools = without(window.ls, ignore), without(window.ls_stdout, ignore), without(window.tools, ignore)

    requests, reads, ls_log = [], Counter(), []
    for line in ls:
        found = request(line)
        if found is None:
            if LS_SHOWN.search(line) or hit(line):
                ls_log.append(ls_line(line))
            continue
        method, route, uri = found
        if method in WRITES or hit(line):
            requests.append(tidy(f"{ls_line(line)[:8]} {method} {route} {uri}"))
        else:
            reads[f"{method} {route}"] += 1

    sections = [
        ("ListingSyncer requests (writes, and reads matching --match)", requests),
        ("ListingSyncer dev.log warnings/errors" + (" and --match lines" if match else ""), ls_log),
        ("ListingSyncer container output errors", [tidy(line) for line in stdout if LS_STDOUT_PROBLEM.search(line) or hit(line)]),
        ("Tools warnings/errors" + (" and --match lines" if match else ""), [tools_line(line) for line in tools if TOOLS_PROBLEM.search(line) or hit(line)]),
    ]
    print(f"=== {env} {window.since:%Y-%m-%d %H:%M:%S} → {until_now:%H:%M:%S} UTC")
    for title, lines in sections:
        print(f"--- {title}")
        print("\n".join(lines) if lines else "(none)")
    if reads:
        print("--- ListingSyncer reads: " + ", ".join(f"{count}× {what}" for what, count in reads.most_common()))
    print(f"--- lines in window: ListingSyncer dev.log {len(window.ls)}, container output {len(window.ls_stdout)}, Tools {len(window.tools)}")
    if ignored:
        print(f"--- {ignored} line(s) left out as background noise (--ignore '{ignore.pattern}')")
    for note in window.notes:
        print(f"--- note: {note}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("env", help="dev1..dev9")
    parser.add_argument("--match", help="regex for the flow's own lines (location uuid or id, class name); shown from every source")
    parser.add_argument("--until", help="regex: also stop at the first line matching it, e.g. a cron's log message")
    parser.add_argument("--ignore", default=DEFAULT_IGNORE, help=f"regex for background noise to leave out (default '{DEFAULT_IGNORE}'; '' keeps everything)")
    parser.add_argument("--since", help="start of the window, box UTC: HH:MM[:SS] today or YYYY-MM-DDTHH:MM:SS (default: now)")
    parser.add_argument("--dump", action="store_true", help="print the digest now and exit")
    parser.add_argument("--timeout", type=float, default=15, help="minutes to wait (default 15)")
    parser.add_argument("--interval", type=float, default=10, help="seconds between polls (default 10)")
    parser.add_argument("--settle", type=float, default=25, help="seconds to wait after the first sign of activity (default 25)")
    args = parser.parse_args()

    if not re.fullmatch(r"dev[1-9]", args.env):
        fail("env must be dev1..dev9")
    try:
        match = re.compile(args.match) if args.match else None
        until = re.compile(args.until) if args.until else None
        ignore = re.compile(args.ignore) if args.ignore else None
    except re.error as error:
        fail(f"bad regex: {error}")
    dev_ssh = find_dev_ssh()

    try:
        now = box_now(dev_ssh, args.env)
        since = parse_since(args.since, now) if args.since else now
        print(f"[watch] {args.env}: window from {since:%Y-%m-%dT%H:%M:%S} UTC", flush=True)
        if args.dump:
            report(args.env, read_window(dev_ssh, args.env, since, 3000), box_now(dev_ssh, args.env), match, ignore)
            return 0
    except RemoteError as error:
        fail(f"{args.env}: {error}")

    deadline, failures = time.monotonic() + args.timeout * 60, 0
    while time.monotonic() < deadline:
        try:
            if triggered(read_window(dev_ssh, args.env, since, 600), until, ignore):
                time.sleep(args.settle)
                report(args.env, read_window(dev_ssh, args.env, since, 3000), box_now(dev_ssh, args.env), match, ignore)
                return 0
            failures = 0
        except RemoteError as error:
            failures += 1
            if failures >= 3:
                fail(f"{args.env}: {error}")
            print(f"[watch] {args.env}: {error}; retrying", file=sys.stderr, flush=True)
        time.sleep(args.interval)

    print(f"[watch] {args.env}: nothing seen in {args.timeout:g} min. For the whole window: --dump --since {since:%H:%M:%S}")
    return 3


if __name__ == "__main__":
    sys.exit(main())
