#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOOP_PID_FILE="$ROOT_DIR/output/loop/browser-gameplay-loop.pid"
LOOP_LOG_FILE="$ROOT_DIR/output/loop/browser-gameplay-loop.log"
WATCHDOG_LOG_FILE="$ROOT_DIR/output/loop/browser-gameplay-watchdog.log"

mkdir -p "$ROOT_DIR/output/loop"

start_loop() {
  nohup bash -lc '
set +e
cycle=1
while true; do
  ts=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$ts] browser-loop cycle $cycle start"
  npx playwright test tests/e2e/game.spec.ts tests/e2e/endgame.spec.ts --reporter=line
  rc=$?
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] browser-loop cycle $cycle exit=$rc"
  cycle=$((cycle + 1))
  sleep 20
done
' >> "$LOOP_LOG_FILE" 2>&1 &
  echo $! > "$LOOP_PID_FILE"
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] watchdog: started browser loop pid=$(cat "$LOOP_PID_FILE")" >> "$WATCHDOG_LOG_FILE"
}

is_loop_running() {
  if [[ ! -f "$LOOP_PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$LOOP_PID_FILE" 2>/dev/null || true)"
  [[ -n "$pid" ]] && ps -p "$pid" >/dev/null 2>&1
}

echo "[$(date +"%Y-%m-%d %H:%M:%S")] watchdog: active" >> "$WATCHDOG_LOG_FILE"

while true; do
  if ! is_loop_running; then
    start_loop
  else
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] watchdog: loop healthy pid=$(cat "$LOOP_PID_FILE")" >> "$WATCHDOG_LOG_FILE"
  fi
  sleep 30
done

