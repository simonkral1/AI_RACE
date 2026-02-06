#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/simon/Repositories/agi_race"
LOG_DIR="$ROOT/output/overnight"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SESSION_LOG="$LOG_DIR/session-$TIMESTAMP.log"
METRICS_FILE="$LOG_DIR/metrics-$TIMESTAMP.json"

log() { echo "[$(date +'%H:%M:%S')] $*" | tee -a "$SESSION_LOG"; }

cd "$ROOT"

# Initialize metrics
PASSED_CYCLES=0
FAILED_CYCLES=0
TOTAL_TESTS=0

# Validation pipeline
validate() {
  local cycle=$1
  local step_failed=0

  log "Cycle $cycle: Type checking..."
  if ! npx tsc --noEmit 2>&1 | tee -a "$SESSION_LOG"; then
    log "Cycle $cycle: Type check FAILED"
    step_failed=1
  fi

  if [[ $step_failed -eq 0 ]]; then
    log "Cycle $cycle: Running unit tests..."
    local test_output
    if test_output=$(npm test -- --run 2>&1); then
      echo "$test_output" | tee -a "$SESSION_LOG"
      # Extract test count
      local tests_passed=$(echo "$test_output" | grep -o '[0-9]* passed' | head -1 | grep -o '[0-9]*' || echo "0")
      TOTAL_TESTS=$((TOTAL_TESTS + tests_passed))
    else
      echo "$test_output" | tee -a "$SESSION_LOG"
      log "Cycle $cycle: Unit tests FAILED"
      step_failed=1
    fi
  fi

  if [[ $step_failed -eq 0 ]]; then
    log "Cycle $cycle: Building..."
    if ! npm run build 2>&1 | tee -a "$SESSION_LOG"; then
      log "Cycle $cycle: Build FAILED"
      step_failed=1
    fi
  fi

  if [[ $step_failed -eq 0 ]]; then
    log "Cycle $cycle: Running E2E tests..."
    # Use only the fast game.spec.ts tests (skip slow endgame tests)
    if ! npx playwright test tests/e2e/game.spec.ts --reporter=list 2>&1 | tee -a "$SESSION_LOG"; then
      log "Cycle $cycle: E2E tests FAILED"
      step_failed=1
    fi
  fi

  if [[ $step_failed -eq 0 ]]; then
    log "Cycle $cycle: Running simulation..."
    if ! npm run sim -- --turns 20 --seed $cycle 2>&1 | tee -a "$SESSION_LOG"; then
      log "Cycle $cycle: Simulation FAILED"
      step_failed=1
    fi
  fi

  return $step_failed
}

# Write metrics to JSON
write_metrics() {
  cat > "$METRICS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "session_id": "$TIMESTAMP",
  "total_cycles": $((PASSED_CYCLES + FAILED_CYCLES)),
  "passed_cycles": $PASSED_CYCLES,
  "failed_cycles": $FAILED_CYCLES,
  "total_tests_run": $TOTAL_TESTS,
  "last_cycle": $cycle,
  "status": "$(if [[ $FAILED_CYCLES -eq 0 ]]; then echo "healthy"; else echo "issues_detected"; fi)"
}
EOF
}

# Trap to write metrics on exit
trap write_metrics EXIT

# Main loop
cycle=1
MAX_CYCLES=${1:-200}
SLEEP_BETWEEN=${2:-60}

log "=== OVERNIGHT DEV LOOP STARTED ==="
log "Max cycles: $MAX_CYCLES, Sleep between: ${SLEEP_BETWEEN}s"
log "Session log: $SESSION_LOG"

while [[ $cycle -le $MAX_CYCLES ]]; do
  log "=== CYCLE $cycle/$MAX_CYCLES ==="

  if validate $cycle; then
    log "✓ Cycle $cycle PASSED"
    PASSED_CYCLES=$((PASSED_CYCLES + 1))
    echo '{"ok":true,"cycle":'$cycle',"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > "$LOG_DIR/latest.json"
  else
    log "✗ Cycle $cycle FAILED"
    FAILED_CYCLES=$((FAILED_CYCLES + 1))
    echo '{"ok":false,"cycle":'$cycle',"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > "$LOG_DIR/latest.json"
  fi

  # Update metrics every cycle
  write_metrics

  ((cycle++))

  if [[ $cycle -le $MAX_CYCLES ]]; then
    log "Sleeping ${SLEEP_BETWEEN}s before next cycle..."
    sleep $SLEEP_BETWEEN
  fi
done

log "=== OVERNIGHT DEV LOOP COMPLETED ==="
log "Results: $PASSED_CYCLES passed, $FAILED_CYCLES failed out of $MAX_CYCLES cycles"
