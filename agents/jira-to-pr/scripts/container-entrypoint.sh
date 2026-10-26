#!/usr/bin/env bash
# Container entrypoint: wire git to use GH_TOKEN over HTTPS, then exec the command.
# Never echoes the token.
set -eu

if [ -n "${GH_TOKEN:-}" ]; then
  git config --global url."https://x-access-token:${GH_TOKEN}@github.com/".insteadOf git@github.com:
fi
git config --global --replace-all safe.directory '*'

exec "$@"
