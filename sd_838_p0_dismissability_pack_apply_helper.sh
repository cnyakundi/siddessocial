#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_838_p0_dismissability_pack"
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
  "frontend/src/app/u/[username]/page.tsx"
  "frontend/src/components/ProfilePeekSheet.tsx"
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing $f" >&2
    exit 1
  fi
done

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/frontend/src/app/u/[username]" "$BK/frontend/src/components"
cp -a "frontend/src/app/u/[username]/page.tsx" "$BK/frontend/src/app/u/[username]/page.tsx"
cp -a "frontend/src/components/ProfilePeekSheet.tsx" "$BK/frontend/src/components/ProfilePeekSheet.tsx"

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

def unhide_backdrop_buttons(text: str) -> str:
    # Only unhide BACKDROP buttons (absolute inset-0 bg-black/... backdrop-blur...)
    text = re.sub(
        r'<button\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/[0-9]{2,3} backdrop-blur-sm")',
        r'<button\1',
        text,
        flags=re.M,
    )
    # Also allow bg-black/30 without digits in className line (common)
    text = re.sub(
        r'<button\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/30 backdrop-blur-sm")',
        r'<button\1',
        text,
        flags=re.M,
    )
    return text

def unhide_hidden_website_anchor(text: str) -> str:
    # In /u/:username About sheet: <a hidden className=... href=...>
    text = re.sub(r'<a\s+hidden(\s*\n\s*className=)', r'<a\1', text, flags=re.M)
    return text

# Patch profile page
p = Path("frontend/src/app/u/[username]/page.tsx")
t = p.read_text(encoding="utf-8")
orig = t

t = unhide_backdrop_buttons(t)
t = unhide_hidden_website_anchor(t)

# Do NOT unhide arbitrary "hidden" buttons (feature flags) — only the backdrop + website link.
if t != orig:
    p.write_text(t, encoding="utf-8")
    print("OK: patched", p)
else:
    print("OK: no changes needed", p)

# Patch ProfilePeekSheet (backdrop must be clickable)
p2 = Path("frontend/src/components/ProfilePeekSheet.tsx")
s = p2.read_text(encoding="utf-8")
orig2 = s

s = unhide_backdrop_buttons(s)

# Cosmetic: ensure the backdrop closing tag isn't glued to the panel <div> (readability)
s = s.replace("/>      <div", "/>\n\n      <div")

if s != orig2:
    p2.write_text(s, encoding="utf-8")
    print("OK: patched", p2)
else:
    print("OK: no changes needed", p2)
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
echo "  1) Long-press profile peek (PostCard) -> tap outside should close the sheet."
echo "  2) /u/<someone> About sheet -> tap outside should close (if About is enabled)."
echo "  3) Website link in About (if shown) should be clickable."
