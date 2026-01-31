#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_962_fix_connections_reltag_and_run_gates"
FILE="frontend/src/app/siddes-profile/connections/page.tsx"

if [[ ! -d frontend ]] || [[ ! -d backend ]]; then
  echo "❌ Run from repo root (must contain frontend/ and backend/)"
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$FILE" "$BK/page.tsx.bak"
echo "Backup: $BK/page.tsx.bak"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8", errors="strict")

# If RelTag is already defined, do nothing.
if re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s):
    print("OK: RelTag already defined; no patch needed.")
    raise SystemExit(0)

# Only patch if RelTag is used
if "<RelTag" not in s:
    print("WARN: <RelTag> not found in file; skipping patch.")
    raise SystemExit(0)

RELTAG_BLOCK = r'''
// sd_962: calm relationship tag (replaces noisy badge pills)
// Shows a tiny colored dot + "You/Them/They • SideLabel"
type RelSide = "public" | "friends" | "close" | "work";

const REL_META: Record<RelSide, { label: string; dot: string }> = {
  public: { label: "Public", dot: "bg-gray-400" },
  friends: { label: "Friends", dot: "bg-blue-500" },
  close: { label: "Close", dot: "bg-rose-500" },
  work: { label: "Work", dot: "bg-slate-600" },
};

function normalizeRelSide(v: any): RelSide {
  const s = String(v || "public").toLowerCase().trim();
  if (s === "friends" || s === "close" || s === "work" || s === "public") return s as RelSide;
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

# Insert after function cn(...) block if present; else insert after imports.
ins = None

# Try insert after `function cn(...) { ... }`
cn_i = s.find("function cn")
if cn_i != -1:
    # find end of that function by the next "\n}\n" after cn_i
    end = s.find("\n}\n", cn_i)
    if end != -1:
        end += len("\n}\n")
        ins = end

if ins is None:
    # fallback: insert after last import
    imports = list(re.finditer(r'^\s*import .+?;\s*$', s, flags=re.M))
    if imports:
        ins = imports[-1].end() + 1
    else:
        ins = 0

s2 = s[:ins] + "\n\n" + RELTAG_BLOCK + "\n\n" + s[ins:]
p.write_text(s2, encoding="utf-8")
print("PATCHED:", str(p))
PY

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Next:"
echo "  git add $FILE"
echo '  git commit -m "sd_962 connections: define RelTag (calm dot tags)"'
echo "  git push"
