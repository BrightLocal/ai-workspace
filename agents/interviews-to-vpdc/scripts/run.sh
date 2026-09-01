#!/usr/bin/env bash
# interviews-to-vpdc pipeline runner
#
# Usage:
#   ./scripts/run.sh <research-slug> <path-to-input-folder>
#   ./scripts/run.sh <research-slug> <path-to-input-folder> --skip-fit
#   ./scripts/run.sh <research-slug> <path-to-input-folder> --skip-hypotheses
#   ./scripts/run.sh <research-slug> <path-to-input-folder> --skip-audit
#   ./scripts/run.sh <research-slug> <path-to-input-folder> --skip-backlog
#   ./scripts/run.sh <research-slug> <path-to-input-folder> --interactive
#
# Environment:
#   ACTIVE_PRODUCT — product slug under products/ (default: Tools)
#
# The input folder must contain:
#   brief*        — research goals + interview script
#   respondents*  — respondent list with segments
#   transcripts/  — one file per interview
#
# This script sets up the working directory and prints the suggested
# Claude Code invocations. It does NOT directly invoke subagents — Claude Code
# does that based on the agent files in .claude/agents/.

set -euo pipefail

# --- argument parsing ---
if [ $# -lt 2 ]; then
    echo "Usage: $0 <research-slug> <path-to-input-folder> [--skip-fit] [--skip-hypotheses] [--skip-audit] [--skip-backlog] [--interactive]"
    exit 1
fi

RESEARCH_SLUG="$1"
INPUT_FOLDER="$2"
shift 2

SKIP_FIT=false
SKIP_HYPOTHESES=false
SKIP_AUDIT=false
SKIP_BACKLOG=false
INTERACTIVE=false

for arg in "$@"; do
    case "$arg" in
        --skip-fit)         SKIP_FIT=true ;;
        --skip-hypotheses)  SKIP_HYPOTHESES=true ;;
        --skip-audit)       SKIP_AUDIT=true ;;
        --skip-backlog)     SKIP_BACKLOG=true ;;
        --interactive)      INTERACTIVE=true ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

# --- environment ---
ACTIVE_PRODUCT="${ACTIVE_PRODUCT:-Tools}"
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PRODUCT_DIR="$WORKSPACE_ROOT/products/$ACTIVE_PRODUCT"
WORKING_DIR="$PRODUCT_DIR/working/$RESEARCH_SLUG"
INPUTS_DIR="$WORKING_DIR/00-inputs"

# --- validation ---
if [ ! -d "$PRODUCT_DIR" ]; then
    echo "Error: product '$ACTIVE_PRODUCT' not found at $PRODUCT_DIR"
    echo "Set ACTIVE_PRODUCT or create the product folder."
    exit 1
fi

if [ ! -d "$INPUT_FOLDER" ]; then
    echo "Error: input folder not found: $INPUT_FOLDER"
    exit 1
fi

BRIEF_FILE="$(find "$INPUT_FOLDER" -maxdepth 1 -type f -iname 'brief*' | head -n 1)"
RESPONDENTS_FILE="$(find "$INPUT_FOLDER" -maxdepth 1 -type f -iname 'respondents*' | head -n 1)"
TRANSCRIPTS_SRC="$INPUT_FOLDER/transcripts"

if [ -z "$BRIEF_FILE" ]; then
    echo "Error: no brief* file found in $INPUT_FOLDER"
    exit 1
fi

if [ -z "$RESPONDENTS_FILE" ]; then
    echo "Error: no respondents* file found in $INPUT_FOLDER"
    exit 1
fi

if [ ! -d "$TRANSCRIPTS_SRC" ]; then
    echo "Error: no transcripts/ folder found in $INPUT_FOLDER"
    exit 1
fi

TRANSCRIPT_COUNT="$(find "$TRANSCRIPTS_SRC" -maxdepth 1 -type f | wc -l | tr -d ' ')"
if [ "$TRANSCRIPT_COUNT" -eq 0 ]; then
    echo "Error: transcripts/ folder is empty"
    exit 1
fi

RESPONDENT_ROWS="$(grep -cE '^\s*(\||[-*]|[0-9]+\.)\s*[[:alnum:]]' "$RESPONDENTS_FILE" 2>/dev/null || echo 0)"
if [ "$RESPONDENT_ROWS" -gt 0 ] && [ "$RESPONDENT_ROWS" -ne "$TRANSCRIPT_COUNT" ]; then
    echo "Warning: ~$RESPONDENT_ROWS respondent rows vs $TRANSCRIPT_COUNT transcript files."
    echo "         Phase 0 (research-intake) will resolve the mapping and list anomalies."
    echo ""
fi

# --- prepare working directory ---
mkdir -p "$INPUTS_DIR/transcripts"
cp "$BRIEF_FILE" "$INPUTS_DIR/"
cp "$RESPONDENTS_FILE" "$INPUTS_DIR/"
cp "$TRANSCRIPTS_SRC"/* "$INPUTS_DIR/transcripts/"

WORKING_REL="products/$ACTIVE_PRODUCT/working/$RESEARCH_SLUG"

echo "================================================================"
echo "  interviews-to-vpdc pipeline"
echo "================================================================"
echo "  Product:        $ACTIVE_PRODUCT"
echo "  Research slug:  $RESEARCH_SLUG"
echo "  Input folder:   $INPUT_FOLDER"
echo "  Working dir:    $WORKING_DIR"
echo "  Transcripts:    $TRANSCRIPT_COUNT"
echo "  Skip fit:       $SKIP_FIT"
echo "  Skip hypoth.:   $SKIP_HYPOTHESES"
echo "  Skip audit:     $SKIP_AUDIT"
echo "  Skip backlog:   $SKIP_BACKLOG"
echo "  Interactive:    $INTERACTIVE"
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
echo "  Phase 0: /agent research-intake \"working_dir: $WORKING_REL\""
echo "    Output: $WORKING_REL/01-research-map.md"

if [ "$INTERACTIVE" = true ]; then
    echo "    [HUMAN GATE A: verify the roster and segment mapping before Phase 1]"
fi

echo ""
echo "  Phase 1: one invocation per transcript (respondent slugs come from the roster in 01-research-map.md):"
FIRST=true
find "$INPUTS_DIR/transcripts" -maxdepth 1 -type f | sort | while read -r f; do
    fname="$(basename "$f")"
    echo "    /agent interview-analyzer \"transcript: 00-inputs/transcripts/$fname, respondent: <rNN-slug from roster>, working_dir: $WORKING_REL\""
    if [ "$FIRST" = true ] && [ "$INTERACTIVE" = true ]; then
        echo "    [HUMAN GATE B (optional): spot-check this first insights file before the rest]"
    fi
    FIRST=false
done
echo "    Output: $WORKING_REL/02-insights/{rNN-slug}.md (one per interview)"

echo ""
echo "  Phase 2: /agent profile-synthesizer \"working_dir: $WORKING_REL\""
echo "    Output: $WORKING_REL/03-customer-profile.md"

if [ "$INTERACTIVE" = true ]; then
    echo "    [HUMAN GATE C: review clusters and ranking — edit 03-customer-profile.md directly]"
fi

if [ "$SKIP_FIT" = false ]; then
    echo ""
    echo "  Phase 3: /agent value-map-fitter \"working_dir: $WORKING_REL\""
    echo "    Output: $WORKING_REL/04-value-map-fit.md"
fi

if [ "$SKIP_HYPOTHESES" = false ]; then
    echo ""
    echo "  Phase 4: /agent hypothesis-generator \"working_dir: $WORKING_REL\""
    echo "    Output: $WORKING_REL/05-hypotheses.md"

    if [ "$SKIP_AUDIT" = false ]; then
        echo ""
        echo "  Phase 5: /agent evidence-auditor \"working_dir: $WORKING_REL\""
        echo "    Output: appended to 05-hypotheses.md"
    fi
fi

echo ""
echo "  Phase 6: /agent research-report-writer \"working_dir: $WORKING_REL\""
echo "    Output: $WORKING_REL/06-research-report.md"
echo "    [HUMAN GATE D — MANDATORY: review the report. Confluence publication"
echo "     happens ONLY when you explicitly invoke Phase 7 yourself.]"
echo ""
echo "  Phase 7 (only after your explicit go-ahead):"
echo "    /agent confluence-publisher \"working_dir: $WORKING_REL\""
echo "    Output: Confluence page + $WORKING_REL/08-publication-log.md"

if [ "$SKIP_BACKLOG" = false ]; then
    echo ""
    echo "  Phase 8: /agent backlog-drafter \"working_dir: $WORKING_REL\""
    echo "    Output: $WORKING_REL/07-backlog/ (markdown drafts — manual transfer, no Jira)"
fi

echo ""
echo "Final artifacts: $WORKING_DIR/06-research-report.md and 07-backlog/"
echo ""
echo "================================================================"
