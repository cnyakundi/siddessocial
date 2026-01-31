#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_968_circlesmark_topbar_and_compose"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"

TOP="frontend/src/components/AppTopBar.tsx"
CMP="frontend/src/app/siddes-compose/ComposeMVP.tsx"
CONN="frontend/src/app/siddes-profile/connections/page.tsx"
STATE="docs/STATE.md"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"

[[ -d frontend ]] || { echo "❌ Missing frontend/ (run from repo root)"; exit 1; }
[[ -d backend  ]] || { echo "❌ Missing backend/ (run from repo root)"; exit 1; }
[[ -f "$TOP" ]] || { echo "❌ Missing: $TOP"; exit 1; }

mkdir -p "$BK"
cp -a "$TOP" "$BK/AppTopBar.tsx.bak"
[[ -f "$CMP"  ]] && cp -a "$CMP"  "$BK/ComposeMVP.tsx.bak" || true
[[ -f "$CONN" ]] && cp -a "$CONN" "$BK/connections.page.tsx.bak" || true
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

# ---------------------------
# Helper: insert import line
# ---------------------------
def ensure_import(text: str, import_line: str, after_pattern: str) -> str:
    if import_line in text:
        return text
    m = re.search(after_pattern, text, flags=re.M)
    if m:
        i = m.end()
        return text[:i] + "\n" + import_line + text[i:]
    # fallback: after last import
    imports = list(re.finditer(r'^\s*import .+?;\s*$', text, flags=re.M))
    if imports:
        i = imports[-1].end()
        return text[:i] + "\n" + import_line + text[i:]
    return import_line + "\n" + text

# ---------------------------
# 0) (Optional) RelTag safety
# ---------------------------
p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
if p.exists():
    s = p.read_text(encoding="utf-8")
    if "<RelTag" in s and not re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s):
        reltag = '''
// sd_968: calm relationship tag (tiny dot + label)
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

        # insert after function cn(...) if present else after imports
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
    else:
        print("OK:", str(p), "(RelTag ok / not used)")
else:
    print("SKIP: connections page not present")

# ---------------------------
# 1) AppTopBar: CirclesMark in Circle pill + calm bell dot
# ---------------------------
top = Path("frontend/src/components/AppTopBar.tsx")
t = top.read_text(encoding="utf-8")

t = ensure_import(
    t,
    'import { CirclesMark } from "@/src/components/icons/CirclesMark";',
    r'^\s*import\s+\{[^}]*\}\s+from\s+"lucide-react";\s*$'
)

# Insert CirclesMark into the "Choose group" button (circle scope pill)
# Find the exact line with activeSetLabel span and inject icon before it.
pat = re.compile(r'(<button[\s\S]*?aria-label="Choose group"[\s\S]*?>)([\s\S]*?)(<span className="truncate max-w-\[180px\]">\{activeSetLabel\}</span>)', re.M)
m = pat.search(t)
if m and "CirclesMark" not in t[m.start():m.end()]:
    before_btn = m.group(1)
    mid = m.group(2)
    label_span = m.group(3)
    inject = '<CirclesMark size={16} className="text-gray-400 shrink-0" />\n                  '
    t = t[:m.start()] + before_btn + mid + inject + label_span + t[m.end():]
    print("PATCHED:", str(top), "(added CirclesMark to circle pill)")
else:
    print("OK:", str(top), "(circle pill already has icon or not found)")

# Calm bell dot + copy (no red panic)
t = t.replace("bg-red-500", "bg-gray-900").replace('aria-label="New notifications"', 'aria-label="New alerts"')

top.write_text(t, encoding="utf-8")

# ---------------------------
# 2) ComposeMVP: if it’s on “Choose audience” pill, replace dot with CirclesMark
# ---------------------------
cmp = Path("frontend/src/app/siddes-compose/ComposeMVP.tsx")
if cmp.exists():
    s = cmp.read_text(encoding="utf-8")

    # Only patch if new audience button exists
    if 'aria-label="Choose audience"' in s:
        s = ensure_import(
            s,
            'import { CirclesMark } from "@/src/components/icons/CirclesMark";',
            r'^\s*import\s+\{[^}]*\}\s+from\s+"lucide-react";\s*$'
        )

        dot = '<span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />'
        if dot in s and "CirclesMark" not in s:
            s = s.replace(dot, '<CirclesMark size={16} className="text-gray-400 shrink-0" />', 1)
            print("PATCHED:", str(cmp), "(CirclesMark in audience pill)")
        else:
            print("OK:", str(cmp), "(dot not found or already patched)")
        cmp.write_text(s, encoding="utf-8")
    else:
        print("SKIP:", str(cmp), "(not on Choose audience version; leaving it)")
else:
    print("SKIP: ComposeMVP not present")

PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** UI polish: add CirclesMark icon to AppTopBar circle picker (and Compose audience pill when available); calm alerts dot color/copy.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
( cd frontend && npm run typecheck && npm run build )
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Smoke test:"
echo "  - AppTopBar: Circle pill shows CirclesMark before label"
echo "  - Bell dot is neutral (not red)"
echo "  - Compose: if it has 'Choose audience' pill, it shows CirclesMark"
