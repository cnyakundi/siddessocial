#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_973_calm_unread_chrome"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"

TOP="frontend/src/components/AppTopBar.tsx"
NAV="frontend/src/components/BottomNav.tsx"
CONN="frontend/src/app/siddes-profile/connections/page.tsx"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"
[[ -d frontend ]] || { echo "❌ Missing frontend/ (run from repo root)"; exit 1; }
[[ -d backend  ]] || { echo "❌ Missing backend/ (run from repo root)"; exit 1; }

mkdir -p "$BK"
[[ -f "$TOP"  ]] && cp -a "$TOP"  "$BK/AppTopBar.tsx.bak" || true
[[ -f "$NAV"  ]] && cp -a "$NAV"  "$BK/BottomNav.tsx.bak" || true
[[ -f "$CONN" ]] && cp -a "$CONN" "$BK/connections.page.tsx.bak" || true
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

# -----------------------
# 0) Connections RelTag safety (only if needed)
# -----------------------
conn = Path("frontend/src/app/siddes-profile/connections/page.tsx")
if conn.exists():
    s = conn.read_text(encoding="utf-8")
    uses = "<RelTag" in s
    defined = bool(re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s))
    if uses and not defined:
        reltag = '''
// sd_973 safety: define RelTag if missing (prevents gates failing)
type RelSide = "public" | "friends" | "close" | "work";

const REL_META: Record<RelSide, { label: string; dot: string }> = {
  public: { label: "Public", dot: "bg-gray-400" },
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

        # Insert after function cn(...) if present; else after last import
        ins = None
        cn_i = s.find("function cn")
        if cn_i != -1:
            end = s.find("\n}\n", cn_i)
            if end != -1:
                ins = end + len("\n}\n")
        if ins is None:
            imports = list(re.finditer(r'^\s*import .+?;\s*$', s, flags=re.M))
            ins = imports[-1].end() + 1 if imports else 0

        conn.write_text(s[:ins] + "\n\n" + reltag + "\n\n" + s[ins:], encoding="utf-8")
        print("PATCHED:", str(conn), "(added RelTag)")
    else:
        print("OK:", str(conn), "(RelTag ok / not used)")
else:
    print("SKIP: connections page not present")

# -----------------------
# 1) AppTopBar: neutral unread dot + “alerts” copy + line-break hygiene
# -----------------------
top = Path("frontend/src/components/AppTopBar.tsx")
if top.exists():
    s = top.read_text(encoding="utf-8")
    s = s.replace("bg-red-500", "bg-gray-900")
    s = s.replace('aria-label="New notifications"', 'aria-label="New alerts"')
    s = s.replace(
        'const goBack = useSmartBack("/siddes-feed");  const pageTitle = useMemo(() => {',
        'const goBack = useSmartBack("/siddes-feed");\n\n  const pageTitle = useMemo(() => {'
    )
    top.write_text(s, encoding="utf-8")
    print("PATCHED:", str(top))
else:
    print("SKIP:", str(top))

# -----------------------
# 2) BottomNav: neutral + dot-only (no numeric counts in chrome)
# -----------------------
nav = Path("frontend/src/components/BottomNav.tsx")
if nav.exists():
    s = nav.read_text(encoding="utf-8")
    s = s.replace("bg-red-500", "bg-gray-900")
    # If the showDot/showCount helpers exist, force dot-only
    s = re.sub(r'const\s+showDot\s*=\s*n\s*>\s*0\s*&&\s*n\s*<\s*10\s*;', 'const showDot = n > 0; // sd_973 dot-only', s)
    s = re.sub(r'const\s+showCount\s*=\s*n\s*>=\s*10\s*;', 'const showCount = false; // sd_973 dot-only', s)
    nav.write_text(s, encoding="utf-8")
    print("PATCHED:", str(nav))
else:
    print("SKIP:", str(nav))
PY

echo ""
echo "== Gates (don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Smoke checks:"
echo "  - AppTopBar bell dot is neutral (not red)"
echo "  - BottomNav unread indicator is dot-only (no numbers) + neutral"
