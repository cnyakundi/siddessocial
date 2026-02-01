#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_962_threadtree_like_counts"
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
const MARK = "sd_962_like_counts";

let t = fs.readFileSync(TREE, "utf8");
if (t.includes(MARK)) {
  console.log("NOOP:", TREE, "(already patched)");
} else {
  // Add Heart icon import if missing (we already use CornerDownRight)
  if (t.includes('from "lucide-react"') && !t.includes("Heart")) {
    t = t.replace(/import\s+\{\s*CornerDownRight\s*\}\s+from\s+"lucide-react";/m, 'import { CornerDownRight, Heart } from "lucide-react";');
  } else if (!t.includes("Heart")) {
    // fallback if import line drifted
    t = t.replace(/from "lucide-react";/m, (m) => {
      if (t.includes("CornerDownRight")) return m;
      return m;
    });
  }

  // Insert likeCount computation inside renderNode
  // We look for `const when = fmtTime(` and insert after it.
  const needle = "const when = fmtTime";
  const idx = t.indexOf(needle);
  if (idx !== -1) {
    // Find line end
    const lineEnd = t.indexOf("\n", idx);
    const indent = (t.slice(t.lastIndexOf("\n", idx) + 1, idx).match(/^\s*/)?.[0]) || "    ";
    const insert = `\n${indent}const likeCount = Number((r as any).likeCount ?? (r as any).likes ?? 0);\n`;
    t = t.slice(0, lineEnd) + insert + t.slice(lineEnd);
  }

  // Add like button row under Reply button
  // Find the existing Reply button block and append a compact like count.
  const replyBtnNeedle = 'onClick={() => onReplyTo?.(String(r.id), name)}';
  const pos = t.indexOf(replyBtnNeedle);
  if (pos !== -1) {
    // Find the container end `</div>` of the mt-3 block.
    const mt3Start = t.lastIndexOf('<div className="mt-3">', pos);
    const mt3End = t.indexOf("</div>", pos);
    if (mt3Start !== -1 && mt3End !== -1) {
      const after = mt3End + "</div>".length;
      const indent = (t.slice(t.lastIndexOf("\n", mt3Start) + 1, mt3Start).match(/^\s*/)?.[0]) || "              ";
      const likeRow = `
${indent}<div className="mt-2 flex items-center gap-2 text-xs font-extrabold text-gray-500">
${indent}  <Heart className="w-3.5 h-3.5" />
${indent}  <span>{likeCount}</span>
${indent}</div>
`;
      t = t.slice(0, after) + likeRow + t.slice(after);
    }
  }

  // Marker
  t = `// ${MARK}\n` + t;

  fs.writeFileSync(TREE, t, "utf8");
  console.log("PATCHED:", TREE);

  // STATE.md update
  try {
    if (fs.existsSync(STATE)) {
      const mark = "**sd_962:** ThreadTree: show like counts on replies (compact row under Reply button).";
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
