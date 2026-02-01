#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_963_threadtree_reply_actions_sheet"
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

[[ -f "$TREE" ]] || { echo "❌ Missing: $TREE"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node is required."; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$TREE")" "$BK/$(dirname "$STATE")"
cp -a "$TREE" "$BK/$TREE"
cp -a "$STATE" "$BK/$STATE" 2>/dev/null || true

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const TREE = "frontend/src/components/thread/ThreadTree.tsx";
const STATE = "docs/STATE.md";
const MARK = "sd_963_reply_actions";

let t = fs.readFileSync(TREE, "utf8");
if (t.includes(MARK)) {
  console.log("NOOP:", TREE, "(already patched)");
} else {
  // Ensure needed icons
  if (t.includes('from "lucide-react"') && !t.includes("MoreHorizontal")) {
    t = t.replace(/import\s+\{\s*CornerDownRight([^}]*)\}\s+from\s+"lucide-react";/m, (m, rest) => {
      if (m.includes("MoreHorizontal")) return m;
      if (m.includes("CornerDownRight") && m.includes("Heart")) {
        return m.replace("Heart }", "Heart, MoreHorizontal }");
      }
      if (m.includes("CornerDownRight")) {
        return m.replace("CornerDownRight }", "CornerDownRight, MoreHorizontal }");
      }
      return m;
    });
    if (!t.includes("MoreHorizontal")) {
      // Fallback add icon import line
      t = t.replace(/from "lucide-react";/m, 'from "lucide-react";\n');
    }
  }

  // Add local action sheet state near expanded state
  const expandedNeedle = "const [expanded, setExpanded]";
  const idx = t.indexOf(expandedNeedle);
  if (idx !== -1) {
    const lineStart = t.lastIndexOf("\n", idx);
    const indent = (t.slice(lineStart + 1, idx).match(/^\s*/)?.[0]) || "  ";
    const insert = `
${indent}// ${MARK}: lightweight actions sheet (Report / Mute / Block)
${indent}const [actionsFor, setActionsFor] = useState<{ id: string; name: string; handle?: string } | null>(null);
`;
    // Insert only if not present
    if (!t.includes("setActionsFor")) {
      t = t.slice(0, lineStart) + t.slice(lineStart, lineStart) + t.slice(0, idx) + insert + t.slice(idx);
    }
  }

  // Add "..." button in each reply row near header (timestamp row)
  // Find the timestamp span and insert a More button after it.
  const tsRe = /(\{when \? <span className="text-gray-400 text-xs tabular-nums shrink-0">\{when\}<\/span> : null\})/m;
  if (tsRe.test(t) && !t.includes("setActionsFor({ id:")) {
    t = t.replace(tsRe, `$1
              <button
                type="button"
                onClick={() => setActionsFor({ id: String(r.id), name, handle })}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-700"
                aria-label="More"
                title="More"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>`);
  }

  // Add modal sheet near end of component return, before closing </>
  const returnNeedle = "return (";
  const rpos = t.lastIndexOf(returnNeedle);
  if (rpos !== -1 && !t.includes("actionsFor ?")) {
    // Insert in the returned fragment near bottom: after {roots.map...}
    t = t.replace(
      /return\s*\(\s*<>\s*\{roots\.map\(\(r\) => renderNode\(r,\s*0\)\)\}\s*<\/>\s*\);\s*/m,
      `return (
    <>
      {roots.map((r) => renderNode(r, 0))}

      {actionsFor ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
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
                onClick={() => { try { alert("Report (stub)"); } finally { setActionsFor(null); } }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-extrabold text-gray-900"
              >
                Report
              </button>
              <button
                type="button"
                onClick={() => { try { alert("Mute (stub)"); } finally { setActionsFor(null); } }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-extrabold text-gray-900"
              >
                Mute
              </button>
              <button
                type="button"
                onClick={() => { try { alert("Block (stub)"); } finally { setActionsFor(null); } }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-extrabold text-rose-600"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );`
    );
  }

  // Marker
  t = `// ${MARK}\n` + t;

  fs.writeFileSync(TREE, t, "utf8");
  console.log("PATCHED:", TREE);

  try {
    if (fs.existsSync(STATE)) {
      const mark = "**sd_963:** ThreadTree: add per-reply More actions sheet (Report/Mute/Block stubs).";
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
}
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
