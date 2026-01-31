#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_958_notifs_drawer_single_header"
NV="frontend/src/components/NotificationsView.tsx"
ND="frontend/src/components/NotificationsDrawer.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$NV" ]] || [[ ! -f "$ND" ]]; then
  echo "❌ Missing required files. Run from repo root."
  echo "Need: $NV and $ND"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$NV" "$BK/NotificationsView.tsx.bak"
cp -a "$ND" "$BK/NotificationsDrawer.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

MARK = "sd_958_notifs_drawer_single_header"

# --- Patch NotificationsView: add hideTitle prop + hide Activity H1 when requested ---
p = Path("frontend/src/components/NotificationsView.tsx")
s = p.read_text(encoding="utf-8")

if MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

# Signature: add hideTitle (only if not already present)
if "hideTitle" not in s:
    sig_re = re.compile(
        r'export\s+function\s+NotificationsView\(\s*\{\s*embedded\s*=\s*false\s*\}\s*:\s*\{\s*embedded\?\s*:\s*boolean\s*\}\s*\)\s*\{'
    )
    m = sig_re.search(s)
    if not m:
        raise SystemExit("ERROR: Could not locate NotificationsView() signature to patch.")
    s = sig_re.sub(
        'export function NotificationsView({ embedded = false, hideTitle = false }: { embedded?: boolean; hideTitle?: boolean }) {',
        s,
        count=1,
    )

# Replace first <h1 ...>Activity</h1> with conditional (only if not already wrapped)
if "Activity" in s and "hideTitle" in s and "{!hideTitle" not in s:
    h1_re = re.compile(r'(\s*)<h1([^>]*)>\s*Activity\s*</h1>')
    m = h1_re.search(s)
    if not m:
        raise SystemExit("ERROR: Could not find the Activity <h1> to gate.")
    indent = m.group(1)
    attrs = m.group(2)
    repl = (
        f'{indent}{{!hideTitle ? (\n'
        f'{indent}  <h1{attrs}>Activity</h1>\n'
        f'{indent}) : null}}'
    )
    s = h1_re.sub(repl, s, count=1)

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))

# --- Patch NotificationsDrawer: use embedded + hideTitle ---
d = Path("frontend/src/components/NotificationsDrawer.tsx")
t = d.read_text(encoding="utf-8")

# Prefer upgrading existing usage, whether embedded already exists or not.
t2 = t
t2 = re.sub(r'<NotificationsView\s+embedded\s*/>', '<NotificationsView embedded hideTitle />', t2, count=1)
t2 = re.sub(r'<NotificationsView\s*/>', '<NotificationsView embedded hideTitle />', t2, count=1)

if t2 == t:
    raise SystemExit("ERROR: Could not find <NotificationsView /> usage in NotificationsDrawer.tsx")
d.write_text(t2, encoding="utf-8")
print("PATCHED:", str(d))
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Alerts drawer: render NotificationsView embedded + hideTitle to avoid stacked headers (drawer header remains the only title).\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates (don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Tap bell (drawer opens)"
echo "  - You should NOT see a second big 'Activity' title under the drawer header"
echo "  - List + Mark Read should still work"
