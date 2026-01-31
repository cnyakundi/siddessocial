#!/usr/bin/env bash
set -euo pipefail

# sd_944_public_roster_back_padding_apply_helper.sh
# Goal:
# - Public followers/following pages: Back uses Link (not router.push)
# - Add bottom padding so last item isn't hidden behind BottomNav

ROOT="$(pwd)"

need_file () {
  local rel="$1"
  if [[ ! -f "$ROOT/$rel" ]]; then
    echo "❌ Missing: $rel"
    echo "Run this from your repo root (the folder that contains ./frontend and ./backend)."
    exit 1
  fi
}

F1="frontend/src/app/u/[username]/followers/page.tsx"
F2="frontend/src/app/u/[username]/following/page.tsx"

need_file "$F1"
need_file "$F2"

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_944_${STAMP}"
mkdir -p "$BK/$(dirname "$F1")" "$BK/$(dirname "$F2")"

cp "$ROOT/$F1" "$BK/$F1"
cp "$ROOT/$F2" "$BK/$F2"

python3 - <<'PY'
from pathlib import Path
import re

def patch(path: str):
    p = Path(path)
    s = p.read_text(encoding="utf-8")

    # 1) Remove useRouter import if present
    s2, n1 = re.subn(
        r'import\s+\{\s*useParams\s*,\s*useRouter\s*\}\s+from\s+"next/navigation";',
        'import { useParams } from "next/navigation";',
        s,
        count=1,
    )
    if n1 == 0:
        # tolerate different ordering/spacing
        s2, n1b = re.subn(
            r'import\s+\{\s*useRouter\s*,\s*useParams\s*\}\s+from\s+"next/navigation";',
            'import { useParams } from "next/navigation";',
            s,
            count=1,
        )
        if n1b > 0:
            s = s2
    else:
        s = s2

    # 2) Remove router const if present
    s = re.sub(r'^\s*const\s+router\s*=\s*useRouter\(\);\s*\n', '', s, flags=re.M)

    # 3) Replace Back button with Link (targets aria-label)
    back_pat = r'''<button[\s\S]*?aria-label="Back to profile"[\s\S]*?>\s*<ChevronLeft\s+size=\{18\}\s*/>\s*Back\s*</button>'''
    repl = '''<Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700 hover:text-gray-900"
            aria-label="Back to profile"
          >
            <ChevronLeft size={18} /> Back
          </Link>'''
    s2, n2 = re.subn(back_pat, repl, s, count=1)
    if n2 != 1:
        raise SystemExit(f"{path}: could not replace Back button (pattern mismatch).")
    s = s2

    # 4) Add bottom padding to list container
    s = s.replace(
        'className="px-4 py-4 max-w-[520px] mx-auto"',
        'className="px-4 py-4 pb-[calc(120px+env(safe-area-inset-bottom))] max-w-[520px] mx-auto"',
        1,
    )

    # Safety: ensure no leftover router usage
    if "useRouter" in s or "router.push" in s or "router.back" in s:
        raise SystemExit(f"{path}: leftover router usage remains after patch.")

    p.write_text(s, encoding="utf-8")

patch("frontend/src/app/u/[username]/followers/page.tsx")
patch("frontend/src/app/u/[username]/following/page.tsx")
print("OK: roster pages patched")
PY

echo ""
echo "✅ sd_944 applied."
echo "Backups: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Manual QA:"
echo "  1) /u/<username>/followers -> Back returns cleanly"
echo "  2) Scroll to bottom -> last item not hidden under BottomNav"
echo "  3) /u/<username>/following -> same behavior"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$F1\" \"$ROOT/$F1\""
echo "  cp \"$BK/$F2\" \"$ROOT/$F2\""
