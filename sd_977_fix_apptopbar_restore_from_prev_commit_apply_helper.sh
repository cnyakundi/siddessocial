#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_977_fix_apptopbar_restore_from_prev_commit"
FILE="frontend/src/components/AppTopBar.tsx"
SRC="HEAD~1"

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

# Verify SRC exists
git cat-file -e "${SRC}^{commit}" >/dev/null 2>&1 || {
  echo "❌ Could not find ${SRC}. (Not enough history?)"
  exit 1
}

# Restore file content from previous commit (even if current HEAD is broken)
git show "${SRC}:${FILE}" > "${FILE}"

echo "✅ Restored ${FILE} from ${SRC}"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .. && docker compose -f ops/docker/docker-compose.dev.yml restart frontend"
echo "  bash scripts/run_tests.sh --smoke"
