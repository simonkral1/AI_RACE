#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPT_FILE="$ROOT_DIR/docs/CODEX_WEB_AGENT_AUTONOMOUS_PROMPT.md"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

if command -v pbcopy >/dev/null 2>&1; then
  pbcopy < "$PROMPT_FILE"
  echo "Prompt copied to clipboard from $PROMPT_FILE"
else
  echo "pbcopy not available. Prompt file: $PROMPT_FILE"
fi
