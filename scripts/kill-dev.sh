#!/usr/bin/env bash
set -euo pipefail

# Kill any Vite dev server bound to port 3000 (macOS)
PIDS=$(lsof -tiTCP:3000 -sTCP:LISTEN || true)
if [[ -n "${PIDS:-}" ]]; then
  echo "Killing processes on port 3000: $PIDS"
  kill $PIDS || true
fi

# Also kill lingering vite processes just in case
VITE_PIDS=$(pgrep -f "vite" || true)
if [[ -n "${VITE_PIDS:-}" ]]; then
  echo "Killing vite processes: $VITE_PIDS"
  kill $VITE_PIDS || true
fi

exit 0
