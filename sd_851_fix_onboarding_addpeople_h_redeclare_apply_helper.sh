#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_851_fix_onboarding_addpeople_h_redeclare"
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

FILE="frontend/src/components/onboarding/steps/AddPeopleStep.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "ERROR: Missing $FILE" >&2
  exit 1
fi

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

PYBIN="python3"
command -v "$PYBIN" >/dev/null 2>&1 || PYBIN="python"
command -v "$PYBIN" >/dev/null 2>&1 || { echo "ERROR: python3/python not found" >&2; exit 1; }

"$PYBIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/onboarding/steps/AddPeopleStep.tsx")
s = p.read_text(encoding="utf-8")
orig = s

# Fix: we injected `const h = normalizeHandle(handle)` but the baseline already declares `const h = String(handle...)`,
# so TS errors with "Cannot redeclare block-scoped variable 'h'".
# Solution: rename injected variable to hNorm, scoped to the injected block only.

pattern = re.compile(
    r'(//\s*sd_850_fix_onboarding_addpeople_self_guard_syntax_toggle:.*?\n'
    r'\s*const\s+me\s*=\s*normalizeHandle\(String\(myHandle\s*\|\|\s*""\)\);\s*\n'
    r')(\s*)const\s+h\s*=\s*normalizeHandle\(handle\);\s*\n'
    r'\s*if\s*\(!h\)\s*return;\s*\n'
    r'\s*if\s*\(me\s*&&\s*h\s*===\s*me\)\s*return;\s*\n'
    r'\s*handle\s*=\s*h;\s*\n',
    flags=re.M
)

def repl(m: re.Match) -> str:
    head = m.group(1)
    indent = m.group(2) or ""
    return (
        head
        + f"{indent}const hNorm = normalizeHandle(handle);\n"
        + f"{indent}if (!hNorm) return;\n"
        + f"{indent}if (me && hNorm === me) return;\n"
        + f"{indent}handle = hNorm;\n"
    )

s2, n = pattern.subn(repl, s, count=1)
if n == 0:
    # Fallback: do targeted line edits within the injected block if pattern drifted.
    if "// sd_850_fix_onboarding_addpeople_self_guard_syntax_toggle" in s:
        s2 = s
        s2 = s2.replace("const h = normalizeHandle(handle);", "const hNorm = normalizeHandle(handle);", 1)
        s2 = s2.replace("if (!h) return;", "if (!hNorm) return;", 1)
        s2 = s2.replace("if (me && h === me) return;", "if (me && hNorm === me) return;", 1)
        s2 = s2.replace("handle = h;", "handle = hNorm;", 1)
        if s2 == s:
            print("ERROR: Could not locate injected h block to patch.")
            raise SystemExit(1)
        s = s2
        print("OK: fallback patch applied")
    else:
        print("ERROR: sd_850 toggle marker not found; refusing to patch blindly.")
        raise SystemExit(1)
else:
    s = s2
    print("OK: patched injected h -> hNorm (1 block)")

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("OK: wrote", p)
else:
    print("OK: no changes needed")
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo "  cd \"$ROOT/frontend\" && npm run build"
