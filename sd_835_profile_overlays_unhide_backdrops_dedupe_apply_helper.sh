#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_835_profile_overlays_unhide_backdrops_dedupe"
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

FILE="frontend/src/app/u/[username]/page.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "ERROR: Missing $FILE" >&2
  exit 1
fi

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

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

p = Path("frontend/src/app/u/[username]/page.tsx")
t = p.read_text(encoding="utf-8")
orig = t

# 1) Unhide modal backdrops (Locked sheet + About sheet)
# These were accidentally shipped as: <button hidden ... className="absolute inset-0 bg-black/30 ...">
t = re.sub(
    r'<button\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/30 backdrop-blur-sm")',
    r'<button\1',
    t,
    flags=re.M,
)

# 2) Unhide website link inside About sheet (accidental "hidden" on <a>)
t = re.sub(
    r'<a\s+hidden(\s*\n\s*href=)',
    r'<a\1',
    t,
    flags=re.M,
)

# 3) Dedupe accidental nested bg-white wrappers in Posts section
# pattern observed:
#   <div className="bg-white">
#     <div className="bg-white">
t = re.sub(
    r'(<div className="bg-white">\s*)<div className="bg-white">',
    r'\1',
    t,
    flags=re.S,
)

# 4) Safety: if we accidentally left "hidden" on backdrop lines like "<button hidden\r", remove it too
t = t.replace("<button hidden\r\n", "<button\r\n")

if t == orig:
    print("OK: no changes needed (already clean).")
else:
    p.write_text(t, encoding="utf-8")
    print("OK: patched", p)
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
echo "  1) Open /u/<someone>?side=friends then open About -> tap outside should close."
echo "  2) Trigger Locked sheet (tap a locked Side) -> tap outside should close."
echo "  3) About -> Website row should be clickable (no hidden anchor)."
