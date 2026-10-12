#!/usr/bin/env -S python3 -I
"""Read-only SSH into a dev environment (dev1..dev9) as the `sites` user.

    agents/dev-env-inspector/scripts/dev-ssh.py <devX> '<command>' [--timeout 60]

The command is validated against an allowlist of read-only programs before anything is sent.
Pipes are allowed; redirections, command chaining, subshells, background jobs, file-writing
programs and interactive / follow modes are not. Every argument is re-quoted before it reaches
the remote shell, so `$(...)`, backticks and variables are passed literally (globs still work).
Runs as `sites` via `sudo -n su - sites -c` (same as `ssh devX; sudo su sites`).

Nothing goes to a dev env this way — code changes go through Deployer.
"""

import argparse
import re
import shlex
import subprocess
import sys

HOST = re.compile(r"^dev[1-9]$")
SAFE_UNQUOTED = re.compile(r"^[A-Za-z0-9_./*?:=@%+,~-]+$")
OPERATORS = {";", "&", "&&", "||", ">", ">>", "<", "<<", "<<<", ">|", "(", ")", "|&", "&>", ">&", "<&"}

READ_ONLY = {
    "cat", "zcat", "head", "tail", "grep", "egrep", "fgrep", "zgrep", "ls", "wc", "sort", "uniq",
    "cut", "tr", "date", "uptime", "df", "du", "free", "ps", "pgrep", "stat", "file", "jq", "find",
    "hostname", "whoami", "id", "nproc", "readlink", "realpath", "column",
    "docker", "journalctl", "systemctl", "crontab", "php", "nl", "rev", "md5sum", "sha1sum",
}
DOCKER_SUBCOMMANDS = {"ps", "logs", "inspect", "stats", "top", "images", "exec", "version", "info"}
SYSTEMCTL_SUBCOMMANDS = {"status", "is-active", "is-enabled", "list-units", "list-timers", "show"}
FIND_FORBIDDEN = {"-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"}
JOURNALCTL_FORBIDDEN = ("--vacuum", "--rotate", "--flush", "--sync", "--relinquish", "--setup-keys", "--update-catalog")
FOLLOW_FLAGS = {"-f", "-F", "--follow", "--follow=name", "--follow=descriptor"}
SECRET_PATH = re.compile(r"(^|/)\.env(\.|$)|credentials|secret|\.pem$|\.key$|id_rsa|pubsub_credentials", re.I)


class Rejected(Exception):
    pass


def check_program(argv, inside_container=False):
    prog, args = argv[0], argv[1:]
    if prog not in READ_ONLY:
        raise Rejected(f"'{prog}' is not on the read-only allowlist")
    if inside_container and prog in {"docker", "systemctl", "crontab", "journalctl"}:
        raise Rejected(f"'{prog}' is not allowed inside a container")
    follow_capable = prog in {"tail", "journalctl"} or (prog == "docker" and args[:1] == ["logs"])
    if follow_capable and any(a in FOLLOW_FLAGS or re.fullmatch(r"-[a-zA-Z]*f[a-zA-Z]*", a) for a in args):
        raise Rejected("follow mode (-f/--follow) would never return — use --tail/-n with --since instead")
    for a in args:
        if prog in {"cat", "zcat", "head", "tail", "grep", "egrep", "fgrep", "zgrep", "jq", "nl"} and SECRET_PATH.search(a):
            raise Rejected(f"reading '{a}' could expose secrets")
    if prog == "find" and FIND_FORBIDDEN.intersection(args):
        raise Rejected("find with -delete/-exec/-fprint* is not read-only")
    if prog == "journalctl" and any(a.startswith(JOURNALCTL_FORBIDDEN) for a in args):
        raise Rejected("journalctl maintenance flags are not read-only")
    if prog == "systemctl" and (not args or args[0] not in SYSTEMCTL_SUBCOMMANDS):
        raise Rejected(f"systemctl only allows: {', '.join(sorted(SYSTEMCTL_SUBCOMMANDS))}")
    if prog == "crontab" and args != ["-l"]:
        raise Rejected("crontab only allows -l")
    if prog == "sort" and any(a == "-o" or a.startswith(("-o", "--output")) for a in args):
        raise Rejected("sort -o writes a file")
    if prog == "uniq" and len([a for a in args if not a.startswith("-")]) > 1:
        raise Rejected("uniq with an output file writes a file")
    if prog == "file" and any(a.startswith("-C") or a == "--compile" for a in args):
        raise Rejected("file -C writes a magic file")
    if prog == "date" and any(not a.startswith("+") and a not in {"-u", "--utc", "-I", "-R"} for a in args):
        raise Rejected("date may only format (+FORMAT, -u, -I, -R)")
    if prog == "hostname" and args:
        raise Rejected("hostname takes no arguments here")
    if prog == "php" and args not in (["-v"], ["-m"], ["--version"]):
        raise Rejected("php only allows -v / -m (no scripts, no bin/console)")
    if prog == "docker":
        check_docker(args)


def check_docker(args):
    if not args or args[0] not in DOCKER_SUBCOMMANDS:
        raise Rejected(f"docker only allows: {', '.join(sorted(DOCKER_SUBCOMMANDS))}")
    sub, rest = args[0], args[1:]
    if sub == "inspect":
        fmt = next((rest[i + 1] for i, a in enumerate(rest[:-1]) if a in {"--format", "-f"}), None)
        fmt = fmt or next((a.split("=", 1)[1] for a in rest if a.startswith("--format=")), None)
        if fmt is None or re.search(r"\.Env|json \.Config\b|json \.\s*}}|^\{\{\s*json\s*\.\s*\}\}$", fmt):
            raise Rejected("docker inspect needs a --format that does not include .Env/.Config (secrets)")
    if sub == "stats" and "--no-stream" not in rest:
        raise Rejected("docker stats needs --no-stream")
    if sub == "exec":
        # docker exec [-w DIR] <container> <cmd...> — no -i/-t/-u/-e/-d/--privileged.
        i = 0
        while i < len(rest) and rest[i].startswith("-"):
            if rest[i] in {"-w", "--workdir"}:
                i += 2
                continue
            raise Rejected(f"docker exec flag '{rest[i]}' is not allowed (only -w)")
        if len(rest) - i < 2:
            raise Rejected("docker exec needs <container> <command>")
        check_program(rest[i + 1:], inside_container=True)


def validate(command):
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>()")
    lexer.whitespace_split = True
    tokens = list(lexer)
    if not tokens:
        raise Rejected("empty command")
    if "\n" in command:
        raise Rejected("multi-line commands are not allowed")
    segments, current = [], []
    for tok in tokens:
        if tok == "|":
            if not current:
                raise Rejected("empty pipe segment")
            segments.append(current)
            current = []
        elif tok in OPERATORS or (set(tok) <= set(";&|<>()") and tok):
            raise Rejected(f"shell operator '{tok}' is not allowed (only |)")
        else:
            current.append(tok)
    if not current:
        raise Rejected("command ends with a pipe")
    segments.append(current)
    for seg in segments:
        check_program(seg)
    return segments


def render(segments):
    quote = lambda t: t if SAFE_UNQUOTED.match(t) else shlex.quote(t)
    return " | ".join(" ".join(quote(t) for t in seg) for seg in segments)


def main():
    p = argparse.ArgumentParser(description="Read-only command on a dev env as `sites`.")
    p.add_argument("host")
    p.add_argument("command")
    p.add_argument("--timeout", type=int, default=60)
    a = p.parse_args()

    if not HOST.match(a.host):
        sys.exit(f"[dev-ssh] refused: host must be dev1..dev9, got '{a.host}'")
    try:
        remote = render(validate(a.command))
    except (Rejected, ValueError) as e:
        sys.exit(f"[dev-ssh] refused: {e}")

    remote = f"sudo -n su - sites -c {shlex.quote(remote)}"
    ssh = ["ssh", "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", a.host, remote]
    try:
        res = subprocess.run(ssh, timeout=a.timeout)
    except subprocess.TimeoutExpired:
        sys.exit(f"[dev-ssh] timed out after {a.timeout}s — narrow the command (--tail, --since, head)")
    sys.exit(res.returncode)


if __name__ == "__main__":
    main()
