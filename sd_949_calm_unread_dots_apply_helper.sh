#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_949_calm_unread_dots"
TOP="frontend/src/components/AppTopBar.tsx"
NAV="frontend/src/components/BottomNav.tsx"

if [[ ! -f "$TOP" ]] || [[ ! -f "$NAV" ]]; then
  echo "❌ Missing required files. Run from repo root."
  echo "Need: $TOP and $NAV"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$TOP" "$BK/AppTopBar.tsx.bak"
cp -a "$NAV" "$BK/BottomNav.tsx.bak"
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

def patch_file(path: str) -> int:
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    before = s

    # Only touch the red used for unread indicators/badges.
    # AppTopBar: bell dot uses bg-red-500
    # BottomNav: dot + count uses bg-red-500

    # Replace bg-red-500 -> bg-gray-900 only in these components
    s = s.replace("bg-red-500", "bg-gray-900")

    if s != before:
        p.write_text(s, encoding="utf-8")
        return 1
    return 0

changed = 0
changed += patch_file("frontend/src/components/AppTopBar.tsx")
changed += patch_file("frontend/src/components/BottomNav.tsx")

print("CHANGED_FILES:", changed)
PY

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Bell dot should be neutral (not red)"
echo "  - BottomNav unread dot/count should be neutral (not red)"
