#!/usr/bin/env bash
# Fixture test for scripts/diff-lint.py. Builds a throw-away git repo, adds a diff with
# one violation per rule plus two lines that must NOT be flagged, and checks the result.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINT="$SCRIPT_DIR/../diff-lint.py"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/diff-lint-test.XXXXXX")"
trap 'find "$TMP" -delete 2>/dev/null || true' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

git -C "$TMP" init -q -b master
git -C "$TMP" config user.email test@example.com
git -C "$TMP" config user.name test
mkdir -p "$TMP/src"
cat > "$TMP/src/AlertsFinder.php" <<'PHP'
<?php
final class AlertsFinder
{
    public function find(Request $request): array
    {
        $data = $request->all();
        $dateFormat = 'ISO-8601';
        return $data;
    }
}
PHP
git -C "$TMP" add . && git -C "$TMP" commit -q -m "base"
git -C "$TMP" checkout -q -b task/LM-1-test

cat > "$TMP/src/AlertsFinder.php" <<'PHP'
<?php
final class AlertsFinder
{
    public function find(Request $request): array
    {
        $data = $request->toArray();            // pre-existing name on a changed line
        $dateFormat = 'ISO-8601';
        $row = $data[0];                        // expect generic-name
        // see LM-4358 for the original report   // expect key rule
        // added for the new alert inbox         // expect narration rule
        // TODO handle the empty case            // expect open-point rule
        $this->process($data);                  // a call, not a declaration
        return $data;
    }
}
PHP
cat > "$TMP/src/AlertsMapper.php" <<'PHP'
<?php
final class AlertsMapper
{
    public function map(array $alerts): array
    {
        $mapped = [];
        foreach ($alerts as $item) {            // expect generic-name, untracked file
            $mapped[] = $item;
        }
        return $mapped;
    }
}
PHP

set +e
OUTPUT="$(python3 -I -B "$LINT" --repo "$TMP" --base master)"
STATUS=$?
set -e
echo "$OUTPUT"
[[ $STATUS -eq 1 ]] || fail "expected exit 1 with findings, got $STATUS"
echo "$OUTPUT" | grep -q 'change-narration=1, generic-name=2, ticket-ref=1, todo=1' || fail "unexpected summary"
echo "$OUTPUT" | grep -q 'AlertsFinder.php:8: \[generic-name\] \$row' || fail "\$row not flagged"
echo "$OUTPUT" | grep -q 'AlertsMapper.php:7: \[generic-name\] \$item' || fail "\$item in untracked file not flagged"
echo "$OUTPUT" | grep -q 'ISO-8601' && fail "ISO-8601 must not count as a ticket"
echo "$OUTPUT" | grep -q 'AlertsFinder.php:6:' && fail "pre-existing \$data on a changed line must not be flagged"
echo "$OUTPUT" | grep -q 'AlertsFinder.php:12:' && fail "a call argument must not be flagged"

# --allow skips a rule
set +e
python3 -I -B "$LINT" --repo "$TMP" --base master --allow generic-name --allow ticket-ref --allow todo --allow change-narration >/dev/null
STATUS=$?
set -e
[[ $STATUS -eq 0 ]] || fail "--allow for every rule should exit 0, got $STATUS"

# fixed version is clean
cat > "$TMP/src/AlertsFinder.php" <<'PHP'
<?php
final class AlertsFinder
{
    public function find(Request $request): array
    {
        $data = $request->toArray();
        $dateFormat = 'ISO-8601';
        $firstAlert = $data[0];
        $this->process($data);
        return $data;
    }
}
PHP
cat > "$TMP/src/AlertsMapper.php" <<'PHP'
<?php
final class AlertsMapper
{
    public function map(array $alerts): array
    {
        $mapped = [];
        foreach ($alerts as $alert) {
            $mapped[] = $alert;
        }
        return $mapped;
    }
}
PHP
python3 -I -B "$LINT" --repo "$TMP" --base master | grep -q 'diff-lint: clean' || fail "fixed diff should be clean"

# --staged sees only the index
git -C "$TMP" add src/AlertsMapper.php
printf '\n// FIXME later\n' >> "$TMP/src/AlertsFinder.php"
python3 -I -B "$LINT" --repo "$TMP" --staged | grep -q 'diff-lint: clean' || fail "--staged must ignore unstaged FIXME"
echo "PASS: diff-lint fixture test"
