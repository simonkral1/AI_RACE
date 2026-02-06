#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/output/loop/loop.pid"
LOCK_FILE="$ROOT_DIR/output/loop/loop.lock"
LOG_FILE="$ROOT_DIR/output/loop/dev-loop.log"
NOHUP_LOG="$ROOT_DIR/output/loop/nohup.log"

RUNNING_PID=""

if [[ -f "$LOCK_FILE" ]]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [[ -n "${LOCK_PID:-}" ]] && ps -p "$LOCK_PID" >/dev/null 2>&1; then
    RUNNING_PID="$LOCK_PID"
  fi
fi

if [[ -z "$RUNNING_PID" && -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${PID:-}" ]] && ps -p "$PID" >/dev/null 2>&1; then
    RUNNING_PID="$PID"
  fi
fi

if [[ -n "$RUNNING_PID" ]]; then
  echo "Status: RUNNING (PID $RUNNING_PID)"
else
  echo "Status: STOPPED"
fi

echo "dev-loop log: $LOG_FILE"
echo "nohup log: $NOHUP_LOG"
echo "pid file: $PID_FILE"
echo "lock file: $LOCK_FILE"

if [[ -f "$LOG_FILE" ]]; then
  echo "--- last 12 lines of dev-loop.log ---"
  tail -n 12 "$LOG_FILE"
fi
