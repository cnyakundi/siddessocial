#!/usr/bin/env bash
set -euo pipefail

NAME="sd_947_finish_sd940_hidden_rosters_pages"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

FILES=(
  "frontend/src/app/u/[username]/followers/page.tsx"
  "frontend/src/app/u/[username]/following/page.tsx"
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing: $f"
    echo "Run from repo root (folder containing frontend/ and backend/)."
    exit 1
  fi
done

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${TS}"
mkdir -p "$BK"
for f in "${FILES[@]}"; do
  mkdir -p "$BK/$(dirname "$f")"
  cp -a "$f" "$BK/$f"
done

echo "== ${NAME} =="
echo "Backup: $BK"
echo ""

python3 - <<'PY'
from pathlib import Path

HIDDEN_CARD = """        ) : hidden ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Lock size={16} className="text-gray-400" /> This list is hidden
            </div>
            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>
          </div>
        ) : items.length ? ("""

def patch(path: str, title: str):
    p = Path(path)
    orig = p.read_text(encoding="utf-8")
    s = orig

    # 1) Import Lock
    if 'import { ChevronLeft } from "lucide-react";' in s and "Lock" not in s:
        s = s.replace(
            'import { ChevronLeft } from "lucide-react";',
            'import { ChevronLeft, Lock } from "lucide-react";',
            1,
        )

    # 2) FollowResp: add hidden?: boolean
    if "type FollowResp" in s and "hidden?: boolean" not in s:
        if "  error?: string;" in s:
            s = s.replace("  error?: string;\n", "  error?: string;\n  hidden?: boolean;\n", 1)
        else:
            s = s.replace("  ok: boolean;\n", "  ok: boolean;\n  hidden?: boolean;\n", 1)

    # 3) hidden state after total
    if "const [hidden, setHidden]" not in s:
        needle = "  const [total, setTotal] = useState<number | null>(null);\n"
        if needle in s:
            s = s.replace(needle, needle + "\n  const [hidden, setHidden] = useState(false);\n", 1)

    # 4) reset hidden at each load start
    if "setHidden(false);" not in s and "      setTrouble(null);\n" in s:
        s = s.replace("      setTrouble(null);\n", "      setTrouble(null);\n      setHidden(false);\n", 1)

    # 5) read hidden from API response (before `got`)
    got_line = "        const got = Array.isArray(j.items) ? j.items : [];\n"
    if "const isHidden = !!(j as any).hidden" not in s and got_line in s:
        s = s.replace(
            got_line,
            "        const isHidden = !!(j as any).hidden;\n"
            "        setHidden(isHidden);\n\n"
            + got_line,
            1,
        )

    # 6) early return if hidden (clear items always for privacy)
    cursor_line = '        setNextCursor(String(j.nextCursor || "").trim() || null);\n'
    if "if (isHidden) {" not in s and cursor_line in s:
        s = s.replace(
            cursor_line,
            cursor_line
            + "\n"
            + "        if (isHidden) {\n"
            + "          setItems([]);\n"
            + "          setNextCursor(null);\n"
            + "          return;\n"
            + "        }\n",
            1,
        )

    # 7) render hidden branch before items.length
    if "This list is hidden" not in s and "        ) : items.length ? (" in s:
        s = s.replace("        ) : items.length ? (", HIDDEN_CARD, 1)

    # 8) (optional) show lock in header title when hidden
    header = f'<div className="text-lg font-black text-gray-900">{title}</div>'
    if header in s and "{hidden ? <Lock" not in s:
        s = s.replace(
            header,
            f'<div className="text-lg font-black text-gray-900 flex items-center gap-2">{title} {{hidden ? <Lock size={{16}} className="text-gray-300" /> : null}}</div>',
            1,
        )

    if "sd_947_finish_sd940_hidden_rosters_pages" not in s:
        s += "\n\n// sd_947_finish_sd940_hidden_rosters_pages\n"

    if s != orig:
        p.write_text(s, encoding="utf-8")
        print("✅ Patched:", path)
    else:
        print("ℹ️ No change:", path)

patch("frontend/src/app/u/[username]/followers/page.tsx", "Followers")
patch("frontend/src/app/u/[username]/following/page.tsx", "Following")
PY

echo ""
echo "✅ DONE: $NAME"
