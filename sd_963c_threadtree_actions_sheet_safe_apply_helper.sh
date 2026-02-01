#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_963c_threadtree_actions_sheet_safe"
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

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required (safe patch)."
  exit 1
fi

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
const MARK = "sd_963c_actions_sheet";

function must(cond, msg) { if (!cond) throw new Error(msg); }

let t = fs.readFileSync(TREE, "utf8");

if (!t.includes(MARK)) {
  // 1) Ensure lucide-react import includes MoreHorizontal
  const lucideRe = /^import\s+\{\s*([^}]+)\s*\}\s+from\s+"lucide-react";/m;
  const m = t.match(lucideRe);
  must(m && m[1], "sd_963c: could not find lucide-react named import line.");

  const icons = m[1].split(",").map(x => x.trim()).filter(Boolean);
  if (!icons.includes("MoreHorizontal")) icons.push("MoreHorizontal");
  t = t.replace(lucideRe, `import { ${icons.join(", ")} } from "lucide-react";`);

  // 2) Add actionsFor state (after expanded state)
  if (!t.includes("const [actionsFor, setActionsFor]")) {
    const expandedRe = /(^\s*const\s+\[expanded,\s*setExpanded\]\s*=\s*useState<[^>]*>\(\{\}\);.*$)/m;
    const ex = t.match(expandedRe);
    must(ex && ex[1], "sd_963c: could not find expanded state line in ThreadTree.");
    const indent = (ex[1].match(/^\s*/) || [""])[0];

    const insert = `${ex[1]}\n\n${indent}// ${MARK}: lightweight per-reply actions sheet (stubs)\n${indent}const [actionsFor, setActionsFor] = useState<{ id: string; name: string; handle?: string } | null>(null);\n`;
    t = t.replace(ex[1], insert);
  }

  // 3) Add More button next to time span (inside renderNode header)
  if (!t.includes("onClick={() => setActionsFor({ id: String(r.id)")) {
    const timeRe = /\{when\s*\?\s*<span[^>]*tabular-nums[^>]*>\{when\}<\/span>\s*:\s*null\}/m;
    const tm = t.match(timeRe);
    must(tm && tm[0], "sd_963c: could not find time span {when ? <span ...>{when}</span> : null}.");

    const btn = `${tm[0]}\n                <button\n                  type="button"\n                  onClick={() => setActionsFor({ id: String(r.id), name, handle })}\n                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-700"\n                  aria-label="More actions"\n                  title="More"\n                >\n                  <MoreHorizontal className="w-4 h-4" />\n                </button>`;
    t = t.replace(timeRe, btn);
  }

  // 4) Insert the sheet JSX inside the return fragment before </>.
  if (!t.includes("actionsFor ?")) {
    const needle = "{roots.map((r) => renderNode(r, 0))}";
    const idx = t.indexOf(needle);
    must(idx >= 0, "sd_963c: could not find roots.map render needle in ThreadTree return.");
    const closeFrag = t.indexOf("</>", idx);
    must(closeFrag >= 0, "sd_963c: could not find closing fragment </> after roots map.");

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
    t = t.slice(0, closeFrag) + sheet + t.slice(closeFrag);
  }

  // 5) Marker at top
  t = `// ${MARK}\n` + t;

  fs.writeFileSync(TREE, t, "utf8");
  console.log("PATCHED:", TREE);
} else {
  console.log("NOOP:", TREE, "(already patched)");
}

// Update STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_963c:** ThreadTree: per-reply More actions sheet (Report/Mute/Block stubs) — safe patch after syntax error.";
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
