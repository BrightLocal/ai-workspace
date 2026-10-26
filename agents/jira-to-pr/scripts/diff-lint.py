#!/usr/bin/env python3
"""Deterministic checks on the ADDED lines of a git diff.

Rules (see config/coding-standards.md):
  ticket-ref         a Jira-style key (LM-4358) in an added line of a source file
  change-narration   a comment that narrates the change ("added for", "fix for", "as per ticket")
  todo               TODO / FIXME / XXX / HACK in an added line
  generic-name       a banned generic variable name introduced by an added line

Usage:
  diff-lint.py [--repo PATH] [--base REF | --staged] [--allow RULE]... [--prefixes LM,CE]

  --base REF   compare the working tree (and untracked files) with REF; default: master,
               falling back to main. Use --staged to check only what is staged.
  --allow      skip a rule entirely (repeatable). Prefer fixing the finding.
  --prefixes   restrict ticket-ref to these Jira project keys; default: any KEY-123 shape
               minus well-known non-ticket tokens (ISO-8601, SHA-256, UTF-16 ...).

Exit codes: 0 clean, 1 findings, 2 usage or git error.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

SOURCE_SUFFIXES = (".php", ".js", ".jsx", ".ts", ".tsx", ".twig", ".yaml", ".yml", ".sql", ".phtml")
SKIP_PATH_PARTS = ("/vendor/", "/node_modules/", "/.git/", "/cache/")
SKIP_FILES = ("composer.lock", "yarn.lock", "package-lock.json")

PHP_BANNED = "object obj item row data result res value val tmp temp arr array el element info thing x y".split()
JS_BANNED = "obj item row data result res value val tmp temp arr el element info thing".split()

NON_TICKET_PREFIXES = {"ISO", "SHA", "AES", "RSA", "UTF", "RFC", "MD", "CVE", "TLS", "SSL", "IPV",
                       "CSS", "HTML", "ECMA", "TCP", "UDP", "BC", "DIN", "IEEE", "PSR", "PHP", "ES",
                       "HTTP", "ADR", "GPT", "LSRC"}

TICKET_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,6})-(\d{2,6})\b")
TODO_RE = re.compile(r"\b(TODO|FIXME|XXX|HACK)\b")
COMMENT_START_RE = re.compile(r"^\s*(//|#(?!\[)|\*|/\*)")
NARRATION_RE = re.compile(
    r"\b(added|removed|updated|changed|introduced|new)\s+(for|per|in|as part of|because of)\b"
    r"|\bfix(es|ed)?\s+for\b|\b(as per|see|from)\s+(the\s+)?(ticket|task|jira|issue)\b|\bjira\b",
    re.IGNORECASE,
)

# (pattern, needs_declaration_context) — the name group is always group 1
PHP_INTRO_PATTERNS = [
    (r"\$(%s)\s*(=[^=>]|\+=|\.=|\?\?=)", False),                              # assignment
    (r"\bas\s+\$(%s)\b", False),                                                 # foreach ($xs as $x)
    (r"=>\s*\$(%s)\b", False),                                                    # foreach ($xs as $k => $x)
    (r"(?:\(|,)\s*(?:[\w\\|?]+\s+)?(?:&|\.\.\.)?\$(%s)\s*(?:[,=)])", True),  # declared parameter
    (r"\buse\s*\([^)]*\$(%s)\b", True),                                         # closure use ($x)
]
JS_INTRO_PATTERNS = [
    (r"\b(?:const|let|var)\s+(%s)\b", False),
    (r"\b(?:const|let|var)\s*[{\[][^}\]]*\b(%s)\b", False),
    (r"\bfor\s*\(\s*(?:const|let|var)\s+(%s)\b", False),
    (r"(?<![\w.$])(%s)\s*=>", False),                                             # item => ...
    (r"(?:\(|,)\s*(%s)\s*(?:,|\))", True),                                       # declared parameter
]
PHP_DECLARATION_RE = re.compile(r"\bfunction\b|\bfn\s*\(")
JS_DECLARATION_RE = re.compile(r"=>|\bfunction\b")


def compile_intro(patterns, banned):
    alternation = "|".join(banned)
    return [(re.compile(pattern % alternation), needs_declaration) for pattern, needs_declaration in patterns]


PHP_INTRO_RES = compile_intro(PHP_INTRO_PATTERNS, PHP_BANNED)
JS_INTRO_RES = compile_intro(JS_INTRO_PATTERNS, JS_BANNED)

def run_git(repo: str, *args: str) -> str:
    result = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        sys.exit(2)
    return result.stdout


def resolve_base(repo: str, requested: str | None) -> str:
    candidates = [requested] if requested else ["master", "main"]
    for ref in candidates:
        if subprocess.run(["git", "-C", repo, "rev-parse", "--verify", "--quiet", ref],
                          capture_output=True).returncode == 0:
            return ref
    sys.stderr.write(f"diff-lint: base ref not found ({', '.join(candidates)})\n")
    sys.exit(2)


def is_source(path: str) -> bool:
    lowered = path.lower()
    if any(part in f"/{lowered}" for part in SKIP_PATH_PARTS):
        return False
    if os.path.basename(lowered) in SKIP_FILES:
        return False
    return lowered.endswith(SOURCE_SUFFIXES)


def parse_diff(diff_text: str):
    """Yield (path, added_lines[(lineno, text)], removed_text)."""
    path = None
    added: list[tuple[int, str]] = []
    removed: list[str] = []
    new_line = 0
    hunk_re = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")
    for raw in diff_text.splitlines():
        if raw.startswith("+++ "):
            if path is not None:
                yield path, added, "\n".join(removed)
            target = raw[4:].strip()
            path = None if target == "/dev/null" else target[2:] if target.startswith("b/") else target
            added, removed, new_line = [], [], 0
            continue
        if raw.startswith("--- ") or raw.startswith("diff --git") or raw.startswith("index "):
            continue
        match = hunk_re.match(raw)
        if match:
            new_line = int(match.group(1))
            continue
        if path is None:
            continue
        if raw.startswith("+"):
            added.append((new_line, raw[1:]))
            new_line += 1
        elif raw.startswith("-"):
            removed.append(raw[1:])
        elif raw.startswith("\\"):
            continue
        else:
            new_line += 1
    if path is not None:
        yield path, added, "\n".join(removed)


def untracked_files(repo: str) -> list[str]:
    output = run_git(repo, "ls-files", "--others", "--exclude-standard")
    return [line for line in output.splitlines() if line]


def ticket_hits(text: str, prefixes: set[str] | None):
    for match in TICKET_RE.finditer(text):
        prefix = match.group(1)
        if prefixes is not None:
            if prefix in prefixes:
                yield match.group(0)
        elif prefix not in NON_TICKET_PREFIXES and not prefix[-1].isdigit():
            yield match.group(0)


def check_line(path: str, lineno: int, text: str, removed: str, prefixes: set[str] | None):
    findings = []
    stripped = text.strip()
    if not stripped:
        return findings
    is_php = path.endswith((".php", ".phtml"))
    is_js = path.endswith((".js", ".jsx", ".ts", ".tsx"))
    is_comment = bool(COMMENT_START_RE.match(text))

    for key in ticket_hits(text, prefixes):
        findings.append(("ticket-ref", f"{key} must not appear in code, comments, strings or test names"))

    if is_comment and NARRATION_RE.search(text):
        findings.append(("change-narration", "comment narrates the change — the commit and PR body carry that"))

    if TODO_RE.search(text):
        findings.append(("todo", "open points go to the PR's Additional comments, not into the code"))

    if (is_php or is_js) and not is_comment:
        intro_res = PHP_INTRO_RES if is_php else JS_INTRO_RES
        declaration_re = PHP_DECLARATION_RE if is_php else JS_DECLARATION_RE
        in_declaration = bool(declaration_re.search(text))
        seen = set()
        for compiled, needs_declaration in intro_res:
            if needs_declaration and not in_declaration:
                continue
            for match in compiled.finditer(text):
                name = match.group(1)
                if name in seen:
                    continue
                marker = f"${name}" if is_php else name
                # present on the removed side of the same file → the agent did not introduce it
                if re.search(rf"(?<![\w$]){re.escape(marker)}\b", removed):
                    continue
                seen.add(name)
                findings.append(("generic-name", f"{marker} is a generic name — name the domain thing (coding-standards.md §2)"))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", default=".", help="repository path (default: current directory)")
    parser.add_argument("--base", help="base ref to diff against (default: master, then main)")
    parser.add_argument("--staged", action="store_true", help="check the staged changes only")
    parser.add_argument("--allow", action="append", default=[], help="skip this rule (repeatable)")
    parser.add_argument("--prefixes", help="comma-separated Jira project keys for ticket-ref")
    args = parser.parse_args()

    repo = os.path.abspath(args.repo)
    allowed = set(args.allow)
    prefixes = {p.strip().upper() for p in args.prefixes.split(",") if p.strip()} if args.prefixes else None

    if args.staged:
        diff_text = run_git(repo, "diff", "--cached", "-U0", "--no-color")
        extra_files: list[str] = []
    else:
        base = resolve_base(repo, args.base)
        diff_text = run_git(repo, "diff", "-U0", "--no-color", base)
        extra_files = untracked_files(repo)

    findings: list[tuple[str, int, str, str, str]] = []
    for path, added, removed in parse_diff(diff_text):
        if not is_source(path):
            continue
        for lineno, text in added:
            for rule, message in check_line(path, lineno, text, removed, prefixes):
                if rule not in allowed:
                    findings.append((path, lineno, rule, message, text.strip()))

    for path in extra_files:
        if not is_source(path):
            continue
        try:
            with open(os.path.join(repo, path), encoding="utf-8", errors="replace") as fh:
                lines = fh.read().splitlines()
        except OSError:
            continue
        for lineno, text in enumerate(lines, start=1):
            for rule, message in check_line(path, lineno, text, "", prefixes):
                if rule not in allowed:
                    findings.append((path, lineno, rule, message, text.strip()))

    if not findings:
        print("diff-lint: clean")
        return 0

    counts: dict[str, int] = {}
    for path, lineno, rule, message, text in findings:
        counts[rule] = counts.get(rule, 0) + 1
        print(f"{path}:{lineno}: [{rule}] {message}\n    {text[:160]}")
    summary = ", ".join(f"{rule}={count}" for rule, count in sorted(counts.items()))
    print(f"diff-lint: {len(findings)} finding(s) — {summary}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
