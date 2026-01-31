#!/usr/bin/env bash
set -euo pipefail

NAME="sd_946_public_rosters_hidden_ui"
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

def inject_lock_import(s: str) -> str:
  if 'import { ChevronLeft } from "lucide-react";' in s and "Lock" not in s:
    return s.replace('import { ChevronLeft } from "lucide-react";',
                     'import { ChevronLeft, Lock } from "lucide-react";', 1)

  # If the lucide import list differs, inject Lock into it
  if 'from "lucide-react";' in s and "Lock" not in s:
    lines = s.splitlines(True)
    for i, line in enumerate(lines):
      if line.strip().startswith("import {") and 'from "lucide-react"' in line:
        if "Lock" in line:
          return s
        inside = line.split("{", 1)[1].split("}", 1)[0]
        parts = [x.strip() for x in inside.split(",") if x.strip()]
        parts.append("Lock")
        # dedupe
        seen = set()
        out = []
        for x in parts:
          k = x.lower()
          if k in seen:
            continue
          seen.add(k)
          out.append(x)
        lines[i] = f'import {{ {", ".join(out)} }} from "lucide-react";\n'
        return "".join(lines)
  return s

def patch_page(path: str, title: str):
  p = Path(path)
  orig = p.read_text(encoding="utf-8")
  s = orig

  s = inject_lock_import(s)

  # FollowResp: add hidden?: boolean
  if "type FollowResp" in s and "hidden?: boolean" not in s:
    if "  error?: string;" in s:
      s = s.replace("  error?: string;\n", "  error?: string;\n  hidden?: boolean;\n", 1)
    else:
      s = s.replace("  ok: boolean;\n", "  ok: boolean;\n  hidden?: boolean;\n", 1)

  # hidden state after total
  if "const [hidden, setHidden]" not in s:
    needle = "  const [total, setTotal] = useState<number | null>(null);\n"
    if needle in s:
      s = s.replace(needle, needle + "\n  const [hidden, setHidden] = useState(false);\n", 1)

  # reset hidden at each load start
  if "setHidden(false);" not in s and "      setTrouble(null);\n" in s:
    s = s.replace("      setTrouble(null);\n", "      setTrouble(null);\n      setHidden(false);\n", 1)

  # read hidden from API response
  if "const isHidden = !!(j as any).hidden" not in s and "        const got = Array.isArray(j.items) ? j.items : [];\n" in s:
    s = s.replace(
      "        const got = Array.isArray(j.items) ? j.items : [];\n",
      "        const isHidden = !!(j as any).hidden;\n"
      "        setHidden(isHidden);\n\n"
      "        const got = Array.isArray(j.items) ? j.items : [];\n",
      1,
    )

  # early return if hidden (prevents showing empty state + prevents load more)
  if "if (isHidden) {" not in s and '        setNextCursor(String(j.nextCursor || "").trim() || null);\n' in s:
    s = s.replace(
      '        setNextCursor(String(j.nextCursor || "").trim() || null);\n',
      '        setNextCursor(String(j.nextCursor || "").trim() || null);\n\n'
      '        if (isHidden) {\n'
      '          if (!isMore) setItems([]);\n'
      '          setNextCursor(null);\n'
      '          return;\n'
      '        }\n',
      1,
    )

  # render hidden branch (before items.length)
  if "This list is hidden" not in s and "        ) : items.length ? (" in s:
    s = s.replace("        ) : items.length ? (", HIDDEN_CARD, 1)

  # optional: lock icon in the title if hidden
  if f'<div className="text-lg font-black text-gray-900">{title}</div>' in s and "{hidden ? <Lock" not in s:
    s = s.replace(
      f'<div className="text-lg font-black text-gray-900">{title}</div>',
      f'<div className="text-lg font-black text-gray-900 flex items-center gap-2">{title} {{hidden ? <Lock size={{16}} className="text-gray-300" /> : null}}</div>',
      1,
    )

  if "sd_946_public_rosters_hidden_ui" not in s:
    s += "\n\n// sd_946_public_rosters_hidden_ui\n"

  if s != orig:
    p.write_text(s, encoding="utf-8")
    print("✅ Patched:", path)
  else:
    print("ℹ️ No change:", path)

patch_page("frontend/src/app/u/[username]/followers/page.tsx", "Followers")
patch_page("frontend/src/app/u/[username]/following/page.tsx", "Following")
PY

echo ""
echo "✅ DONE: $NAME"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .."
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "  bash scripts/run_tests.sh --smoke"
