#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/output/loop/loop.pid"
LOCK_FILE="$ROOT_DIR/output/loop/loop.lock"

stop_pid() {
  local pid="$1"
  if ps -p "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.3
    if ps -p "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    echo "Stopped autonomous loop (PID: $pid)"
    return 0
  fi
  return 1
}

STOPPED=0

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${PID:-}" ]] && stop_pid "$PID"; then
    STOPPED=1
  fi
fi

if [[ -f "$LOCK_FILE" ]]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [[ -n "${LOCK_PID:-}" ]] && [[ "$LOCK_PID" != "${PID:-}" ]] && stop_pid "$LOCK_PID"; then
    STOPPED=1
  fi
fi

if [[ "$STOPPED" -eq 0 ]]; then
  echo "No running autonomous loop process found."
fi

rm -f "$PID_FILE" "$LOCK_FILE"
