#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_957_calm_unread_dot_only"
TOP="frontend/src/components/AppTopBar.tsx"
NAV="frontend/src/components/BottomNav.tsx"
STATE="docs/STATE.md"

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
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

def patch_apptopbar():
    p = Path("frontend/src/components/AppTopBar.tsx")
    s = p.read_text(encoding="utf-8")
    before = s

    # Neutral dot (no red alarm)
    s = s.replace("bg-red-500", "bg-gray-900")

    # Copy hygiene (if present)
    s = s.replace('aria-label="New notifications"', 'aria-label="New alerts"')

    if s != before:
        p.write_text(s, encoding="utf-8")
        print("PATCHED:", str(p))
    else:
        print("OK: no changes needed in", str(p))

def patch_bottomnav():
    p = Path("frontend/src/components/BottomNav.tsx")
    s = p.read_text(encoding="utf-8")
    before = s

    # Neutral badge color
    s = s.replace("bg-red-500", "bg-gray-900")

    # Dot-only: showDot when n>0; never showCount in chrome
    s = re.sub(r'const\s+showDot\s*=\s*n\s*>\s*0\s*&&\s*n\s*<\s*10\s*;', 'const showDot = n > 0; // sd_957 dot-only', s)
    s = re.sub(r'const\s+showCount\s*=\s*n\s*>=\s*10\s*;', 'const showCount = false; // sd_957 dot-only', s)

    # Older strings (if any remain)
    s = s.replace(" unread notifications", " unread alerts")
    s = s.replace('aria-label="New notifications"', 'aria-label="New alerts"')

    if s != before:
        p.write_text(s, encoding="utf-8")
        print("PATCHED:", str(p))
    else:
        print("OK: no changes needed in", str(p))

patch_apptopbar()
patch_bottomnav()
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Calm chrome: unread indicators are dot-only + neutral (no numeric badges); counts live inside Alerts list.\n" "$SD_ID" >> "$STATE"
fi

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
echo "  - BottomNav Alerts shows a neutral dot (no numbers) when unread"
echo "  - AppTopBar bell dot is neutral"
echo "  - Inside Alerts, 'Mark all read (N)' still shows the real unread count"
