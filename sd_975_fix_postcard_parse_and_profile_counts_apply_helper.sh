#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_975_fix_postcard_parse_and_profile_counts"

find_repo_root () {
  local d
  d="$(pwd)"
  while [ "$d" != "/" ]; do
    if [ -d "$d/.git" ] && [ -f "$d/frontend/src/components/PostCard.tsx" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "❌ ERROR: Run inside the repo (must contain .git and frontend/src/components/PostCard.tsx)."
  exit 1
fi

cd "$ROOT"

POST="frontend/src/components/PostCard.tsx"
PROFILE="frontend/src/app/u/[username]/page.tsx"

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$POST")" "$BK/$(dirname "$PROFILE")"

cp -a "$POST" "$BK/$POST"
if [ -f "$PROFILE" ]; then
  cp -a "$PROFILE" "$BK/$PROFILE"
fi

echo "== $SD_ID =="
echo "Backup:"
echo "  $BK/$POST"
[ -f "$PROFILE" ] && echo "  $BK/$PROFILE"
echo ""

echo "Restoring PostCard.tsx from HEAD (fixes JSX parse break)…"
git restore --source=HEAD --staged --worktree -- "$POST" 2>/dev/null || git checkout -- "$POST"
echo "✅ Restored: $POST"
echo ""

if [ -f "$PROFILE" ]; then
  python3 - <<'PY'
from pathlib import Path
import re, sys

p = Path("frontend/src/app/u/[username]/page.tsx")
s = p.read_text(encoding="utf-8", errors="strict")
orig = s

# If the file passes publicFollowers/publicFollowing variables that don't exist,
# replace them with inline data access to avoid TS2304.
if "publicFollowers={publicFollowers}" in s and not re.search(r"\bconst\s+publicFollowers\b", s):
    s = s.replace("publicFollowers={publicFollowers}", "publicFollowers={((data as any)?.publicFollowers ?? null)}")
if "publicFollowing={publicFollowing}" in s and not re.search(r"\bconst\s+publicFollowing\b", s):
    s = s.replace("publicFollowing={publicFollowing}", "publicFollowing={((data as any)?.publicFollowing ?? null)}")

if s != orig:
    p.write_text(s if s.endswith("\n") else s + "\n", encoding="utf-8")
    print("✅ Patched profile counts props to use inline data (avoids missing vars).")
else:
    print("ℹ️  Profile page: no missing publicFollowers/publicFollowing prop vars detected (no change).")
PY
fi

echo ""
echo "✅ $SD_ID applied."
echo "Backup saved to: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "If HTTP smoke is still 500 after build passes, restart frontend container:"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart frontend"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$POST\" \"$POST\""
[ -f "$PROFILE" ] && echo "  cp \"$BK/$PROFILE\" \"$PROFILE\""
