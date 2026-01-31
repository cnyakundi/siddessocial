#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_974_restore_postcard_to_head"

find_repo_root () {
  local d
  d="$(pwd)"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ] && [ -d "$d/.git" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "❌ ERROR: Run inside the repo (must contain frontend/, backend/, and .git/)."
  exit 1
fi

cd "$ROOT"

FILE="frontend/src/components/PostCard.tsx"
if [ ! -f "$FILE" ]; then
  echo "❌ ERROR: Missing $FILE"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$FILE")"

cp -a "$FILE" "$BK/$FILE"

echo "== $SD_ID =="
echo "Backup saved to: $BK/$FILE"
echo ""
echo "Restoring $FILE from HEAD…"

# Restore both index + working tree to HEAD for this file
git restore --source=HEAD --staged --worktree -- "$FILE" 2>/dev/null || git checkout -- "$FILE"

echo "✅ Restored: $FILE"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  cd .. && ./verify_overlays.sh"
echo ""
echo "If the dev server is still returning 500s after this:"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart frontend"
echo ""
echo "Rollback (bring back your broken-but-backed-up version):"
echo "  cp \"$BK/$FILE\" \"$FILE\""
