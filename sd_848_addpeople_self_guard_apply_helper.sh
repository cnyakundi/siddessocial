#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_848_addpeople_self_guard"
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

FILE="frontend/src/components/AddPeopleSheet.tsx"
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

p = Path("frontend/src/components/AddPeopleSheet.tsx")
s = p.read_text(encoding="utf-8")
orig = s

MARK = "sd_848_addpeople_self_guard"

# 1) Import fetchMe
if 'import { fetchMe } from "@/src/lib/authMe";' not in s:
    anchor = 'import { toast } from "@/src/lib/toast";\n'
    if anchor in s:
        s = s.replace(anchor, anchor + 'import { fetchMe } from "@/src/lib/authMe";\n', 1)

# 2) Add state for meHandle (normalized @username)
if "meHandle" not in s:
    # Insert after existing state declarations (raw/saving/err)
    s = re.sub(
        r'(const \[err,\s*setErr\] = useState<string \| null>\(null\);\n)',
        r'\1\n  const [meHandle, setMeHandle] = useState<string>(""); // ' + MARK + r'\n',
        s,
        count=1,
        flags=re.M,
    )

# 3) Fetch /api/auth/me when opening sheet
if f"{MARK}_me_effect" not in s:
    # Insert inside the existing open effect block: useEffect(() => { if (!open) return; ... }, [open]);
    m = re.search(r'useEffect\(\(\)\s*=>\s*\{\s*\n\s*if\s*\(!open\)\s*return;\s*\n([\s\S]*?)\n\s*\},\s*\[open\]\s*\);\s*', s)
    if m:
        # Add fetchMe after reset state
        block = m.group(0)
        if "fetchMe().catch" not in block:
            insertion = "\n".join([
                "",
                f"    // {MARK}_me_effect: prevent adding yourself to your own Circle",
                "    (async () => {",
                "      const me = await fetchMe().catch(() => ({ ok: false, authenticated: false } as any));",
                "      const u = me?.authenticated && me?.user?.username ? String(me.user.username).trim() : \"\";",
                "      const h = u ? normalizeHandle(\"@\" + u) : \"\";",
                "      setMeHandle(h || \"\");",
                "    })();",
            ])
            # Place insertion right after the resets (after setSaving(false);)
            block2 = block.replace("    setSaving(false);\n", "    setSaving(false);\n" + insertion + "\n", 1)
            s = s.replace(block, block2, 1)

# 4) Filter toAdd to exclude meHandle
# Find toAdd useMemo return list.filter(...) and append self filter
if MARK not in s:
    # Replace existing filter line: return list.filter((h) => !existingSet.has(h));
    s = s.replace(
        "    return list.filter((h) => !existingSet.has(h));",
        f"    const me = normalizeHandle(meHandle || \"\");\n    return list.filter((h) => !existingSet.has(h) && (!me || h !== me)); // {MARK}",
        1,
    )

# 5) Add a small hint UI if the user typed themselves (optional but helpful)
if f"{MARK}_hint" not in s:
    # After the helper text: "We auto-add “@”. Existing members won’t be duplicated."
    needle = '              We auto-add “@”. Existing members won’t be duplicated.\n            </div>\n'
    if needle in s:
        hint = "\n".join([
            "",
            f"            {{meHandle && parseHandles(raw).includes(meHandle) ? (",
            f'              <div className="text-[11px] text-amber-600 mt-1">Note: you can’t add yourself — your handle is ignored.</div> // {MARK}_hint',
            "            ) : null}",
            "",
        ])
        s = s.replace(needle, needle + hint, 1)

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("OK: patched", p)
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
echo ""
echo "Smoke:"
echo "  1) Open AddPeopleSheet for a Circle you own."
echo "  2) Type your own handle and another handle."
echo "  3) Your handle should be ignored and you should see a small note."
