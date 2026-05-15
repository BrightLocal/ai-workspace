#!/usr/bin/env bash
# context-to-prd pipeline runner
#
# Usage:
#   ./scripts/run.sh <feature-slug> <path-to-input-file>
#   ./scripts/run.sh <feature-slug> <path-to-input-file> --skip-metrics
#   ./scripts/run.sh <feature-slug> <path-to-input-file> --skip-feasibility
#   ./scripts/run.sh <feature-slug> <path-to-input-file> --interactive
#
# Environment:
#   ACTIVE_PRODUCT — product slug under products/ (default: BrightLocal)
#
# This script sets up the working directory and prints the suggested
# Claude Code invocations. It does NOT directly invoke subagents — Claude Code
# does that based on the agent files in .claude/agents/.

set -euo pipefail

# --- argument parsing ---
if [ $# -lt 2 ]; then
    echo "Usage: $0 <feature-slug> <path-to-input-file> [--skip-metrics] [--skip-feasibility] [--interactive]"
    exit 1
fi

FEATURE_SLUG="$1"
INPUT_FILE="$2"
shift 2

SKIP_METRICS=false
SKIP_FEASIBILITY=false
INTERACTIVE=false

for arg in "$@"; do
    case "$arg" in
        --skip-metrics)      SKIP_METRICS=true ;;
        --skip-feasibility)  SKIP_FEASIBILITY=true ;;
        --interactive)       INTERACTIVE=true ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

# --- environment ---
ACTIVE_PRODUCT="${ACTIVE_PRODUCT:-BrightLocal}"
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PRODUCT_DIR="$WORKSPACE_ROOT/products/$ACTIVE_PRODUCT"
WORKING_DIR="$PRODUCT_DIR/working/$FEATURE_SLUG"

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

# --- prepare working directory ---
mkdir -p "$WORKING_DIR"
cp "$INPUT_FILE" "$WORKING_DIR/00-input.md"

echo "================================================================"
echo "  context-to-prd pipeline"
echo "================================================================"
echo "  Product:       $ACTIVE_PRODUCT"
echo "  Feature slug:  $FEATURE_SLUG"
echo "  Input file:    $INPUT_FILE"
echo "  Working dir:   $WORKING_DIR"
echo "  Skip metrics:  $SKIP_METRICS"
echo "  Skip feas.:    $SKIP_FEASIBILITY"
echo "  Interactive:   $INTERACTIVE"
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
echo "  Phase 1: /agent context-analyzer"
echo "    Input: products/$ACTIVE_PRODUCT/working/$FEATURE_SLUG/00-input.md"
echo "    Output: products/$ACTIVE_PRODUCT/working/$FEATURE_SLUG/01-context.md"

if [ "$INTERACTIVE" = true ]; then
    echo "    [HUMAN GATE: review 01-context.md before proceeding]"
fi

if [ "$SKIP_METRICS" = false ]; then
    echo ""
    echo "  Phase 2: /agent metrics-checker"
    echo "    Input: 01-context.md"
    echo "    Output: 02-metrics-review.md"

    if [ "$INTERACTIVE" = true ]; then
        echo "    [HUMAN GATE: optional review of 02-metrics-review.md]"
    fi
fi

echo ""
echo "  Phase 3: /agent prd-writer"
echo "    Input: 01-context.md, 02-metrics-review.md (if exists)"
echo "    Output: 03-prd.md"

if [ "$INTERACTIVE" = true ]; then
    echo "    [HUMAN GATE: review 03-prd.md before architect critique]"
fi

if [ "$SKIP_FEASIBILITY" = false ]; then
    echo ""
    echo "  Phase 4: /agent feasibility-reviewer"
    echo "    Input: 03-prd.md"
    echo "    Output: appended to 03-prd.md"
fi

echo ""
echo "Final artifact: $WORKING_DIR/03-prd.md"
echo ""
echo "================================================================"
