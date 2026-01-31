#!/usr/bin/env bash
set -euo pipefail

NAME="sd_946_public_rosters_hidden_ui"
FILES=(
  "frontend/src/app/u/[username]/followers/page.tsx"
  "frontend/src/app/u/[username]/following/page.tsx"
)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "❌ Missing: $f"; exit 1; }
done

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${TS}"
mkdir -p "$BK"
for f in "${FILES[@]}"; do
  mkdir -p "$BK/$(dirname "$f")"
  cp -a "$f" "$BK/$f"
done
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path

CARD = """        ) : hidden ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Lock size={16} className="text-gray-400" /> This list is hidden
            </div>
            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>
          </div>
        ) : items.length ? ("""

def patch(path: str, empty_marker: str):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    orig = s

    # 1) Import Lock
    if 'import { ChevronLeft } from "lucide-react";' in s and "Lock" not in s:
        s = s.replace('import { ChevronLeft } from "lucide-react";',
                      'import { ChevronLeft, Lock } from "lucide-react";', 1)

    # 2) FollowResp: add hidden?: boolean
    if "type FollowResp" in s and "hidden?: boolean" not in s:
        s = s.replace("  error?: string;\n", "  error?: string;\n  hidden?: boolean;\n", 1)

    # 3) hidden state after total
    if "const [hidden, setHidden]" not in s:
        needle = "  const [total, setTotal] = useState<number | null>(null);\n"
        if needle in s:
            s = s.replace(needle, needle + "\n  const [hidden, setHidden] = useState(false);\n", 1)

    # 4) reset hidden each load
    if "setHidden(false);" not in s:
        s = s.replace("      setTrouble(null);\n", "      setTrouble(null);\n      setHidden(false);\n", 1)

    # 5) setHidden from response (before got)
    got_line = "        const got = Array.isArray(j.items) ? j.items : [];\n"
    if "const isHidden = !!(j as any).hidden" not in s and got_line in s:
        s = s.replace(
            got_line,
            "        const isHidden = !!(j as any).hidden;\n"
            "        setHidden(isHidden);\n\n"
            + got_line,
            1,
        )

    # 6) render hidden branch before items.length
    if "This list is hidden" not in s and "        ) : items.length ? (" in s:
        s = s.replace("        ) : items.length ? (", CARD, 1)

    # Marker
    if "sd_946_public_rosters_hidden_ui" not in s:
        s += "\n\n// sd_946_public_rosters_hidden_ui\n"

    if s != orig:
        p.write_text(s, encoding="utf-8")
        print("✅ Patched:", path)
    else:
        print("ℹ️ No change:", path)

patch("frontend/src/app/u/[username]/followers/page.tsx", "No followers yet.")
patch("frontend/src/app/u/[username]/following/page.tsx", "Not following anyone yet.")
PY

echo "✅ DONE: $NAME"
