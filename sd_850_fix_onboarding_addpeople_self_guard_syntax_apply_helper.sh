#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_850_fix_onboarding_addpeople_self_guard_syntax"
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

echo "== ${SD_ID} =="
echo "Backup: $BK/$FILE"
echo ""

# Step 1: restore baseline from git to clear the syntax corruption
if command -v git >/dev/null 2>&1; then
  echo "== Step 1: restore AddPeopleStep.tsx from git (clean baseline) =="
  git checkout -- "$FILE" || git restore "$FILE"
  echo "✅ Restored $FILE"
  echo ""
else
  echo "ERROR: git not found; cannot restore baseline safely." >&2
  exit 1
fi

# Step 2: apply a minimal, safe self-guard patch (no complex rewrites)
PYBIN="python3"
command -v "$PYBIN" >/dev/null 2>&1 || PYBIN="python"
command -v "$PYBIN" >/dev/null 2>&1 || { echo "ERROR: python3/python not found" >&2; exit 1; }

"$PYBIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/onboarding/steps/AddPeopleStep.tsx")
s = p.read_text(encoding="utf-8")
orig = s
MARK = "sd_850_fix_onboarding_addpeople_self_guard_syntax"

# Helper to insert text before a marker line
def insert_before(needle: str, insert: str) -> None:
    global s
    idx = s.find(needle)
    if idx == -1:
        return
    if insert in s:
        return
    s = s[:idx] + insert + s[idx:]

# 1) Add normalizeHandle helper (once), right before AddPeopleStep component export
if "function normalizeHandle(" not in s:
    insert_before(
        "export default function AddPeopleStep",
        "\n".join([
            "",
            f"// {MARK}: normalize + self-filter helpers",
            "function normalizeHandle(raw: string): string {",
            "  const t = String(raw || \"\").trim();",
            "  if (!t) return \"\";",
            "  const h = t.startsWith(\"@\") ? t : \"@\" + t;",
            "  return h.replace(/^@+/, \"@\").trim().toLowerCase();",
            "}",
            "",
        ]) + "\n"
    )

# 2) Patch toggle(handle, ...) to normalize + ignore self
# Insert immediately after the opening brace of function toggle(...)
if "function toggle(" in s and f"{MARK}_toggle" not in s:
    s = re.sub(
        r'(function toggle\(\s*handle:\s*string[\s\S]*?\)\s*\{\s*\n)',
        r'\1    // ' + MARK + r'_toggle: normalize handles + ignore self\n'
        r'    const me = normalizeHandle(String(myHandle || ""));\n'
        r'    const h = normalizeHandle(handle);\n'
        r'    if (!h) return;\n'
        r'    if (me && h === me) return;\n'
        r'    handle = h;\n\n',
        s,
        count=1,
        flags=re.M
    )

# 3) Ensure the submit/onContinue payload filters out self (defense-in-depth)
# Patch common patterns:
# - handles: Array.from(added)
# - handles: [...added]
# - handles: Array.from(selected)
ME_FILTER = 'normalizeHandle(String(myHandle || ""))'
REPL_FILTER = f'.filter((h) => normalizeHandle(h) !== {ME_FILTER})'

def patch_handles(expr: str) -> None:
    global s
    if REPL_FILTER in s:
        return
    s = s.replace(f"handles: {expr}", f"handles: {expr}{REPL_FILTER}")

patch_handles("Array.from(added)")
patch_handles("[...added]")

# Also handle 'addedHandles' style variable
s = re.sub(
    r'handles:\s*Array\.from\((\w+)\)',
    lambda m: f'handles: Array.from({m.group(1)}){REPL_FILTER}' if REPL_FILTER not in m.group(0) else m.group(0),
    s,
    count=1
)

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("OK: patched", p)
else:
    print("OK: no changes needed (already patched).")
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: $BK"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo "  cd \"$ROOT/frontend\" && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Onboarding → Add People: try to add your own handle -> should be ignored."
echo "  2) Add someone else -> still works."
