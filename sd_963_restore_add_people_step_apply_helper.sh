#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_963_restore_add_people_step"
ROOT="${1:-.}"

# Find repo root (expects frontend/ and backend/)
find_root() {
  local d="$1"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

if [ -d "$ROOT/frontend" ] && [ -d "$ROOT/backend" ]; then
  REPO="$ROOT"
else
  REPO="$(find_root "$(cd "$ROOT" && pwd)" || true)"
fi

if [ -z "${REPO:-}" ]; then
  echo "❌ Could not find repo root (expected frontend/ and backend/)."
  echo "Run from repo root, e.g.:"
  echo "  cd /Users/cn/Downloads/sidesroot"
  echo "  ./${SD_ID}_apply_helper.sh /Users/cn/Downloads/sidesroot"
  exit 1
fi

cd "$REPO"

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
echo "Repo: $REPO"
echo "Backup: $BK/$FILE"
echo ""

# Restore from git (works on old + new git)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git restore "$FILE" 2>/dev/null || git checkout -- "$FILE"
  echo "✅ Restored from git: $FILE"
else
  echo "❌ Not a git repo? (git rev-parse failed)"
  echo "Backup is still available at: $BK/$FILE"
  exit 1
fi

echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  npm run build"
echo "  cd .. && bash scripts/run_tests.sh --smoke"
