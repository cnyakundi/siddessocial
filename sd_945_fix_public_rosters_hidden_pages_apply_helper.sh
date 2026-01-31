#!/usr/bin/env bash
set -euo pipefail

NAME="sd_945_fix_public_rosters_hidden_pages"
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

FILES = [
  ("frontend/src/app/u/[username]/followers/page.tsx", "followers"),
  ("frontend/src/app/u/[username]/following/page.tsx", "following"),
]

HIDDEN_CARD = """        ) : hidden ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Lock size={16} className="text-gray-400" /> This list is hidden
            </div>
            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>
          </div>
        ) : items.length ? ("""

def ensure_lock_import(s: str) -> str:
  if 'from "lucide-react";' not in s:
    return s

  # Simple common case
  if 'import { ChevronLeft } from "lucide-react";' in s and "Lock" not in s:
    return s.replace(
      'import { ChevronLeft } from "lucide-react";',
      'import { ChevronLeft, Lock } from "lucide-react";',
      1,
    )

  # Generic: inject Lock into existing lucide import list
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

def ensure_hidden_in_followresp(s: str) -> str:
  if "type FollowResp" not in s or "hidden?: boolean" in s:
    return s
  if "  error?: string;" in s:
    return s.replace("  error?: string;\n", "  error?: string;\n  hidden?: boolean;\n", 1)
  return s.replace("  ok: boolean;\n", "  ok: boolean;\n  hidden?: boolean;\n", 1)

def ensure_hidden_state(s: str) -> str:
  if "const [hidden, setHidden]" in s:
    return s
  needle = "  const [total, setTotal] = useState<number | null>(null);\n"
  if needle in s:
    return s.replace(needle, needle + "\n  const [hidden, setHidden] = useState(false);\n", 1)
  return s

def ensure_reset_hidden_each_load(s: str) -> str:
  if "setHidden(false);" in s:
    return s
  # Insert right after setTrouble(null) inside load()
  return s.replace("      setTrouble(null);\n", "      setTrouble(null);\n      setHidden(false);\n", 1)

def ensure_set_hidden_from_resp(s: str) -> str:
  if "const isHidden = !!(j as any).hidden" in s:
    return s
  anchor = "        const got = Array.isArray(j.items) ? j.items : [];\n"
  if anchor not in s:
    return s
  insert = (
    "        const isHidden = !!(j as any).hidden;\n"
    "        setHidden(isHidden);\n\n"
  )
  return s.replace(anchor, insert + anchor, 1)

def ensure_hidden_render_branch(s: str) -> str:
  if "This list is hidden" in s:
    return s
  marker = ") : items.length ? ("
  if marker in s:
    return s.replace(marker, HIDDEN_CARD, 1)
  return s

def patch_one(path: str, mode: str):
  p = Path(path)
  orig = p.read_text(encoding="utf-8")
  s = orig

  s = ensure_lock_import(s)
  s = ensure_hidden_in_followresp(s)
  s = ensure_hidden_state(s)
  s = ensure_reset_hidden_each_load(s)
  s = ensure_set_hidden_from_resp(s)
  s = ensure_hidden_render_branch(s)

  if "sd_945_fix_public_rosters_hidden_pages" not in s:
    s += "\n\n// sd_945_fix_public_rosters_hidden_pages\n"

  if s != orig:
    p.write_text(s, encoding="utf-8")
    print("✅ Patched:", path)
  else:
    print("ℹ️ No change:", path)

for path, mode in FILES:
  patch_one(path, mode)
PY

echo ""
echo "✅ DONE: ${NAME}"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .."
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "  bash scripts/run_tests.sh --smoke"
