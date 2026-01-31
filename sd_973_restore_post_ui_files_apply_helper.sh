#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_973_restore_post_ui_files"
ROOT="${1:-.}"

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
  REPO="$(cd "$ROOT" && pwd)"
else
  REPO="$(find_root "$(cd "$ROOT" && pwd)" || true)"
fi

if [ -z "${REPO:-}" ]; then
  echo "❌ Could not find repo root (expected frontend/ and backend/)."
  exit 1
fi

cd "$REPO"

FILES=(
  "frontend/src/components/PostCard.tsx"
  "frontend/src/components/EchoSheet.tsx"
  "frontend/src/components/PostActionsSheet.tsx"
  "frontend/src/components/DesktopSideDock.tsx"
)

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
echo "== ${SD_ID} =="
echo "Repo: $REPO"
echo "Backup: $BK"
echo ""

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BK/$(dirname "$f")"
    cp -a "$f" "$BK/$f"
    echo "🧷 Backed up: $f"
  else
    echo "⚠️ Missing (skip backup): $f"
  fi
done

echo ""
echo "== Restoring from git =="
for f in "${FILES[@]}"; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    git restore "$f" 2>/dev/null || git checkout -- "$f"
    echo "✅ Restored: $f"
  else
    echo "⚠️ Not tracked by git (skip): $f"
  fi
done

echo ""
echo "Next:"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart frontend"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .. && bash scripts/run_tests.sh --smoke"
echo ""
echo "Rollback (if needed):"
echo "  cp \"$BK/frontend/src/components/PostCard.tsx\" \"frontend/src/components/PostCard.tsx\""
