#!/usr/bin/env bash
# Container entrypoint: wire git to use GH_TOKEN over HTTPS, set the commit author, then exec
# the command. Everything goes to the container's global git config (HOME is fresh in the
# container) — never the repos' own .git/config. Never echoes the token.
set -eu

if [ -n "${GH_TOKEN:-}" ]; then
  git config --global url."https://x-access-token:${GH_TOKEN}@github.com/".insteadOf git@github.com:
fi
git config --global --replace-all safe.directory '*'

# Commit author for the agent's commits (Vadym's identity, from .env).
[ -n "${GIT_AUTHOR_NAME:-}" ] && git config --global user.name "$GIT_AUTHOR_NAME"
[ -n "${GIT_AUTHOR_EMAIL:-}" ] && git config --global user.email "$GIT_AUTHOR_EMAIL"
if [ -z "${GIT_AUTHOR_NAME:-}" ] || [ -z "${GIT_AUTHOR_EMAIL:-}" ]; then
  echo "WARNING: GIT_AUTHOR_NAME and/or GIT_AUTHOR_EMAIL is not set in .env — the agent's" \
       "git commits will fail (no author identity). Set both and recreate the container." >&2
fi

exec "$@"
