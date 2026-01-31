#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_970_circlesmark_topbar_and_compose"
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
[[ -f "$TOP"   ]] || { echo "❌ Missing: $TOP"; exit 1; }

mkdir -p "$BK"
cp -a "$TOP" "$BK/AppTopBar.tsx.bak"
[[ -f "$CMP"  ]] && cp -a "$CMP"  "$BK/ComposeMVP.tsx.bak" || true
[[ -f "$CONN" ]] && cp -a "$CONN" "$BK/connections.page.tsx.bak" || true
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

echo ""
echo "== Patch: AppTopBar + ComposeMVP CirclesMark =="

node <<'NODE'
const fs = require("fs");

function insertImportIfMissing(src, importLine) {
  if (src.includes(importLine)) return src;
  const imports = src.match(/^\s*import .+?;\s*$/gm) || [];
  if (imports.length === 0) return importLine + "\n" + src;
  const last = imports[imports.length - 1];
  const idx = src.lastIndexOf(last) + last.length;
  return src.slice(0, idx) + "\n" + importLine + src.slice(idx);
}

// --- 0) Optional safety: RelTag missing guard (only if <RelTag is used) ---
try {
  const connPath = "frontend/src/app/siddes-profile/connections/page.tsx";
  if (fs.existsSync(connPath)) {
    let s = fs.readFileSync(connPath, "utf8");
    const uses = s.includes("<RelTag");
    const defined = /\bfunction\s+RelTag\b|\bconst\s+RelTag\b/.test(s);
    if (uses && !defined) {
      const relTag = `
/** sd_970 safety: define RelTag if missing (prevents gates from failing) */
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
`.trim();

      // insert after last import
      s = insertImportIfMissing(s, "");
      const imports = s.match(/^\s*import .+?;\s*$/gm) || [];
      let insertAt = 0;
      if (imports.length) {
        const last = imports[imports.length - 1];
        insertAt = s.lastIndexOf(last) + last.length;
      }
      s = s.slice(0, insertAt) + "\n\n" + relTag + "\n\n" + s.slice(insertAt);
      fs.writeFileSync(connPath, s, "utf8");
      console.log("PATCHED:", connPath, "(added RelTag safety)");
    }
  }
} catch (e) {
  console.log("WARN: RelTag safety patch skipped:", e?.message || e);
}

// --- 1) AppTopBar: add CirclesMark to the circle/group pill + calm alerts dot ---
{
  const topPath = "frontend/src/components/AppTopBar.tsx";
  let s = fs.readFileSync(topPath, "utf8");

  s = insertImportIfMissing(s, 'import { CirclesMark } from "@/src/components/icons/CirclesMark";');

  // Insert CirclesMark into the "Choose group" pill (uses activeSetLabel)
  const labelNeedle = '<span className="truncate max-w-[180px]">{activeSetLabel}</span>';
  if (s.includes(labelNeedle) && !s.includes("<CirclesMark")) {
    s = s.replace(
      labelNeedle,
      '<CirclesMark size={16} className="text-gray-400 shrink-0" />\n                  ' + labelNeedle
    );
    console.log("PATCHED:", topPath, "(CirclesMark added to circle pill)");
  } else {
    console.log("OK:", topPath, "(circle pill already has icon or anchor not found)");
  }

  // Calm alerts dot (no red panic) + copy
  s = s.replace("bg-red-500", "bg-gray-900");
  s = s.replace('aria-label="New notifications"', 'aria-label="New alerts"');

  fs.writeFileSync(topPath, s, "utf8");
}

// --- 2) ComposeMVP: replace audience dot with CirclesMark if "Choose audience" pill exists ---
{
  const cmpPath = "frontend/src/app/siddes-compose/ComposeMVP.tsx";
  if (!fs.existsSync(cmpPath)) {
    console.log("SKIP:", cmpPath, "(file not present)");
  } else {
    let s = fs.readFileSync(cmpPath, "utf8");
    if (!s.includes('aria-label="Choose audience"')) {
      console.log("SKIP:", cmpPath, "(no Choose audience pill)");
    } else {
      s = insertImportIfMissing(s, 'import { CirclesMark } from "@/src/components/icons/CirclesMark";');

      const dot = '<span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />';
      if (s.includes(dot) && !s.includes("CirclesMark size={16}")) {
        s = s.replace(dot, '<CirclesMark size={16} className="text-gray-400 shrink-0" />');
        console.log("PATCHED:", cmpPath, "(CirclesMark replaces dot in audience pill)");
      } else {
        console.log("OK:", cmpPath, "(dot not found or already patched)");
      }
      fs.writeFileSync(cmpPath, s, "utf8");
    }
  }
}
NODE

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** UI: add CirclesMark to AppTopBar circle picker + Compose audience pill (when present); calm alerts dot color/copy.\n" "$SD_ID" >> "$STATE"
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
echo "  - AppTopBar: circle pill shows CirclesMark before label"
echo "  - Alerts bell dot is neutral (not red)"
echo "  - Compose: audience pill shows CirclesMark (if the pill exists)"
