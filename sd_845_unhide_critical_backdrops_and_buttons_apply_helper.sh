#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_845_unhide_critical_backdrops_and_buttons"
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
  "frontend/src/components/DesktopTopBar.tsx"
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
cp -a "frontend/src/components/DesktopTopBar.tsx" "$BK/frontend/src/components/DesktopTopBar.tsx"

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

def patch_profile_page(path: str):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    orig = s

    # 1) Unhide "tap outside to close" backdrops on Locked + About sheets.
    s = re.sub(
        r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/30 backdrop-blur-sm")',
        r'\1\2',
        s,
        flags=re.M,
    )

    # 2) Unhide the "Website" link inside About (it was accidentally <a hidden ...>).
    s = re.sub(r'<a\s+hidden(\s*\n\s*className="text-gray-900 font-extrabold hover:underline")', r'<a\1', s, flags=re.M)

    # 3) Unhide the "Close" CTA button inside About sheet (w-full mt-5 ...)
    s = re.sub(
        r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*onClick=\{\(\)\s*=>\s*setAboutOpen\(false\)\}\s*\n\s*className="w-full mt-5 py-3 rounded-xl bg-gray-900 text-white font-extrabold text-sm shadow-md active:scale-95 transition-all")',
        r'\1\2',
        s,
        flags=re.M,
    )

    # 4) Unhide top-bar Back and Share buttons if they were accidentally hidden
    # Back button pattern includes router.back()
    s = re.sub(r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*onClick=\{\(\)\s*=>\s*\{\s*try\s*\{\s*router\.back\(\);\s*\}\s*catch\s*\{\}\s*\}\s*\}\s*)',
               r'\1\2',
               s,
               flags=re.M)

    # Share button pattern includes shareProfile()
    s = re.sub(r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*onClick=\{\(\)\s*=>\s*void\s*shareProfile\(\)\}\s*)',
               r'\1\2',
               s,
               flags=re.M)

    if s != orig:
        p.write_text(s, encoding="utf-8")
        print("OK: patched", path)
    else:
        print("OK: no changes needed", path)

def patch_profile_peek(path: str):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    orig = s

    # Unhide backdrop (it must be clickable or sheet becomes impossible to dismiss)
    s = re.sub(
        r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/30 backdrop-blur-sm")',
        r'\1\2',
        s,
        flags=re.M,
    )

    # Cosmetic: ensure newline after backdrop self-close to avoid `/>      <div`
    s = s.replace('/>      <div', '/>\n\n      <div')

    if s != orig:
        p.write_text(s, encoding="utf-8")
        print("OK: patched", path)
    else:
        print("OK: no changes needed", path)

def patch_desktop_topbar(path: str):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    orig = s

    # Unhide the SidePopover "click outside to close" overlay:
    # <button hidden type="button" aria-label="Close" className="fixed inset-0 z-[95]" ... />
    s = re.sub(
        r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*aria-label="Close"\s*\n\s*className="fixed inset-0 z-\[95\]")',
        r'\1\2',
        s,
        flags=re.M,
    )

    if s != orig:
        p.write_text(s, encoding="utf-8")
        print("OK: patched", path)
    else:
        print("OK: no changes needed", path)

patch_profile_page("frontend/src/app/u/[username]/page.tsx")
patch_profile_peek("frontend/src/components/ProfilePeekSheet.tsx")
patch_desktop_topbar("frontend/src/components/DesktopTopBar.tsx")
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
echo "  1) Profile: open About -> tap outside closes; Website link clickable."
echo "  2) Profile: trigger Locked overlay -> tap outside closes."
echo "  3) Feed: long-press author -> ProfilePeekSheet opens -> tap outside closes."
echo "  4) Desktop: open Side popover -> click outside closes."
