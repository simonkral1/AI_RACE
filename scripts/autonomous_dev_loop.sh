#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CYCLES=1
SLEEP_SECONDS=5
LOCK_FILE="$ROOT_DIR/output/loop/loop.lock"
PID_FILE="$ROOT_DIR/output/loop/loop.pid"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cycles)
      CYCLES="$2"
      shift 2
      ;;
    --sleep)
      SLEEP_SECONDS="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$ROOT_DIR/output/loop"
LOG_FILE="$ROOT_DIR/output/loop/dev-loop.log"

if [[ -f "$PID_FILE" ]]; then
  PID_FILE_VALUE="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${PID_FILE_VALUE:-}" ]] && ps -p "$PID_FILE_VALUE" >/dev/null 2>&1; then
    # When launched through loop:start, loop.pid points to the wrapper npm process.
    # Prevent starting a second foreground/parallel loop.
    if [[ "$PID_FILE_VALUE" != "$$" && "$PID_FILE_VALUE" != "${PPID:-}" ]]; then
      echo "Another autonomous loop is already running (PID: $PID_FILE_VALUE)." | tee -a "$LOG_FILE"
      exit 0
    fi
  else
    rm -f "$PID_FILE"
  fi
fi

if [[ -f "$LOCK_FILE" ]]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [[ -n "${LOCK_PID:-}" ]] && ps -p "$LOCK_PID" >/dev/null 2>&1; then
    echo "Another autonomous loop is already running (PID: $LOCK_PID)." | tee -a "$LOG_FILE"
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi
echo "$$" > "$LOCK_FILE"

DEV_STARTED=0
DEV_PID=""

if ! lsof -iTCP:5173 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  DEV_STARTED=1
  npm run dev -- --host 0.0.0.0 --port 5173 > "$ROOT_DIR/.vite.loop.log" 2>&1 &
  DEV_PID=$!

  for _ in $(seq 1 40); do
    if curl -sSf "http://localhost:5173" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

cleanup() {
  if [[ "$DEV_STARTED" == "1" && -n "$DEV_PID" ]]; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

run_cycle() {
  local cycle="$1"
  local seed=$((100 + cycle))

  echo "[$(date +'%Y-%m-%d %H:%M:%S')] cycle $cycle start" | tee -a "$LOG_FILE"

  npm test -- --run
  npm run build
  npm run sim -- --turns 24 --seed "$seed"

  OUT_DIR="$ROOT_DIR/output/loop/cycle-${cycle}" node "$ROOT_DIR/scripts/playtest_assert.mjs"

  echo "[$(date +'%Y-%m-%d %H:%M:%S')] cycle $cycle ok" | tee -a "$LOG_FILE"
}

if [[ "$CYCLES" == "0" ]]; then
  cycle=1
  while true; do
    run_cycle "$cycle"
    cycle=$((cycle + 1))
    sleep "$SLEEP_SECONDS"
  done
else
  for cycle in $(seq 1 "$CYCLES"); do
    run_cycle "$cycle"
    if [[ "$cycle" -lt "$CYCLES" ]]; then
      sleep "$SLEEP_SECONDS"
    fi
  done
fi
