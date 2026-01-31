#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_844_ui_p0_regression_check"
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

CHK_DIR="scripts/checks"
CHK_FILE="${CHK_DIR}/ui_p0_regression_check.sh"

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/${CHK_DIR}"
if [[ -f "$CHK_FILE" ]]; then
  cp -a "$CHK_FILE" "$BK/${CHK_FILE}"
fi

mkdir -p "$CHK_DIR"

cat > "$CHK_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# ui_p0_regression_check.sh
# Purpose: Catch "rage quit" UI regressions that keep popping up:
# - hidden modal backdrops (can't dismiss)
# - hidden About website link
# - self-action buttons appearing on your own profile ("Add Friend" on self)

say() { echo "[ui_p0_check] $*"; }

PYBIN="python3"
command -v "$PYBIN" >/dev/null 2>&1 || PYBIN="python"
command -v "$PYBIN" >/dev/null 2>&1 || { say "ERROR: python3/python not found"; exit 1; }

"$PYBIN" - <<'PY'
from pathlib import Path
import re
import sys

fail = 0

def must_exist(path: str):
    global fail
    if not Path(path).exists():
        print(f"[ui_p0_check] FAIL: missing {path}")
        fail = 1

def check_no_hidden_backdrop(path: str):
    global fail
    p = Path(path)
    if not p.exists():
        return
    s = p.read_text(encoding="utf-8", errors="ignore")
    if re.search(r'<button\\s+hidden[\\s\\S]{0,260}?className="absolute inset-0 bg-black', s, flags=re.M):
        print(f"[ui_p0_check] FAIL: hidden backdrop button in {path}")
        fail = 1

def check_no_hidden_about_website(path: str):
    global fail
    p = Path(path)
    if not p.exists():
        return
    s = p.read_text(encoding="utf-8", errors="ignore")
    if re.search(r'<a\\s+hidden[\\s\\S]{0,260}?href=', s, flags=re.M):
        print(f"[ui_p0_check] FAIL: hidden <a> (website link) in {path}")
        fail = 1

def check_self_guard_present(path: str):
    global fail
    p = Path(path)
    if not p.exists():
        return
    s = p.read_text(encoding="utf-8", errors="ignore")
    has_isSelf = ("isSelf?: boolean" in s) or ("isSelf?:" in s)
    has_guard = ("if (props.isSelf) return null" in s) or ("sd_839_self_guard" in s) or ("sd_836_self_guard" in s)
    if not (has_isSelf and has_guard):
        print(f"[ui_p0_check] FAIL: missing self-action guard in {path} (SideActionButtons should hide on self)")
        fail = 1

PROFILE_PAGE = "frontend/src/app/u/[username]/page.tsx"
PEEK_SHEET   = "frontend/src/components/ProfilePeekSheet.tsx"
PRISM_PROFILE= "frontend/src/components/PrismProfile.tsx"

must_exist(PROFILE_PAGE)
must_exist(PEEK_SHEET)
must_exist(PRISM_PROFILE)

check_no_hidden_backdrop(PROFILE_PAGE)
check_no_hidden_about_website(PROFILE_PAGE)
check_no_hidden_backdrop(PEEK_SHEET)
check_self_guard_present(PRISM_PROFILE)

sys.exit(1 if fail else 0)
PY

say "OK: ui p0 regression check passed"
EOF

chmod +x "$CHK_FILE"

echo "✅ DONE: ${SD_ID}"
echo "Wrote: ${CHK_FILE}"
echo "Backup (if existed): ${BK}/${CHK_FILE}"
echo ""
echo "Run it now:"
echo "  bash ${CHK_FILE}"
echo ""
echo "Or run full harness:"
echo "  bash scripts/run_tests.sh"
