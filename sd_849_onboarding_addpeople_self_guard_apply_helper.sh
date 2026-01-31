#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_849_onboarding_addpeople_self_guard"
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

MARK = "sd_849_onboarding_addpeople_self_guard"

# 1) Add normalizeHandle helper near parseIdentifiers (only if missing)
if "function normalizeHandle" not in s:
    needle = "function parseIdentifiers(raw: string): string[] {"
    idx = s.find(needle)
    if idx != -1:
        insert = "\n".join([
            "",
            f"// {MARK}: prevent selecting yourself in onboarding Add People",
            "function normalizeHandle(raw: string): string {",
            "  const s = String(raw || \"\").trim();",
            "  if (!s) return \"\";",
            "  const h = s.startsWith(\"@\") ? s : \"@\" + s;",
            "  return h.trim().toLowerCase();",
            "}",
            "",
        ]) + "\n"
        s = s[:idx] + insert + s[idx:]

# 2) Define myHandleNorm inside component (after myHandleSafe)
if "const myHandleNorm" not in s:
    s = s.replace(
        '  const myHandleSafe = String(myHandle || "").trim();\n',
        '  const myHandleSafe = String(myHandle || "").trim();\n  const myHandleNorm = normalizeHandle(myHandleSafe);\n',
        1,
    )

# 3) Make toggle() normalize handles + ignore self
# Replace the toggle body safely (best-effort)
toggle_pat = re.compile(r'function toggle\(\s*handle:\s*string,\s*name\?:\s*string\s*\)\s*\{\s*\n([\s\S]*?)\n\s*\}\n', re.M)
m = toggle_pat.search(s)
if m and MARK not in m.group(0):
    body = m.group(1)
    # We only patch if it looks like the existing toggle (setAdded + toast added/removed)
    if "setAdded((prev) =>" in body and "next.add" in body:
        new_fn = "\n".join([
            f"function toggle(handle: string, name?: string) {{",
            f"    const h = normalizeHandle(handle);",
            f"    if (!h) return;",
            f"    if (myHandleNorm && h === myHandleNorm) {{ toast(\"That’s you.\"); return; }} // {MARK}",
            f"    setAdded((prev) => {{",
            f"      const next = new Set(prev);",
            f"      if (next.has(h)) {{",
            f"        next.delete(h);",
            f"        if (name) toast(`${{name}} removed`);",
            f"      }} else {{",
            f"        next.add(h);",
            f"        if (name) toast(`${{name}} added!`);",
            f"      }}",
            f"      return next;",
            f"    }});",
            f"  }}",
        ])
        s = s[:m.start()] + new_fn + s[m.end():]

# 4) Filter primaryList to exclude self + normalize/dedupe
if "const primaryList = useMemo" in s and (MARK + "_primaryList") not in s:
    s = re.sub(
        r'const primaryList = useMemo\(\(\) => \{\s*\n\s*const base = matches\.length([\s\S]*?)return out;\s*\n\s*\}, \[matches, suggestions\]\);\s*',
        lambda mm: mm.group(0)
            .replace("const seen = new Set<string>();", "const seen = new Set<string>();")
            .replace("const out: Array<{ handle: string; name: string; hint?: ContactHint }> = [];", "const out: Array<{ handle: string; name: string; hint?: ContactHint }> = [];\n    const me = myHandleNorm; // " + MARK + "_primaryList")
            .replace("const h = String(r.handle || \"\").trim();", "const h = normalizeHandle(String(r.handle || \"\").trim());")
            .replace("if (!h || seen.has(h)) continue;", "if (!h || seen.has(h) || (me && h === me)) continue;")
            .replace("out.push({ handle: h, name: r.name, hint: r.hint });", "out.push({ handle: h, name: r.name, hint: r.hint });")
            .replace("}, [matches, suggestions]);", "}, [matches, suggestions, myHandleNorm]);"),
        s,
        count=1,
        flags=re.S,
    )

# 5) Filter searchItems to exclude self (in search users effect)
if "setSearchItems(d.items);" in s and (MARK + "_search_filter") not in s:
    s = s.replace(
        "setSearchItems(d.items);",
        "\n".join([
            f"          const me = myHandleNorm; // {MARK}_search_filter",
            f"          const raw = d.items;",
            f"          const filtered = me ? raw.filter((x: any) => normalizeHandle(String(x?.handle || x?.username || \"\")) !== me) : raw;",
            f"          setSearchItems(filtered);",
        ]),
        1,
    )
    # Update deps if needed: [searchQ] -> [searchQ, myHandleNorm]
    s = s.replace("  }, [searchQ]);", "  }, [searchQ, myHandleNorm]);", 1)

# 6) Use normalized handle when checking `added.has(...)` in UI rows
# Replace added.has(u.handle) -> added.has(normalizeHandle(u.handle))
s = s.replace("added.has(u.handle)", "added.has(normalizeHandle(u.handle))")

# 7) Ensure toggle calls pass a handle (unchanged) — toggle now normalizes.
# (No further action)

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("OK: patched", p)
else:
    print("OK: no changes needed (already patched).")
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
echo "  1) Onboarding → Add People: search your own handle."
echo "     - You should NOT be able to add yourself (toast: \"That’s you.\")."
echo "  2) Your handle should not appear in suggestions/search list."
echo "  3) Other handles still toggle normally."
