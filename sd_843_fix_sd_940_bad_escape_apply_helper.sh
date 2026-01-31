#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_843_fix_sd_940_bad_escape"
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

TARGET="sd_940_public_rosters_hidden_apply_helper.sh"
if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: Missing $TARGET in repo root." >&2
  echo "Fix: move it into the repo root first:" >&2
  echo "  mv ~/Downloads/${TARGET} ." >&2
  exit 1
fi

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$TARGET" "$BK/$TARGET"

python3 - <<'PY'
from pathlib import Path

p = Path("sd_940_public_rosters_hidden_apply_helper.sh")
s = p.read_text(encoding="utf-8")
orig = s

# sd_940 crash fix:
# Python regex error "bad escape \e" happens because the script contains an invalid regex escape like "\error".
# Replace any occurrence of "\error" with "error" (remove the stray backslash).
s = s.replace(r"\error", "error")

# Also fix the most common specific typo pattern (kept for safety)
s = s.replace(r"j\?\.\error", r"j\?\.error")

if s == orig:
    print("OK: no changes needed (no bad \\error escapes found).")
else:
    p.write_text(s, encoding="utf-8")
    print("OK: patched", p)
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}/${TARGET}"
echo ""
echo "Now you can re-run the script WITHOUT the Python regex crash:"
echo "  chmod +x ${TARGET}"
echo "  ./${TARGET} /Users/cn/Downloads/sidesroot"
echo ""
echo "Note:"
echo "  If sd_940 already applied some changes before crashing, rerunning may skip or re-apply parts depending on the script."
echo "  If anything looks duplicated, tell me and we'll make it idempotent."
