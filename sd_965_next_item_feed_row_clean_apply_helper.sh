#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_965_next_item_feed_row_clean"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"

CONN="frontend/src/app/siddes-profile/connections/page.tsx"
PC="frontend/src/components/PostCard.tsx"
STATE="docs/STATE.md"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"

[[ -d frontend ]] || { echo "❌ Missing frontend/ (run from repo root)"; exit 1; }
[[ -d backend  ]] || { echo "❌ Missing backend/ (run from repo root)"; exit 1; }
[[ -f "$CONN"  ]] || { echo "❌ Missing: $CONN"; exit 1; }
[[ -f "$PC"    ]] || { echo "❌ Missing: $PC"; exit 1; }

mkdir -p "$BK"
cp -a "$CONN" "$BK/connections.page.tsx.bak"
cp -a "$PC"   "$BK/PostCard.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

echo ""
echo "== 1) Fix Connections: define RelTag if missing =="

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8")

uses = "<RelTag" in s
defined = bool(re.search(r'\bfunction\s+RelTag\b|\bconst\s+RelTag\b', s))

if not uses:
    print("OK: <RelTag> not used; skipping.")
    raise SystemExit(0)

if defined:
    print("OK: RelTag already defined; skipping.")
    raise SystemExit(0)

RELTAG = '''
// sd_965: calm relationship tag (tiny dot + label; replaces noisy pills)
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
'''.strip()

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
echo "== 2) Next item: clean PostCard feed-row metadata =="

node <<'NODE'
const fs = require("fs");

const file = "frontend/src/components/PostCard.tsx";
let s = fs.readFileSync(file, "utf8");

const MARK = "sd_965_next_item_feed_row_clean";
if (!s.includes(MARK)) {
  s = s.replace('"use client";', `"use client";\n\n// ${MARK}`);
}

// --- A) ContextStamp mode support (context-only for rows) ---
if (!s.includes('mode?: "full" | "context"')) {
  const headerNeedle = 'function ContextStamp({ side, context }: { side: SideId; context?: string | null }) {';
  const headerReplacement = 'function ContextStamp({ side, context, mode = "full" }: { side: SideId; context?: string | null; mode?: "full" | "context" }) {';

  if (!s.includes(headerNeedle)) {
    console.log("NOTE: ContextStamp header shape differs; skipping mode patch.");
  } else {
    s = s.replace(headerNeedle, headerReplacement);

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
}

// --- B) Signal chips: row shows none inline; everything behind +N ---
if (!s.includes("const visible = isRow ? []")) {
  s = s.replace(
    "const visible = signalChips.slice(0, 1);",
    `const visible = isRow ? [] : signalChips.slice(0, 1); // ${MARK}`
  );
  s = s.replace(
    "const overflow = signalChips.slice(1);",
    `const overflow = isRow ? signalChips : signalChips.slice(1); // ${MARK}`
  );
}

// --- C) Metadata row: only show bullet+stamp if context exists in row; pass mode ---
if (!s.includes('mode={isRow ? "context" : "full"}')) {
  const metaNeedle =
    '<span className="text-gray-300 text-[10px]">•</span>\n              <ContextStamp side={side} context={contextChip?.label || null} />';
  if (s.includes(metaNeedle)) {
    s = s.replace(
      metaNeedle,
      `{(!isRow || contextChip?.label) ? (
                <>
                  <span className="text-gray-300 text-[10px]">•</span>
                  <ContextStamp side={side} context={contextChip?.label || null} mode={isRow ? "context" : "full"} />
                </>
              ) : null}`
    );
  } else {
    console.log("NOTE: Metadata ContextStamp call not found in expected shape; skipping stamp conditional.");
  }
}

// --- D) Hide @handle in feed rows (row variant) ---
if (!s.includes("!isRow ? <span") && s.includes("{post.handle}")) {
  // Replace the first author-handle span in the header with a row guard
  s = s.replace(
    '<span className="text-gray-400 truncate hover:underline text-[12px] font-bold">{post.handle}</span>',
    '{!isRow ? <span className="text-gray-400 truncate hover:underline text-[12px] font-bold">{post.handle}</span> : null}'
  );
}

// --- E) Hide inline chips rendering if it still renders in row ---
if (!s.includes("!isRow && visible.map")) {
  s = s.replace(
    "{visible.map((c) => (",
    "{!isRow && visible.map((c) => ("
  );
}
if (!s.includes("!isRow && overflowCount > 0")) {
  s = s.replace(
    "{overflowCount > 0 ? (",
    "{!isRow && overflowCount > 0 ? ("
  );
}

fs.writeFileSync(file, s, "utf8");
console.log("PATCHED:", file);
NODE

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Next item: PostCard row cleanup (hide @handle + inline signal chips; context-only stamp in rows) + fix missing RelTag.\n" "$SD_ID" >> "$STATE"
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
echo "Commit:"
echo "  git add $CONN $PC docs/STATE.md"
echo '  git commit -m "sd_965 feed rows: calm metadata + fix RelTag"'
echo "  git push"
