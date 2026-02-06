#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/output/loop/loop.pid"
LOCK_FILE="$ROOT_DIR/output/loop/loop.lock"
NOHUP_LOG="$ROOT_DIR/output/loop/nohup.log"

mkdir -p "$ROOT_DIR/output/loop"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if ps -p "$EXISTING_PID" >/dev/null 2>&1; then
    echo "Autonomous loop already running (PID: $EXISTING_PID)"
    echo "Logs: $NOHUP_LOG"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if [[ -f "$LOCK_FILE" ]]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [[ -n "${LOCK_PID:-}" ]] && ps -p "$LOCK_PID" >/dev/null 2>&1; then
    echo "Autonomous loop already running (PID: $LOCK_PID)"
    echo "Logs: $NOHUP_LOG"
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi

cd "$ROOT_DIR"
nohup npm run loop:dev:continuous > "$NOHUP_LOG" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo "Started autonomous loop (PID: $NEW_PID)"
echo "Stop: bash scripts/stop_autonomous_loop.sh"
echo "Status: bash scripts/autonomous_loop_status.sh"
echo "Logs: tail -f $NOHUP_LOG"
