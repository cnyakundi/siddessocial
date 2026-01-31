#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_945_apptopbar_safe_advanced_gate_v2"
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
echo "== Step 1: restore AppTopBar.tsx from git (clean baseline) =="
git checkout -- "$FILE"
echo "✅ Restored $FILE"

echo ""
echo "== Step 2: patch (robust anchor + safe Refresh gating) =="

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/AppTopBar.tsx")
s = p.read_text(encoding="utf-8")

MARK = "sd_945_apptopbar_safe_advanced_gate_v2"
if MARK in s:
    print("SKIP: sd_945 already applied.")
    raise SystemExit(0)

# Marker
if '"use client";' in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

# Ensure React import includes useEffect + useState (usually already true)
m = re.search(r'import\s+React,\s*\{\s*([^}]+)\s*\}\s*from\s*"react";', s)
if m:
    inner = [x.strip() for x in m.group(1).split(",") if x.strip()]
    for need in ["useEffect", "useState"]:
        if need not in inner:
            inner.append(need)
    s = s.replace(m.group(0), f'import React, {{ {", ".join(inner)} }} from "react";', 1)

# Find pathname line robustly (any default)
pm = re.search(r'^\s*const\s+pathname\s*=\s*usePathname\(\)\s*\|\|\s*[^;]+;\s*$', s, flags=re.M)
if not pm:
    raise SystemExit("ERROR: could not find `const pathname = usePathname() || ...;` in AppTopBar.tsx")

# Insert advanced state right after pathname (if not present)
if "const [advanced, setAdvanced]" not in s:
    insert = (
        "\n\n  // sd_945: advanced UI flag via ?advanced=1 (client-only)\n"
        "  const [advanced, setAdvanced] = useState(false);\n"
        "  useEffect(() => {\n"
        "    try {\n"
        '      const q = new URLSearchParams(window.location.search || "");\n'
        '      setAdvanced((q.get("advanced") || "").trim() === "1");\n'
        "    } catch {\n"
        "      setAdvanced(false);\n"
        "    }\n"
        "  }, [pathname]);\n"
    )
    s = s[:pm.end()] + insert + s[pm.end():]

# Gate Refresh button
needle = 'aria-label="Refresh"'
idx = s.find(needle)
if idx == -1:
    raise SystemExit('ERROR: could not find Refresh button (aria-label="Refresh") in AppTopBar.tsx')

btn_start = s.rfind("<button", 0, idx)
if btn_start == -1:
    raise SystemExit("ERROR: could not locate start of Refresh <button> block")

btn_end = s.find("</button>", idx)
if btn_end == -1:
    raise SystemExit("ERROR: could not locate end </button> for Refresh block")
btn_end += len("</button>")

block = s[btn_start:btn_end]

# Avoid double-wrapping
pre = s[max(0, btn_start - 120):btn_start]
if "{advanced" in pre or "advanced ?" in pre:
    print("NOTE: Refresh already looks gated; leaving as-is.")
else:
    line_start = s.rfind("\n", 0, btn_start) + 1
    indent = re.match(r"[ \t]*", s[line_start:btn_start]).group(0)
    wrapped = f'{indent}{{advanced ? (\\n{block}\\n{indent}) : null}} /* {MARK}_refresh_gated */'
    s = s[:btn_start] + wrapped + s[btn_end:]

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

echo ""
echo "== Verify + build (don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd ..

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - /siddes-feed -> Refresh hidden"
echo "  - /siddes-feed?advanced=1 -> Refresh visible"
