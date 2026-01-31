#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_966_calm_chrome_unread_dot_only"
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

def patch_apptopbar():
    p = Path("frontend/src/components/AppTopBar.tsx")
    if not p.exists():
        print("SKIP: missing", str(p))
        return
    s = p.read_text(encoding="utf-8")

    # Fix goBack/pageTitle same-line dirt (safe noop if already fixed)
    s = s.replace(
        'const goBack = useSmartBack("/siddes-feed");  const pageTitle = useMemo(() => {',
        'const goBack = useSmartBack("/siddes-feed");\n\n  const pageTitle = useMemo(() => {'
    )

    # Calm unread dot + copy
    s = s.replace('bg-red-500', 'bg-gray-900')
    s = s.replace('aria-label="New notifications"', 'aria-label="New alerts"')

    # Normalize only the 44px icon-button shape (rounded-full -> rounded-xl)
    s = s.replace(
        "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-full",
        "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl"
    )

    p.write_text(s, encoding="utf-8")
    print("PATCHED:", str(p))

def patch_bottomnav():
    p = Path("frontend/src/components/BottomNav.tsx")
    if not p.exists():
        print("SKIP: missing", str(p))
        return
    s = p.read_text(encoding="utf-8")

    # Calm badge color everywhere in BottomNav
    s = s.replace("bg-red-500", "bg-gray-900")

    # Dot-only chrome (no numeric counts in the nav)
    s = re.sub(r'const\s+showDot\s*=\s*n\s*>\s*0\s*&&\s*n\s*<\s*10\s*;', 'const showDot = n > 0; // sd_966 dot-only', s)
    s = re.sub(r'const\s+showCount\s*=\s*n\s*>=\s*10\s*;', 'const showCount = false; // sd_966 dot-only', s)

    p.write_text(s, encoding="utf-8")
    print("PATCHED:", str(p))

def patch_connections_reltag_guard():
    """
    Optional safety: if your Connections page uses <RelTag .../> but forgot to define it,
    define it (so gates don’t fail).
    """
    p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
    if not p.exists():
        return

    s = p.read_text(encoding="utf-8")
    if "<RelTag" not in s:
        return
    if re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s):
        return

    reltag = '''
// sd_966: calm relationship tag (tiny dot + label; replaces noisy pills)
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

    # Insert after function cn(...) if present; else after last import.
    ins = None
    cn_i = s.find("function cn")
    if cn_i != -1:
        end = s.find("\n}\n", cn_i)
        if end != -1:
            ins = end + len("\n}\n")

    if ins is None:
        imports = list(re.finditer(r'^\s*import .+?;\s*$', s, flags=re.M))
        ins = imports[-1].end() + 1 if imports else 0

    s2 = s[:ins] + "\n\n" + reltag + "\n\n" + s[ins:]
    p.write_text(s2, encoding="utf-8")
    print("PATCHED:", str(p), "(added RelTag safety)")

patch_apptopbar()
patch_bottomnav()
patch_connections_reltag_guard()
PY

echo ""
echo "== Gates =="
./verify_overlays.sh
( cd frontend && npm run typecheck && npm run build )
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Smoke checks:"
echo "  - AppTopBar bell dot is neutral (not red)"
echo "  - BottomNav badges are dot-only (no numbers) + neutral"
echo "  - If Connections used <RelTag>, it compiles"
