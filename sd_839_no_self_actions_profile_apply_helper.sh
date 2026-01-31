#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_839_no_self_actions_profile"
TS="$(date +%Y%m%d_%H%M%S)"

find_repo_root() {
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/frontend" ]] && [[ -d "$d/backend" ]] && [[ -d "$d/scripts" ]]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [[ -z "${ROOT:-}" ]]; then
  echo "ERROR: Run from inside the repo (must contain ./frontend ./backend ./scripts)." >&2
  echo "Tip: cd /Users/cn/Downloads/sidesroot" >&2
  exit 1
fi

cd "$ROOT"

F1="frontend/src/components/PrismProfile.tsx"
F2="frontend/src/app/u/[username]/page.tsx"

for f in "$F1" "$F2"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing $f" >&2
    exit 1
  fi
done

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$F1")" "$BK/$(dirname "$F2")"
cp -a "$F1" "$BK/$F1"
cp -a "$F2" "$BK/$F2"

PYBIN=""
if command -v python3 >/dev/null 2>&1; then
  PYBIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYBIN="python"
else
  echo "ERROR: python3 required." >&2
  exit 1
fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

# ---------- PrismProfile.tsx: add isSelf + guard ----------
p = Path("frontend/src/components/PrismProfile.tsx")
t = p.read_text(encoding="utf-8")
orig = t

# Ensure SideActionButtons props include isSelf?: boolean
if "export function SideActionButtons" in t and "isSelf?:" not in t:
    t = re.sub(
        r'(export function SideActionButtons\s*\(props:\s*\{\s*\n)',
        r'\1  isSelf?: boolean; // sd_839_no_self_actions_profile\n',
        t,
        count=1,
        flags=re.M,
    )

# Insert early return if props.isSelf
if "export function SideActionButtons" in t and "sd_839_self_guard" not in t:
    # Insert after destructure line
    t = re.sub(
        r'(export function SideActionButtons[\s\S]*?\{\s*\n\s*const\s*\{\s*viewerSidedAs\s*,\s*onOpenSheet\s*\}\s*=\s*props;\s*\n)',
        r'\1\n  // sd_839_self_guard: never show "Add Friend"/Side controls on your own profile\n  if (props.isSelf) return null;\n',
        t,
        count=1,
        flags=re.S,
    )

if t != orig:
    p.write_text(t, encoding="utf-8")
    print("OK: patched", p)
else:
    print("OK: PrismProfile.tsx no changes needed")

# ---------- /u/[username]/page.tsx: pass isSelf + hide Follow on self ----------
p2 = Path("frontend/src/app/u/[username]/page.tsx")
u = p2.read_text(encoding="utf-8")
u0 = u

# Pass isSelf={isOwner} into SideActionButtons (first occurrence)
# If already passed, skip.
m = re.search(r'<SideActionButtons\b', u)
if m:
    window = u[m.start():m.start()+220]
    if "isSelf=" not in window:
        u = u.replace("<SideActionButtons ", "<SideActionButtons isSelf={isOwner} ", 1)

# Hide Follow button on your own profile (public follow is nonsensical on self)
# Change {viewSide === "public" ? ( ... ) : null} => {viewSide === "public" && !isOwner ? ( ... ) : null}
u = re.sub(
    r'\{\s*viewSide\s*===\s*"public"\s*\?\s*\(',
    r'{viewSide === "public" && !isOwner ? (',
    u,
    count=1,
)

if u != u0:
    p2.write_text(u, encoding="utf-8")
    print("OK: patched", p2)
else:
    print("OK: /u page no changes needed")
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo "  cd \"$ROOT/frontend\" && npm run build"
echo ""
echo "Smoke:"
echo "  - Open /u/<you> (public + friends): NO Add Friend, NO Follow."
echo "  - Open /u/<someone>: Add Friend/Side and Follow should still appear as normal."
