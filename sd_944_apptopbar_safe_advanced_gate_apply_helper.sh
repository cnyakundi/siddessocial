#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_944_apptopbar_safe_advanced_gate"
FILE="frontend/src/components/AppTopBar.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"
echo "Backup: $BK/$FILE"

echo ""
echo "== Step 1: restore AppTopBar.tsx from git (removes any broken JSX edits) =="
git checkout -- "$FILE"
echo "✅ Restored $FILE"

echo ""
echo "== Step 2: apply safe advanced gating (no useSearchParams; no fragile regex) =="

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/AppTopBar.tsx")
s = p.read_text(encoding="utf-8")

MARK = "sd_944_apptopbar_safe_advanced_gate"
if MARK in s:
    print("SKIP: sd_944 already applied.")
    raise SystemExit(0)

# 0) add marker
if '"use client";' in s and MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

# 1) ensure React import includes useEffect + useState (it should already, but be safe)
m = re.search(r'import\s+React,\s*\{\s*([^}]+)\s*\}\s*from\s*"react";', s)
if m:
    inner = m.group(1)
    parts = [p.strip() for p in inner.split(",") if p.strip()]
    for need in ["useEffect", "useState"]:
        if need not in parts:
            parts.append(need)
    s = s.replace(m.group(0), f'import React, {{ {", ".join(parts)} }} from "react";', 1)
else:
    # If import is different, don't guess; assume it's already correct in your repo.
    pass

# 2) Insert advanced state AFTER pathname exists (so dependency list is valid)
# Find `const pathname = usePathname() || "";`
anchor = 'const pathname = usePathname() || "";'
if anchor not in s:
    raise SystemExit("ERROR: could not find pathname anchor in AppTopBar.tsx")

if "const [advanced," not in s:
    insert = (
        anchor
        + "\n\n  // sd_944: advanced UI flag via ?advanced=1 (client-only, safe for Next build)\n"
        + "  const [advanced, setAdvanced] = useState(false);\n"
        + "  useEffect(() => {\n"
        + "    try {\n"
        + '      const q = new URLSearchParams(window.location.search || "");\n'
        + '      setAdvanced((q.get("advanced") || "").trim() === "1");\n'
        + "    } catch {\n"
        + "      setAdvanced(false);\n"
        + "    }\n"
        + "  }, [pathname]);\n"
    )
    s = s.replace(anchor, insert, 1)

# 3) Gate Refresh button by wrapping the exact button block
needle = 'aria-label="Refresh"'
idx = s.find(needle)
if idx == -1:
    raise SystemExit('ERROR: could not find Refresh button (aria-label="Refresh") in AppTopBar.tsx')

# Find the start of the <button ...> that contains aria-label="Refresh"
btn_start = s.rfind("<button", 0, idx)
if btn_start == -1:
    raise SystemExit("ERROR: could not locate start of Refresh <button> block")

# Find the end of that button block
btn_end = s.find("</button>", idx)
if btn_end == -1:
    raise SystemExit("ERROR: could not locate end </button> for Refresh block")
btn_end += len("</button>")

# If already gated, skip
pre = s[max(0, btn_start-120):btn_start]
block = s[btn_start:btn_end]
if "advanced" in pre or "{advanced" in pre:
    print("NOTE: Refresh block already appears gated; leaving it.")
else:
    # Determine indentation
    line_start = s.rfind("\n", 0, btn_start) + 1
    indent = re.match(r"[ \t]*", s[line_start:btn_start]).group(0)

    wrapped = (
        f"{indent}{{advanced ? (\n"
        + block
        + f"\n{indent}) : null}} /* {MARK}_refresh_gated */"
    )
    s = s[:btn_start] + wrapped + s[btn_end:]

# 4) Normalize 44px icon buttons (rounded-full -> rounded-xl) safely
s = s.replace(
    "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-full",
    "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl",
)

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

echo ""
echo "== Verify + build =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd ..

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Normal: Refresh should NOT show"
echo "  - /siddes-feed?advanced=1 : Refresh should show"
