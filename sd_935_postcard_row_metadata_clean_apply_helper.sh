#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_935_postcard_row_metadata_clean"
FILE="frontend/src/components/PostCard.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp "$FILE" "$BK/PostCard.tsx.bak"
[[ -f "$STATE" ]] && cp "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

# If ComposeMVP was previously corrupted by a bad patch (python f-string in TSX), restore it so gates can run.
if [[ -f "frontend/src/app/siddes-compose/ComposeMVP.tsx" ]]; then
  if grep -q 'f"{members} people"' "frontend/src/app/siddes-compose/ComposeMVP.tsx"; then
    echo "⚠️ Detected invalid python f-string in ComposeMVP.tsx -> restoring from git HEAD"
    git checkout -- "frontend/src/app/siddes-compose/ComposeMVP.tsx"
  fi
fi

node <<'NODE'
const fs = require("fs");

const file = "frontend/src/components/PostCard.tsx";
let s = fs.readFileSync(file, "utf8");

const MARK = "sd_935_postcard_row_metadata_clean";
if (s.includes(MARK)) {
  console.log("SKIP: sd_935 already applied.");
  process.exit(0);
}

// --- Patch ContextStamp to support mode="context" ---
const funcRe = /function ContextStamp\([\s\S]*?\n\}\n/;
const m = s.match(funcRe);
if (!m) throw new Error("sd_935: Could not find ContextStamp() block.");

let block = m[0];

const headerNeedle = 'function ContextStamp({ side, context }: { side: SideId; context?: string | null }) {';
if (block.includes(headerNeedle)) {
  block = block.replace(
    headerNeedle,
    'function ContextStamp({ side, context, mode = "full" }: { side: SideId; context?: string | null; mode?: "full" | "context" }) {'
  );
} else if (!block.includes('mode?: "full" | "context"')) {
  throw new Error("sd_935: ContextStamp header shape changed.");
}

const themeNeedle = "  const theme = SIDE_THEMES[side];";
if (!block.includes(themeNeedle)) throw new Error("sd_935: Could not find theme line in ContextStamp.");

if (!block.includes('mode === "context"')) {
  block = block.replace(
    themeNeedle,
    themeNeedle +
      `

  // ${MARK}: row variant wants context-only (no redundant Side label)
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

s = s.replace(m[0], block);

// --- Patch signal chips: row gets no inline chips; everything behind +N ---
const chipsNeedle =
  '  // Keep chips for signals (Mention/Doc/Urgent), with overflow sheet.\n' +
  '  const signalChips = allChips.filter((c) => c.id !== "topic" && c.id !== "set");\n' +
  '  const visible = signalChips.slice(0, 1);\n' +
  '  const overflow = signalChips.slice(1);\n' +
  '  const overflowCount = overflow.length;\n';

if (!s.includes(chipsNeedle)) {
  throw new Error("sd_935: Could not find the signal chips block (file shape changed).");
}

const chipsReplacement =
  '  // Keep chips for signals (Mention/Doc/Urgent), with overflow sheet.\n' +
  `  // ${MARK}: keep feed rows calm; signals live behind +N.\n` +
  '  const signalChips = allChips.filter((c) => c.id !== "topic" && c.id !== "set");\n' +
  '  const visible = isRow ? [] : signalChips.slice(0, 1);\n' +
  '  const overflow = isRow ? signalChips : signalChips.slice(1);\n' +
  '  const overflowCount = overflow.length;\n';

s = s.replace(chipsNeedle, chipsReplacement);

// --- Patch metadata row: only show stamp in row when context exists; use mode="context" ---
const metaRe = /(\s*)<span className="text-gray-300 text-\[10px\]">•<\/span>\s*\n\s*<ContextStamp side=\{side\} context=\{contextChip\?\.\label \|\| null\} \/>/;
if (!metaRe.test(s)) {
  throw new Error("sd_935: Could not find ContextStamp call in metadata row.");
}

s = s.replace(metaRe, (_m, indent) => {
  return (
`${indent}{(!isRow || contextChip?.label) ? (
${indent}  <>
${indent}    <span className="text-gray-300 text-[10px]">•</span>
${indent}    <ContextStamp side={side} context={contextChip?.label || null} mode={isRow ? "context" : "full"} />
${indent}  </>
${indent}) : null}`
  );
});

fs.writeFileSync(file, s, "utf8");
console.log("PATCHED:", file);

// docs/STATE.md best-effort
const stateFile = "docs/STATE.md";
if (fs.existsSync(stateFile)) {
  let t = fs.readFileSync(stateFile, "utf8");
  if (!t.includes(MARK)) {
    const line = `- **${MARK}:** PostCard row: remove redundant Side stamp; show circle/topic only; move signal chips behind +N for cleaner feed rows.\\n`;
    if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\\n" + line);
    else t += "\\n\\n## NEXT overlay\\n" + line;
    fs.writeFileSync(stateFile, t, "utf8");
    console.log("PATCHED:", stateFile);
  }
}
NODE

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: $BK"
