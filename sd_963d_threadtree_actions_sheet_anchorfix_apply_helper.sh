#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_963d_threadtree_actions_sheet_anchorfix"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Preconditions
for d in frontend backend scripts docs; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

TREE="frontend/src/components/thread/ThreadTree.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$TREE" ]]; then
  echo "❌ Missing: $TREE"
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "❌ node is required (safe patch)."; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$TREE")" "$BK/$(dirname "$STATE")"
cp -a "$TREE" "$BK/$TREE"
cp -a "$STATE" "$BK/$STATE" 2>/dev/null || true

echo "✅ Backup: $BK"
echo ""

echo "== Restore ThreadTree.tsx to HEAD (undo broken sd_963 attempt) =="
git restore "$TREE" || true
echo "✅ Restored: $TREE"
echo ""

node <<'NODE'
const fs = require("fs");

const TREE = "frontend/src/components/thread/ThreadTree.tsx";
const STATE = "docs/STATE.md";
const MARK = "sd_963d_actions_sheet";

function must(cond, msg) { if (!cond) throw new Error(msg); }

function scanStatementEnd(src, startIdx) {
  // Find semicolon ending statement, ignoring strings/comments and nested delimiters.
  let paren=0, brace=0, angle=0;
  let inS=false, inD=false, inB=false, inLine=false, inBlock=false;
  let esc=false;

  for (let i = startIdx; i < src.length; i++) {
    const c = src[i], n = src[i+1];

    if (inLine) { if (c === "\n") inLine=false; continue; }
    if (inBlock) { if (c==="*" && n==="/") { inBlock=false; i++; } continue; }

    if (inS) { if (!esc && c=="'") inS=false; esc = (!esc && c==="\\"); continue; }
    if (inD) { if (!esc && c=='"') inD=false; esc = (!esc && c==="\\"); continue; }
    if (inB) { if (!esc && c=="`") inB=false; esc = (!esc && c==="\\"); continue; }

    if (c==="/" && n==="/") { inLine=true; i++; continue; }
    if (c==="/" && n==="*") { inBlock=true; i++; continue; }
    if (c=="'") { inS=true; esc=false; continue; }
    if (c=='"') { inD=true; esc=false; continue; }
    if (c=="`") { inB=true; esc=false; continue; }

    if (c==="(") paren++;
    if (c===")") paren = Math.max(0, paren-1);
    if (c==="{") brace++;
    if (c==="}") brace = Math.max(0, brace-1);
    if (c==="<") angle++;
    if (c===">") angle = Math.max(0, angle-1);

    if (c===";" && paren===0 && brace===0 && angle===0) return i;
  }
  return -1;
}

let t = fs.readFileSync(TREE, "utf8");

// Idempotence
if (t.includes(MARK)) {
  console.log("NOOP:", TREE, "(already patched)");
  process.exit(0);
}

// 1) Ensure lucide-react import includes MoreHorizontal
const lucideRe = /^import\s+\{\s*([^}]+)\s*\}\s+from\s+"lucide-react";/m;
const m = t.match(lucideRe);
must(m && m[1], "sd_963d: could not find lucide-react named import line.");

const icons = m[1].split(",").map(x => x.trim()).filter(Boolean);
if (!icons.includes("MoreHorizontal")) icons.push("MoreHorizontal");
t = t.replace(lucideRe, `import { ${icons.join(", ")} } from "lucide-react";`);

// 2) Add actionsFor state right after the expanded state statement (match by substring, not exact type)
if (!t.includes("const [actionsFor, setActionsFor]")) {
  const expIdx = t.indexOf("const [expanded, setExpanded]");
  must(expIdx >= 0, "sd_963d: could not find 'const [expanded, setExpanded]' in ThreadTree.");

  const end = scanStatementEnd(t, expIdx);
  must(end !== -1, "sd_963d: could not locate end of expanded state statement (;).");

  const lineStart = t.lastIndexOf("\n", expIdx);
  const indent = lineStart === -1 ? "" : (t.slice(lineStart + 1, expIdx).match(/^\s*/)?.[0] || "");

  const insert = `\n\n${indent}// ${MARK}: lightweight per-reply actions sheet (stubs)\n${indent}const [actionsFor, setActionsFor] = useState<{ id: string; name: string; handle?: string } | null>(null);\n`;
  t = t.slice(0, end + 1) + insert + t.slice(end + 1);
}

// 3) Add the More button next to the time label in the header row
if (!t.includes("onClick={() => setActionsFor({ id: String(r.id)")) {
  const timeRe = /\{when\s*\?\s*<span[^>]*tabular-nums[^>]*>\{when\}<\/span>\s*:\s*null\}/m;
  const tm = t.match(timeRe);
  must(tm && tm[0], "sd_963d: could not find time label span (when ...).");

  const btn = `${tm[0]}\n                <button\n                  type="button"\n                  onClick={() => setActionsFor({ id: String(r.id), name, handle })}\n                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-700"\n                  aria-label="More actions"\n                  title="More"\n                >\n                  <MoreHorizontal className="w-4 h-4" />\n                </button>`;
  t = t.replace(timeRe, btn);
}

// 4) Insert the actions sheet into the return fragment, before the last </> in the component return
if (!t.includes("actionsFor ?")) {
  const lastClose = t.lastIndexOf("</>");
  must(lastClose >= 0, "sd_963d: could not find closing fragment </> to insert actions sheet.");

  const sheet = `
      {actionsFor ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setActionsFor(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-black text-sm text-gray-900 truncate">{actionsFor.name}</div>
                {actionsFor.handle ? <div className="text-xs text-gray-500 truncate">{actionsFor.handle}</div> : null}
              </div>

              <button
                type="button"
                onClick={() => setActionsFor(null)}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-extrabold hover:bg-gray-200"
              >
                Close
              </button>
            </div>

            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    alert("Report (stub)");
                  } finally {
                    setActionsFor(null);
                  }
                }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-extrabold text-gray-900"
              >
                Report
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    alert("Mute (stub)");
                  } finally {
                    setActionsFor(null);
                  }
                }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-extrabold text-gray-900"
              >
                Mute
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    alert("Block (stub)");
                  } finally {
                    setActionsFor(null);
                  }
                }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-extrabold text-rose-600"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      ) : null}

`;
  t = t.slice(0, lastClose) + sheet + t.slice(lastClose);
}

// Marker
t = `// ${MARK}\n` + t;

fs.writeFileSync(TREE, t, "utf8");
console.log("PATCHED:", TREE);

// docs/STATE.md best-effort update
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_963d:** ThreadTree: per-reply More actions sheet (Report/Mute/Block stubs) — anchor-fixed insertion after expanded state.";
    let st = fs.readFileSync(STATE, "utf8");
    if (!st.includes(mark)) {
      const line = `- ${mark}\n`;
      if (st.includes("## NEXT overlay")) st = st.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      else st += "\n\n## NEXT overlay\n" + line;
      fs.writeFileSync(STATE, st, "utf8");
      console.log("PATCHED:", STATE);
    }
  }
} catch {}
NODE

echo ""
echo "== Gates =="
./verify_overlays.sh
(
  cd frontend
  npm run typecheck
  npm run build
)
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
