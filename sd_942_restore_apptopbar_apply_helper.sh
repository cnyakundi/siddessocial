#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_942_restore_apptopbar"
ROOT="$(pwd)"
FILE="frontend/src/components/AppTopBar.tsx"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "❌ Run from repo root (must contain ./frontend and ./backend)"
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$FILE")"

cp -a "$FILE" "$BK/$FILE"
echo "Backup saved to: $BK/$FILE"

echo ""
echo "Restoring AppTopBar.tsx from git HEAD…"
git checkout -- "$FILE"
echo "✅ Restored: $FILE"

echo ""
echo "Next (VS Code terminal):"
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck"
echo "  npm run build"
echo "  cd .. && bash scripts/run_tests.sh --smoke"
