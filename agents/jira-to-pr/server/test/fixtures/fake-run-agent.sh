#!/usr/bin/env bash
# Fake run-agent.sh for dispatcher tests. Controlled by env:
#   FAKE_MODE=write|sleep|none  FAKE_RESULT=<json>  FAKE_ECHO_ARGS=1
RUN_DIR="$RUNS_DIR/$2"
mkdir -p "$RUN_DIR"
case "${FAKE_MODE:-write}" in
  sleep) sleep 5 ;;
  none) exit "${FAKE_EXIT:-0}" ;;
  write)
    if [[ "${FAKE_ECHO_ARGS:-}" == "1" ]]; then
      jq -n --arg s "$*" '{status:"done",summary:$s}' > "$RUN_DIR/result.json"
    else
      printf '%s' "$FAKE_RESULT" > "$RUN_DIR/result.json"
    fi
    exit "${FAKE_EXIT:-0}" ;;
esac
