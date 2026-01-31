#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_956_calm_unread_badges"
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

def patch(path: str) -> int:
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    before = s

    # Color: calm, neutral (no red alarm)
    s = s.replace("bg-red-500", "bg-gray-900")

    # Copy: standardize to Alerts language if any old strings remain
    s = s.replace('aria-label="New notifications"', 'aria-label="New alerts"')
    s = s.replace(" unread notifications", " unread alerts")

    if s != before:
        p.write_text(s, encoding="utf-8")
        return 1
    return 0

changed = 0
changed += patch("frontend/src/components/AppTopBar.tsx")
changed += patch("frontend/src/components/BottomNav.tsx")

print("CHANGED_FILES:", changed)
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** UI: Calm unread indicators — replace red badges with neutral; standardize a11y copy to “alerts”.\n" "$SD_ID" >> "$STATE"
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
echo "  - Top bell dot is neutral (not red)"
echo "  - BottomNav Alerts dot/count is neutral (not red)"
