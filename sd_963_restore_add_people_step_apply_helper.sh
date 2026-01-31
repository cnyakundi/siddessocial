#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_963_restore_add_people_step"
FILE="frontend/src/components/onboarding/steps/AddPeopleStep.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

echo "== ${SD_ID} =="
echo "Backup saved to: $BK/$FILE"
echo ""

# Restore from git (works on old + new git)
git restore "$FILE" 2>/dev/null || git checkout -- "$FILE"

echo "✅ Restored from git: $FILE"
