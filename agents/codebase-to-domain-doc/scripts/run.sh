#!/usr/bin/env bash
# codebase-to-domain-doc pipeline runner
#
# Usage:
#   ./scripts/run.sh <domain-slug> <input-file>
#   ./scripts/run.sh <domain-slug> <input-file> --repos Tools,ListingSyncer
#   ./scripts/run.sh <domain-slug> <input-file> --mode tree|seed
#   ./scripts/run.sh <domain-slug> <input-file> --skip-gaps
#   ./scripts/run.sh <domain-slug> <input-file> --interactive
#
# Environment:
#   ACTIVE_PRODUCT — product slug under products/ (default: Tools).
#                    Selects the OUTPUT home only; the repos scanned come
#                    exclusively from --repos.
#
# The input file is either:
#   definitions-*.md — a definitions tree (indented markdown bullets)
#   seed-*.md        — a seed list of module/entity names (one per line)
# Filename detection can be overridden with --mode.
#
# This script sets up the working directory and prints the suggested
# Claude Code invocations. It does NOT directly invoke subagents — Claude Code
# does that based on the agent files in .claude/agents/.

set -euo pipefail

# --- argument parsing ---
if [ $# -lt 2 ]; then
    echo "Usage: $0 <domain-slug> <input-file> [--repos Tools,ListingSyncer] [--mode tree|seed] [--skip-gaps] [--interactive]"
    exit 1
fi

DOMAIN_SLUG="$1"
INPUT_FILE="$2"
shift 2

REPOS="Tools,ListingSyncer"
MODE=""
SKIP_GAPS=false
INTERACTIVE=false

while [ $# -gt 0 ]; do
    case "$1" in
        --repos)
            [ $# -ge 2 ] || { echo "Error: --repos needs a value (e.g. Tools,ListingSyncer)"; exit 1; }
            REPOS="$2"; shift 2 ;;
        --mode)
            [ $# -ge 2 ] || { echo "Error: --mode needs a value (tree or seed)"; exit 1; }
            MODE="$2"; shift 2
            if [ "$MODE" != "tree" ] && [ "$MODE" != "seed" ]; then
                echo "Error: --mode must be 'tree' or 'seed', got '$MODE'"; exit 1
            fi ;;
        --skip-gaps)    SKIP_GAPS=true; shift ;;
        --interactive)  INTERACTIVE=true; shift ;;
        *) echo "Unknown flag: $1"; exit 1 ;;
    esac
done

# --- environment ---
ACTIVE_PRODUCT="${ACTIVE_PRODUCT:-Tools}"
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PRODUCT_DIR="$WORKSPACE_ROOT/products/$ACTIVE_PRODUCT"
WORKING_DIR="$PRODUCT_DIR/working/$DOMAIN_SLUG"
INPUTS_DIR="$WORKING_DIR/00-inputs"

# --- validation ---
if [ ! -d "$PRODUCT_DIR" ]; then
    echo "Error: product '$ACTIVE_PRODUCT' not found at $PRODUCT_DIR"
    echo "Set ACTIVE_PRODUCT or create the product folder."
    exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: input file not found: $INPUT_FILE"
    exit 1
fi

if [ ! -s "$INPUT_FILE" ]; then
    echo "Error: input file is empty: $INPUT_FILE"
    exit 1
fi

# --- mode detection ---
if [ -z "$MODE" ]; then
    INPUT_BASENAME="$(basename "$INPUT_FILE")"
    case "$INPUT_BASENAME" in
        seed*)                  MODE="seed" ;;
        definitions*|tree*)     MODE="tree" ;;
        *)
            echo "Error: cannot detect mode from filename '$INPUT_BASENAME'."
            echo "Name the file definitions-*.md (tree) or seed-*.md (seed), or pass --mode tree|seed."
            exit 1 ;;
    esac
fi

# --- repo validation ---
REPO_LIST="$(echo "$REPOS" | tr ',' ' ')"
for repo in $REPO_LIST; do
    REPO_PATH="$WORKSPACE_ROOT/products/$repo/codebase/$repo"
    if [ ! -d "$REPO_PATH" ]; then
        echo "Error: repo '$repo' does not resolve to a directory."
        echo "Expected a symlink (or clone) at: products/$repo/codebase/$repo"
        exit 1
    fi
done

# --- prepare working directory ---
mkdir -p "$INPUTS_DIR"
cp "$INPUT_FILE" "$INPUTS_DIR/"

REPO_STATE="$INPUTS_DIR/repo-state.md"
{
    echo "# Repo state: $DOMAIN_SLUG"
    echo ""
    echo "> Captured by scripts/run.sh on $(date +%Y-%m-%d). Evidence in this run"
    echo "> is valid against these revisions."
    echo ""
    echo "| Repo | Path | SHA | Last commit date |"
    echo "|---|---|---|---|"
    for repo in $REPO_LIST; do
        REPO_PATH="$WORKSPACE_ROOT/products/$repo/codebase/$repo"
        SHA="$(git -C "$REPO_PATH" rev-parse --short HEAD 2>/dev/null || echo "not a git checkout")"
        LAST_DATE="$(git -C "$REPO_PATH" log -1 --format=%cs 2>/dev/null || echo "—")"
        echo "| $repo | products/$repo/codebase/$repo | $SHA | $LAST_DATE |"
    done
} > "$REPO_STATE"

WORKING_REL="products/$ACTIVE_PRODUCT/working/$DOMAIN_SLUG"

echo "================================================================"
echo "  codebase-to-domain-doc pipeline"
echo "================================================================"
echo "  Product (output): $ACTIVE_PRODUCT"
echo "  Domain slug:      $DOMAIN_SLUG"
echo "  Input file:       $INPUT_FILE"
echo "  Mode:             $MODE"
echo "  Repos scanned:    $REPOS"
echo "  Working dir:      $WORKING_DIR"
echo "  Skip gaps:        $SKIP_GAPS"
echo "  Interactive:      $INTERACTIVE"
echo "================================================================"
echo ""
echo "Run these commands in Claude Code (cd to workspace root first):"
echo ""
echo "  export ACTIVE_PRODUCT=$ACTIVE_PRODUCT"
echo "  cd $WORKSPACE_ROOT"
echo "  claude"
echo ""
echo "Then in the Claude Code session, invoke the subagents in order:"
echo ""
echo "  Phase 0: /agent definition-intake \"working_dir: $WORKING_REL, mode: $MODE, repos: $REPOS\""
echo "    Output: $WORKING_REL/01-definition-registry.md"

if [ "$MODE" = "seed" ]; then
    echo "    [HUMAN GATE A — MANDATORY in seed mode: the tree was drafted by the"
    echo "     intake. Approve or edit 01-definition-registry.md before Phase 1.]"
elif [ "$INTERACTIVE" = true ]; then
    echo "    [HUMAN GATE A: verify the tree, IDs, and research units before Phase 1]"
fi

echo ""
echo "  Phase 1: one invocation per research unit (units come from the"
echo "           'Research units' table in 01-definition-registry.md):"
echo "    /agent branch-researcher \"unit: <bNN-slug from registry>, working_dir: $WORKING_REL\""
if [ "$INTERACTIVE" = true ]; then
    echo "    [HUMAN GATE B (optional): spot-check the first research file before the rest]"
fi
echo "    Output: $WORKING_REL/02-research/{bNN-slug}.md (one per unit;"
echo "            existing files are skipped — delete a file to redo its unit)"

echo ""
echo "  Phase 2: /agent domain-doc-writer \"working_dir: $WORKING_REL\""
echo "    Output: $WORKING_REL/03-domain-definitions.md"

echo ""
if [ "$SKIP_GAPS" = true ]; then
    echo "  Phase 3: /agent gap-auditor \"working_dir: $WORKING_REL, skip_gaps: true\""
    echo "    Output: $WORKING_REL/04-evidence-map.md (gaps report skipped)"
else
    echo "  Phase 3: /agent gap-auditor \"working_dir: $WORKING_REL\""
    echo "    Output: $WORKING_REL/04-evidence-map.md + 05-knowledge-gaps.md"
fi

if [ "$INTERACTIVE" = true ]; then
    echo "    [HUMAN GATE C: review 03 + 05 together — edit 03-domain-definitions.md directly]"
fi

echo "    [HUMAN GATE D — MANDATORY: review the document. Confluence publication"
echo "     happens ONLY when you explicitly invoke Phase 4 yourself.]"
echo ""
echo "  Phase 4 (only after your explicit go-ahead):"
echo "    /agent confluence-publisher \"working_dir: $WORKING_REL\""
echo "    Output: Confluence page + $WORKING_REL/06-publication-log.md"
echo ""
echo "Final artifacts: $WORKING_DIR/03-domain-definitions.md,"
echo "                 04-evidence-map.md and 05-knowledge-gaps.md"
echo ""
echo "================================================================"
