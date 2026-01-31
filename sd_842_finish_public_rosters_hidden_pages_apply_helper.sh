#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_842_finish_public_rosters_hidden_pages"
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

FOL="frontend/src/app/u/[username]/followers/page.tsx"
ING="frontend/src/app/u/[username]/following/page.tsx"

for f in "$FOL" "$ING"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing $f" >&2
    exit 1
  fi
done

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FOL")" "$BK/$(dirname "$ING")"
cp -a "$FOL" "$BK/$FOL"
cp -a "$ING" "$BK/$ING"

PYBIN=""
if command -v python3 >/dev/null 2>&1; then
  PYBIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYBIN="python"
else
  echo "ERROR: python3 required." >&2
  exit 1
fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

def patch_page(path: str, title: str):
    p = Path(path)
    t = p.read_text(encoding="utf-8")
    orig = t

    # 1) Import Lock icon (lucide-react)
    t = t.replace('import { ChevronLeft } from "lucide-react";', 'import { ChevronLeft, Lock } from "lucide-react";')

    # 2) Extend FollowResp with hidden?: boolean
    if "hidden?: boolean" not in t:
        t = re.sub(
            r'(type FollowResp = \{\n  ok: boolean;\n  error\?: string;\n)',
            r'\1  hidden?: boolean;\n',
            t,
            count=1,
        )

    # 3) Add hidden state
    if "const [hidden, setHidden]" not in t:
        t = re.sub(
            r'(const \[total, setTotal\] = useState<number \| null>\(null\);\n)',
            r'\1\n  const [hidden, setHidden] = useState(false);\n',
            t,
            count=1,
        )

    # 4) When request fails, reset hidden
    if "setHidden(false);" not in t:
        t = re.sub(
            r'(setTrouble\(j\?\.\s*error \|\| \(res\.status === 404 \? "not_found" : "request_failed"\)\);\n)',
            r'\1          setHidden(false);\n',
            t,
            count=1,
        )

    # 5) After success: setHidden + early return if hidden
    if "const isHidden = !!(j as any).hidden" not in t:
        t = re.sub(
            r'(const got = Array\.isArray\(j\.items\) \? j\.items : \[\];\n\s*setTotal\(typeof j\.total === "number" \? j\.total : null\);\n\s*setNextCursor\(String\(j\.nextCursor \|\| ""\)\.trim\(\) \|\| null\);\n)',
            r'const isHidden = !!(j as any).hidden;\n        setHidden(isHidden);\n\n        const got = Array.isArray(j.items) ? j.items : [];\n        setTotal(typeof j.total === "number" ? j.total : null);\n        setNextCursor(String(j.nextCursor || "").trim() || null);\n\n        if (isHidden) {\n          if (!isMore) setItems([]);\n          setNextCursor(null);\n          return;\n        }\n',
            t,
            count=1,
        )

    # 6) Render: insert hidden branch
    if "This list is hidden" not in t:
        t = t.replace(
            ") : items.length ? (",
            ') : hidden ? (\n          <div className="rounded-2xl border border-gray-200 bg-white p-4">\n            <div className="flex items-center gap-2 text-sm font-black text-gray-900">\n              <Lock size={16} className="text-gray-400" /> This list is hidden\n            </div>\n            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>\n          </div>\n        ) : items.length ? (',
            1,
        )

    # 7) Header: show lock icon next to title (best-effort)
    t = t.replace(
        f'<div className="text-lg font-black text-gray-900">{title}</div>',
        f'<div className="text-lg font-black text-gray-900 flex items-center gap-2">{title} {{hidden ? <Lock size={{16}} className="text-gray-300" /> : null}}</div>',
        1,
    )

    if t != orig:
        p.write_text(t, encoding="utf-8")
        print("OK:", path)
    else:
        print("OK (no changes):", path)

patch_page("frontend/src/app/u/[username]/followers/page.tsx", "Followers")
patch_page("frontend/src/app/u/[username]/following/page.tsx", "Following")
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
echo "  1) If you enabled 'Hide follower/following lists' on Public prism:"
echo "     - /u/<you>/followers shows 'This list is hidden' + lock icon"
echo "     - /u/<you>/following shows 'This list is hidden' + lock icon"
echo "  2) If not enabled, lists show normally."
