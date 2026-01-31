#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_836_self_target_guard_global"
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

FILES=(
  "frontend/src/components/PrismProfile.tsx"
  "frontend/src/app/u/[username]/page.tsx"
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing $f" >&2
    exit 1
  fi
done

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/frontend/src/components" "$BK/frontend/src/app/u/[username]"
cp -a "frontend/src/components/PrismProfile.tsx" "$BK/frontend/src/components/PrismProfile.tsx"
cp -a "frontend/src/app/u/[username]/page.tsx" "$BK/frontend/src/app/u/[username]/page.tsx"

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

# ---------- Patch PrismProfile.tsx ----------
p = Path("frontend/src/components/PrismProfile.tsx")
t = p.read_text(encoding="utf-8")
orig = t

# 1) Unhide PrismSideTabs buttons (only inside PrismSideTabs function)
if "export function PrismSideTabs" in t:
    start = t.find("export function PrismSideTabs")
    # Find next export after start (best-effort boundary)
    nxt = t.find("\nexport function", start + 10)
    end = nxt if nxt != -1 else len(t)
    block = t[start:end]
    if "<button hidden" in block:
        block2 = block.replace("<button hidden", "<button", 1)
        block2 = block2.replace("<button hidden", "<button")
        t = t[:start] + block2 + t[end:]

# 2) SideActionButtons: add isSelf?: boolean and early return
# Add prop in the inline props type
if "export function SideActionButtons(props:" in t and "isSelf?:" not in t:
    t = re.sub(
        r'(export function SideActionButtons\s*\(props:\s*\{\s*\n)',
        r'\1  isSelf?: boolean; // sd_836\n',
        t,
        count=1,
        flags=re.M,
    )

# Add early guard after destructure
if "export function SideActionButtons" in t and "sd_836_self_guard" not in t:
    t = re.sub(
        r'(export function SideActionButtons\s*\(props:\s*\{[\s\S]*?\}\)\s*\{\s*\n\s*const\s*\{\s*viewerSidedAs\s*,\s*onOpenSheet\s*\}\s*=\s*props;\s*\n)',
        r'\1\n  // sd_836_self_guard: never show "Add Friend" / side actions on your own profile\n  if (props.isSelf) return null;\n',
        t,
        count=1,
        flags=re.S,
    )

if t != orig:
    p.write_text(t, encoding="utf-8")
    print("OK: patched", p)
else:
    print("OK: PrismProfile.tsx no changes needed.")

# ---------- Patch /u/[username]/page.tsx ----------
p2 = Path("frontend/src/app/u/[username]/page.tsx")
u = p2.read_text(encoding="utf-8")
u0 = u

# 3) Pass isSelf={isOwner} into SideActionButtons on profile page (defense in depth)
# Only if not already passed.
pat = r'<SideActionButtons\s+'
m = re.search(pat, u)
if m and "isSelf=" not in u[m.start(): m.start()+200]:
    # Insert isSelf prop right after component name
    u = u.replace("<SideActionButtons ", "<SideActionButtons isSelf={isOwner} ", 1)

# 4) Hide Follow button on own profile (even if something regresses)
# Convert `{viewSide === "public" ? (` -> `{viewSide === "public" && !isOwner ? (`
u = re.sub(
    r'\{(\s*viewSide\s*===\s*"public"\s*)\?\s*\(',
    r'{\1&& !isOwner ? (',
    u,
    count=1
)

if u != u0:
    p2.write_text(u, encoding="utf-8")
    print("OK: patched", p2)
else:
    print("OK: /u page no changes needed.")
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo "  cd \"$ROOT/frontend\" && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Open your own /u/<you> (any side): you should NOT see Add Friend or Follow."
echo "  2) PrismSideTabs (if used) should no longer be accidentally hidden."
