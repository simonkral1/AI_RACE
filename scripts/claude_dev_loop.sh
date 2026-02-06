#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/simon/Repositories/agi_race"
QUEUE="$ROOT/scripts/task_queue.json"
LOG_DIR="$ROOT/output/overnight"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CLAUDE_LOG="$LOG_DIR/claude-$TIMESTAMP.log"

log() { echo "[$(date +'%H:%M:%S')] $*" | tee -a "$CLAUDE_LOG"; }

cd "$ROOT"

log "=== CLAUDE AUTONOMOUS DEV LOOP STARTED ==="
log "Task queue: $QUEUE"

COMPLETED_COUNT=0
MAX_TASKS=${1:-20}

while [[ $COMPLETED_COUNT -lt $MAX_TASKS ]]; do
  # Get next pending task by priority
  TASK=$(jq -r '.tasks | map(select(.status == "pending")) | sort_by(.priority) | .[0] // empty' "$QUEUE")

  if [[ -z "$TASK" || "$TASK" == "null" ]]; then
    log "No pending tasks in queue. Exiting."
    break
  fi

  TASK_ID=$(echo "$TASK" | jq -r '.id')
  TASK_TYPE=$(echo "$TASK" | jq -r '.type')
  TASK_FILE=$(echo "$TASK" | jq -r '.file // .name')
  TASK_PRIORITY=$(echo "$TASK" | jq -r '.priority')

  log "=== Processing Task $TASK_ID (Priority $TASK_PRIORITY) ==="
  log "Type: $TASK_TYPE, Target: $TASK_FILE"

  # Mark task as in-progress
  jq --argjson id "$TASK_ID" '.tasks |= map(if .id == $id then .status = "in_progress" else . end)' "$QUEUE" > "$QUEUE.tmp" && mv "$QUEUE.tmp" "$QUEUE"

  # Build prompt based on task type
  case "$TASK_TYPE" in
    test)
      PROMPT="Create or enhance the test file $TASK_FILE for the AGI Race game. Ensure comprehensive coverage of the module being tested. Run npm test after to verify."
      ;;
    e2e)
      PROMPT="Create or enhance the E2E test file $TASK_FILE for the AGI Race game using Playwright. Cover the main user flows. Run npx playwright test after to verify."
      ;;
    feature)
      PROMPT="Implement the feature '$TASK_FILE' for the AGI Race game. Write tests for the feature. Run npm test and npm run build after to verify."
      ;;
    *)
      PROMPT="Complete task: $TASK_TYPE for $TASK_FILE in AGI Race game. Run tests after."
      ;;
  esac

  log "Prompt: $PROMPT"

  # Run Claude Code for this task
  if claude --print "$PROMPT" \
    --allowedTools "Read,Write,Edit,Bash,Glob,Grep" \
    --max-turns 30 2>&1 | tee -a "$CLAUDE_LOG"; then
    TASK_STATUS="completed"
    log "Task $TASK_ID completed successfully"
  else
    TASK_STATUS="failed"
    log "Task $TASK_ID failed"
  fi

  # Update task status
  jq --argjson id "$TASK_ID" --arg status "$TASK_STATUS" '.tasks |= map(if .id == $id then .status = $status else . end)' "$QUEUE" > "$QUEUE.tmp" && mv "$QUEUE.tmp" "$QUEUE"

  # Run validation
  log "Running validation suite..."
  if npm test -- --run 2>&1 | tee -a "$CLAUDE_LOG" && npm run build 2>&1 | tee -a "$CLAUDE_LOG"; then
    log "Validation passed"
  else
    log "Validation failed - continuing to next task"
  fi

  COMPLETED_COUNT=$((COMPLETED_COUNT + 1))
  log "Completed $COMPLETED_COUNT/$MAX_TASKS tasks"

  # Brief pause between tasks
  sleep 10
done

log "=== CLAUDE AUTONOMOUS DEV LOOP COMPLETED ==="
log "Processed $COMPLETED_COUNT tasks"

# Summary
PENDING=$(jq '[.tasks[] | select(.status == "pending")] | length' "$QUEUE")
COMPLETED=$(jq '[.tasks[] | select(.status == "completed")] | length' "$QUEUE")
FAILED=$(jq '[.tasks[] | select(.status == "failed")] | length' "$QUEUE")

log "Summary: $COMPLETED completed, $FAILED failed, $PENDING pending"
