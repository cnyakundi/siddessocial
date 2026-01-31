#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_976_restore_postcard_to_origin_main"
FILE="frontend/src/components/PostCard.tsx"

# find repo root safely
find_repo_root () {
  local d
  d="$(pwd)"
  while [ "$d" != "/" ]; do
    if [ -d "$d/.git" ] && [ -f "$d/$FILE" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "❌ ERROR: Run inside the repo that contains .git and $FILE"
  exit 1
fi

cd "$ROOT"

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

echo "== $SD_ID =="
echo "Backup: $BK/$FILE"
echo ""

# Prefer restoring from origin/main if available; otherwise HEAD.
SRC="HEAD"
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  if git show "origin/main:$FILE" >/dev/null 2>&1; then
    SRC="origin/main"
  fi
fi

echo "Restoring $FILE from $SRC …"
git restore --source="$SRC" --staged --worktree -- "$FILE" 2>/dev/null || git checkout -- "$FILE"

echo "✅ Restored: $FILE"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "If your API smoke is still 500 AFTER build passes:"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart frontend"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
