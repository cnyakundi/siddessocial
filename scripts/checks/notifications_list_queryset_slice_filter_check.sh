#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Notifications list does not filter after slice (sd_751) =="

F="backend/siddes_notifications/views.py"
if [[ ! -f "$F" ]]; then
  echo "❌ Missing: $F"
  exit 1
fi
echo "✅ $F"

PYBIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYBIN="python"
fi

"$PYBIN" - <<'PY'
import re, sys, pathlib

s = pathlib.Path("backend/siddes_notifications/views.py").read_text(encoding="utf-8", errors="ignore")

# Bug we are guarding against:
#   qs = ...order_by("-created_at")[:50]
#   ...
#   qs = qs.filter(side=side)
#
# Django disallows filtering after slicing (can crash the endpoint).
pat = re.compile(
    r'qs\s*=\s*Notification\.objects\.filter\(\s*viewer_id\s*=\s*viewer\s*\)\.order_by\(\s*"-created_at"\s*\)\s*\[:\s*\d+\s*\]'
    r'[\s\S]{0,600}?'
    r'qs\s*=\s*qs\.filter\(\s*side\s*=\s*side\s*\)',
    re.MULTILINE
)

if pat.search(s):
    print("❌ Bug detected: NotificationsListView slices before filtering by side.")
    print("   Fix: compute side first, filter(viewer_id=viewer, side=side), then order_by, then [:limit].")
    sys.exit(1)

print("✅ Notifications list queryset order OK (no slice→filter pattern).")
PY
