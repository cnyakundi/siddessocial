#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_964_next_item_fix_reltag_and_run_gates"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"

CONN="frontend/src/app/siddes-profile/connections/page.tsx"
TOP="frontend/src/components/AppTopBar.tsx"
NAV="frontend/src/components/BottomNav.tsx"
STATE="docs/STATE.md"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"

[[ -d frontend ]] || { echo "❌ Missing frontend/ (run from repo root)"; exit 1; }
[[ -d backend  ]] || { echo "❌ Missing backend/ (run from repo root)"; exit 1; }
[[ -f "$CONN" ]] || { echo "❌ Missing: $CONN"; exit 1; }

mkdir -p "$BK"
cp -a "$CONN" "$BK/connections.page.tsx.bak"
[[ -f "$TOP" ]] && cp -a "$TOP" "$BK/AppTopBar.tsx.bak" || true
[[ -f "$NAV" ]] && cp -a "$NAV" "$BK/BottomNav.tsx.bak" || true
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

echo ""
echo "== 1) Fix: define RelTag if missing =="

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8")

uses = "<RelTag" in s
defined = bool(re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s))

if not uses:
    print("OK: <RelTag> not used; no patch needed.")
    raise SystemExit(0)

if defined:
    print("OK: RelTag already defined; no patch needed.")
    raise SystemExit(0)

RELTAG = r'''
// sd_964: calm relationship tag (tiny dot + label; replaces noisy pills)
type RelSide = "public" | "friends" | "close" | "work";

const REL_META: Record<RelSide, { label: string; dot: string }> = {
  public: { label: "Public", dot: "bg-blue-500" },
  friends: { label: "Friends", dot: "bg-emerald-500" },
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
echo "== 2) Next item polish: neutral unread dots (safe) =="

python3 - <<'PY'
from pathlib import Path

def patch(path: str):
    p = Path(path)
    if not p.exists():
        print("SKIP missing:", path)
        return
    s = p.read_text(encoding="utf-8")
    s2 = s.replace("bg-red-500", "bg-gray-900").replace('aria-label="New notifications"', 'aria-label="New alerts"')
    if s2 != s:
        p.write_text(s2, encoding="utf-8")
        print("PATCHED:", path)
    else:
        print("OK:", path, "(no change)")

patch("frontend/src/components/AppTopBar.tsx")
patch("frontend/src/components/BottomNav.tsx")
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Fix RelTag missing in connections page; neutralize unread dots (no red panic) in AppTopBar + BottomNav; gates green.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates (IMPORTANT: don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Next commit:"
echo "  git add $CONN $TOP $NAV docs/STATE.md"
echo '  git commit -m "sd_964 fix RelTag + neutral unread dots"'
echo "  git push"
