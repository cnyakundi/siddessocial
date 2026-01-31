#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_963_next_item_calm_unread_and_fix_reltag"
ROOT="$(pwd)"

CONN="frontend/src/app/siddes-profile/connections/page.tsx"
TOP="frontend/src/components/AppTopBar.tsx"
NAV="frontend/src/components/BottomNav.tsx"
STATE="docs/STATE.md"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "❌ Run from repo root (must contain frontend/ and backend/)"
  exit 1
fi

for f in "$CONN" "$TOP" "$NAV"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ Missing: $f"
    exit 1
  fi
done

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$CONN" "$BK/connections.page.tsx.bak"
cp -a "$TOP" "$BK/AppTopBar.tsx.bak"
cp -a "$NAV" "$BK/BottomNav.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

echo ""
echo "== 1) Fix RelTag missing in Connections page (if needed) =="

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8")

# Only patch if RelTag is used and not defined
uses = "<RelTag" in s
defined = bool(re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s))

if not uses:
    print("OK: Connections page does not use <RelTag>; skipping.")
    raise SystemExit(0)

if defined:
    print("OK: RelTag already defined; skipping.")
    raise SystemExit(0)

RELTAG = r'''
// sd_963: calm relationship tag (tiny dot + label, no noisy badge pills)
type RelSide = "public" | "friends" | "close" | "work";

const REL_META: Record<RelSide, { label: string; dot: string }> = {
  public: { label: "Public", dot: "bg-gray-400" },
  friends: { label: "Friends", dot: "bg-blue-500" },
  close: { label: "Close", dot: "bg-rose-500" },
  work: { label: "Work", dot: "bg-slate-600" },
};

function normalizeRelSide(v: any): RelSide {
  const x = String(v || "public").toLowerCase().trim();
  if (x === "public" || x === "friends" || x === "close" || x === "work") return x as RelSide;
  return "public";
}

function RelTag({ side, who }: { side: any; who: string }) {
  const k = normalizeRelSide(side);
  const meta = REL_META[k];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={"w-1.5 h-1.5 rounded-full " + meta.dot} aria-hidden="true" />
      <span className="text-gray-500">{who}</span>
      <span className="text-gray-300">•</span>
      <span className="font-extrabold text-gray-900">{meta.label}</span>
    </span>
  );
}
'''.strip("\n")

# Insert after function cn(...) if present; else after last import.
ins = None
cn = s.find("function cn")
if cn != -1:
    end = s.find("\n}\n", cn)
    if end != -1:
        ins = end + len("\n}\n")

if ins is None:
    imports = list(re.finditer(r'^\s*import .+?;\s*$', s, flags=re.M))
    ins = imports[-1].end() + 1 if imports else 0

s2 = s[:ins] + "\n\n" + RELTAG + "\n\n" + s[ins:]
p.write_text(s2, encoding="utf-8")
print("PATCHED:", str(p))
PY

echo ""
echo "== 2) Next item: calm unread indicators (dot-only + neutral) =="

python3 - <<'PY'
from pathlib import Path
import re

# AppTopBar: make unread dot neutral; a11y copy “alerts”
p = Path("frontend/src/components/AppTopBar.tsx")
s = p.read_text(encoding="utf-8")
s2 = s.replace("bg-red-500", "bg-gray-900").replace('aria-label="New notifications"', 'aria-label="New alerts"')
if s2 != s:
    p.write_text(s2, encoding="utf-8")
    print("PATCHED:", str(p))
else:
    print("OK:", str(p), "no change needed")

# BottomNav: make badge neutral + dot-only (no numeric counts in chrome)
p = Path("frontend/src/components/BottomNav.tsx")
s = p.read_text(encoding="utf-8")
orig = s

s = s.replace("bg-red-500", "bg-gray-900").replace('aria-label="New notifications"', 'aria-label="New alerts"')
s = s.replace(" unread notifications", " unread alerts")

# Make dot-only if these helpers exist
s = re.sub(r'const\s+showDot\s*=\s*n\s*>\s*0\s*&&\s*n\s*<\s*10\s*;', 'const showDot = n > 0; // sd_963 dot-only', s)
s = re.sub(r'const\s+showCount\s*=\s*n\s*>=\s*10\s*;', 'const showCount = false; // sd_963 dot-only', s)

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("PATCHED:", str(p))
else:
    print("OK:", str(p), "no change needed")
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Next item: fix missing RelTag in Connections page; calm unread indicators (dot-only + neutral) in AppTopBar + BottomNav.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke checks:"
echo "  - /siddes-profile/connections compiles (RelTag defined)"
echo "  - Top bell unread dot is neutral (not red)"
echo "  - BottomNav unread indicator is dot-only (no numbers)"
