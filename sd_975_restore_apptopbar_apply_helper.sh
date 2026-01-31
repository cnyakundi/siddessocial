#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_975_restore_apptopbar"
FILE="frontend/src/components/AppTopBar.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

echo "== ${SD_ID} =="
echo "Backup: $BK/$FILE"
echo ""

git restore "$FILE" 2>/dev/null || git checkout -- "$FILE"
echo "✅ Restored from git: $FILE"

echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
