#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_954_ui_reply_to_nested"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Bulletproof preconditions
for d in frontend backend scripts; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

PAGE="frontend/src/app/siddes-post/[id]/page.tsx"
TREE="frontend/src/components/thread/ThreadTree.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$PAGE" ]]; then
  echo "❌ Missing: $PAGE"
  exit 1
fi
if [[ ! -f "$TREE" ]]; then
  echo "❌ Missing: $TREE"
  echo "Run sd_952 first (ThreadTree)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required for safe patching."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"

backup_one () {
  local rel="$1"
  if [[ -f "$rel" ]]; then
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$rel" "$BK/$rel"
  fi
}

backup_one "$PAGE"
backup_one "$TREE"
backup_one "$STATE"

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const TREE = "frontend/src/components/thread/ThreadTree.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

// -------------------------------
// 1) Patch ThreadTree: show Reply button at ALL levels
// -------------------------------
let tree = fs.readFileSync(TREE, "utf8");
const markerTree = "sd_954_reply_any_level";
if (!tree.includes(markerTree)) {
  const re = /{\s*\/\*\s*Backend currently limits nesting;[^\n]*\*\/\s*}\s*\n\s*{\s*level\s*===\s*0\s*\?\s*\([\s\S]*?\)\s*:\s*null\s*}\s*/m;
  if (re.test(tree)) {
    tree = tree.replace(re, () => {
      return `{/* ${markerTree}: Reply is allowed at any depth now that backend supports deep threading. */}
              <div className="mt-3">
                <button
                  type="button"
                  className="px-3 py-2 rounded-full border border-gray-200 bg-white text-xs font-extrabold text-gray-800 hover:bg-gray-50 active:bg-gray-50/70"
                  onClick={() => onReplyTo?.(String(r.id), name)}
                  aria-label="Reply"
                  title="Reply"
                >
                  Reply
                </button>
              </div>
`;
    });
  } else {
    const needle = '<div className="text-sm text-gray-900 leading-relaxed mt-1 whitespace-pre-wrap">{r.text}</div>';
    must(tree.includes(needle), "sd_954: could not find reply text line in ThreadTree.tsx to insert Reply button.");
    tree = tree.replace(needle, needle + `

              {/* ${markerTree}: Reply at any depth */}
              <div className="mt-3">
                <button
                  type="button"
                  className="px-3 py-2 rounded-full border border-gray-200 bg-white text-xs font-extrabold text-gray-800 hover:bg-gray-50 active:bg-gray-50/70"
                  onClick={() => onReplyTo?.(String(r.id), name)}
                >
                  Reply
                </button>
              </div>
`);
  }

  fs.writeFileSync(TREE, tree, "utf8");
  console.log("PATCHED:", TREE);
} else {
  console.log("SKIP:", TREE, "(already has sd_954 marker)");
}

// -------------------------------
// 2) Patch page.tsx: send parentId when replyingTo is set
// -------------------------------
let page = fs.readFileSync(PAGE, "utf8");
const markerPage = "sd_954_send_parent_id";
if (!page.includes(markerPage)) {
  const fnIdx = page.indexOf("async function sendReplyNow");
  must(fnIdx >= 0, "sd_954: could not find 'async function sendReplyNow' in page.tsx (file drifted).");

  const bodyStart = page.indexOf("{", fnIdx);
  must(bodyStart >= 0, "sd_954: could not parse sendReplyNow function body start.");

  let depth = 0;
  let end = -1;
  for (let i = bodyStart; i < page.length; i++) {
    if (page[i] === "{") depth++;
    if (page[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  must(end > bodyStart, "sd_954: could not find end of sendReplyNow function body.");

  const fnBody = page.slice(fnIdx, end + 1);

  const jsRe = /JSON\.stringify\(\s*\{([\s\S]*?)\}\s*\)/m;
  must(jsRe.test(fnBody), "sd_954: could not find JSON.stringify({..}) in sendReplyNow.");

  const patchedFnBody = fnBody.replace(jsRe, (m, inner) => {
    if (/parent_id\s*:/.test(inner) || /parentId\s*:/.test(inner)) return m;

    const insert = inner.trimEnd() + `,

      // ${markerPage}: nested reply support
      parent_id: replyTo?.id || null
`;
    return `JSON.stringify({${insert}})`;
  });

  page = page.slice(0, fnIdx) + patchedFnBody + page.slice(end + 1);
  page += `\n\n// ${markerPage}\n`;

  fs.writeFileSync(PAGE, page, "utf8");
  console.log("PATCHED:", PAGE);
} else {
  console.log("SKIP:", PAGE, "(already has sd_954 marker)");
}

// -------------------------------
// 3) docs/STATE.md best-effort
// -------------------------------
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_954:** Thread: reply-to-nested enabled (ThreadTree Reply at any depth + client sends parent_id in /api/post/[id]/reply).";
    let t = fs.readFileSync(STATE, "utf8");
    if (!t.includes(mark)) {
      const line = `- ${mark}\n`;
      if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      else t += "\n\n## NEXT overlay\n" + line;
      fs.writeFileSync(STATE, t, "utf8");
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
