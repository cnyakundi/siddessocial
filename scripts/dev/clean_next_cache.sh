#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND="$ROOT/frontend"

echo "== Cleaning Next.js dev/build artifacts =="
echo "Root: $ROOT"
echo "Frontend: $FRONTEND"

if [[ -d "$FRONTEND/.next" ]]; then
  rm -rf "$FRONTEND/.next"
  echo "✅ Removed: frontend/.next"
else
  echo "ℹ️  frontend/.next not present"
fi

if [[ -d "$FRONTEND/node_modules/.cache" ]]; then
  rm -rf "$FRONTEND/node_modules/.cache"
  echo "✅ Removed: frontend/node_modules/.cache"
else
  echo "ℹ️  frontend/node_modules/.cache not present"
fi

echo "Done."
