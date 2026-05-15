#!/usr/bin/env bash
# Clones or updates the repositories the agent will work with.
# The list of repos is taken from config/repos.txt (one line = one git URL).
#
# Usage:
#   ./scripts/clone-repos.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE="$ROOT_DIR/workspace"
REPOS_FILE="$ROOT_DIR/config/repos.txt"

mkdir -p "$WORKSPACE"

if [[ ! -f "$REPOS_FILE" ]]; then
    echo "ERROR: $REPOS_FILE not found"
    echo "Create the file and add git URLs to it, one per line"
    exit 1
fi

while IFS= read -r repo_url || [[ -n "$repo_url" ]]; do
    # Skip empty lines and comments
    [[ -z "$repo_url" || "$repo_url" =~ ^# ]] && continue

    # Extract repo name from URL
    repo_name=$(basename "$repo_url" .git)
    target_dir="$WORKSPACE/$repo_name"

    if [[ -d "$target_dir/.git" ]]; then
        echo "→ Updating $repo_name..."
        cd "$target_dir"
        # Preserve local changes if any — in real usage there should be none
        if [[ -n "$(git status --porcelain)" ]]; then
            echo "  ⚠️  Working tree is not clean in $repo_name — skipping pull"
            continue
        fi
        # Determine default branch
        default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
        git fetch origin --prune
        git checkout "$default_branch"
        git pull --rebase origin "$default_branch"
    else
        echo "→ Cloning $repo_name..."
        git clone "$repo_url" "$target_dir"
    fi
done < "$REPOS_FILE"

echo "✓ Done. Repositories are in $WORKSPACE"
