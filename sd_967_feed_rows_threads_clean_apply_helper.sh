#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_967_feed_rows_threads_clean"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"

POST="frontend/src/components/PostCard.tsx"
CONN="frontend/src/app/siddes-profile/connections/page.tsx"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"

[[ -d frontend ]] || { echo "❌ Missing frontend/ (run from repo root)"; exit 1; }
[[ -d backend  ]] || { echo "❌ Missing backend/ (run from repo root)"; exit 1; }
[[ -f "$POST"  ]] || { echo "❌ Missing: $POST"; exit 1; }

mkdir -p "$BK"
cp -a "$POST" "$BK/PostCard.tsx.bak"
[[ -f "$CONN" ]] && cp -a "$CONN" "$BK/connections.page.tsx.bak" || true
echo "Backup: $BK"

echo ""
echo "== 0) Safety: define RelTag in Connections if needed (only if missing) =="

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
if not p.exists():
    print("SKIP: connections page not found")
    raise SystemExit(0)

s = p.read_text(encoding="utf-8")
uses = "<RelTag" in s
defined = bool(re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s))

if (not uses) or defined:
    print("OK: RelTag fix not needed")
    raise SystemExit(0)

reltag = '''
// sd_967: calm relationship tag (tiny dot + label; replaces noisy pills)
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

p.write_text(s[:ins] + "\n\n" + reltag + "\n\n" + s[ins:], encoding="utf-8")
print("PATCHED:", str(p))
PY

echo ""
echo "== 1) Next item: PostCard row cleanliness (Threads-style scan) =="

node <<'NODE'
const fs = require("fs");

const file = "frontend/src/components/PostCard.tsx";
let s = fs.readFileSync(file, "utf8");

const MARK = "sd_967_feed_rows_threads_clean";
if (!s.includes(MARK)) {
  s = s.replace('"use client";', `"use client";\n\n// ${MARK}`);
}

// A) ContextStamp: add mode="context" for row (context-only label)
const sigOld = 'function ContextStamp({ side, context }: { side: SideId; context?: string | null }) {';
const sigNew = 'function ContextStamp({ side, context, mode = "full" }: { side: SideId; context?: string | null; mode?: "full" | "context" }) {';
if (s.includes(sigOld)) {
  s = s.replace(sigOld, sigNew);

  const themeNeedle = "  const theme = SIDE_THEMES[side];";
  if (s.includes(themeNeedle) && !s.includes('mode === "context"')) {
    s = s.replace(
      themeNeedle,
      themeNeedle +
        `

  // ${MARK}: row wants context-only (no redundant Side label)
  if (mode === "context") {
    if (!context) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border",
          theme.lightBg,
          theme.text,
          theme.border
        )}
        aria-label={context}
        title={context}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", theme.primaryBg)} aria-hidden="true" />
        <span className="font-semibold truncate max-w-[180px]">{context}</span>
      </span>
    );
  }
`
    );
  }
}

// B) Chips: hide inline in rows; keep behind +N
// Replace the exact block seen in the file_search snippet
const chipsRe = /const signalChips = allChips\.filter\(\(c\) => c\.id !== "topic" && c\.id !== "set"\);\s*\n\s*const visible = signalChips\.slice\(0, 1\);\s*\n\s*const overflow = signalChips\.slice\(1\);\s*\n\s*const overflowCount = overflow\.length;/m;

if (chipsRe.test(s) && !s.includes("sd_967_signals_behind_plus")) {
  s = s.replace(
    chipsRe,
    `// sd_967_signals_behind_plus: keep feed rows calm; signals live behind +N
  const signalChips = allChips.filter((c) => c.id !== "topic" && c.id !== "set");
  const visible = isRow ? [] : signalChips.slice(0, 1);
  const overflow = isRow ? signalChips : signalChips.slice(1);
  const overflowCount = overflow.length;`
  );
}

// C) Metadata row: only render bullet+stamp in row when context exists + pass mode
const metaNeedle =
  `<span className="text-gray-300 text-[10px]">•</span>
              <ContextStamp side={side} context={contextChip?.label || null} />`;

if (s.includes(metaNeedle) && !s.includes('mode={isRow ? "context" : "full"}')) {
  s = s.replace(
    metaNeedle,
    `{(!isRow || contextChip?.label) ? (
                <>
                  <span className="text-gray-300 text-[10px]">•</span>
                  <ContextStamp side={side} context={contextChip?.label || null} mode={isRow ? "context" : "full"} />
                </>
              ) : null}`
  );
}

// D) Hide @handle in row variant
const handleNeedle = '<span className="text-gray-400 truncate hover:underline text-[12px] font-bold">{post.handle}</span>';
if (s.includes(handleNeedle) && !s.includes("!isRow ?")) {
  s = s.replace(
    handleNeedle,
    '{!isRow ? <span className="text-gray-400 truncate hover:underline text-[12px] font-bold">{post.handle}</span> : null}'
  );
}

// E) Render visible chips as-is (visible is [] for rows now). No need to wrap.
// Keep overflow +N visible in rows so signals are accessible without clutter.

fs.writeFileSync(file, s, "utf8");
console.log("PATCHED:", file);
NODE

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
echo "  - Open /siddes-feed"
echo "  - Feed rows: no @handle, no inline chips, context stamp only when it exists"
echo "  - Signals appear behind +N"
