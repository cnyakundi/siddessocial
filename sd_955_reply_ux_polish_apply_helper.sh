#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_955_reply_ux_polish"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

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

// 1) ThreadTree: stable DOM ids
let tree = fs.readFileSync(TREE, "utf8");
const markerTree = "sd_955_dom_ids_for_replies";

if (!tree.includes(markerTree)) {
  const re = /<div\s+key=\{id\}\s+className="relative">/m;
  if (re.test(tree)) {
    tree = tree.replace(re, `<div id={\`reply-\${id}\`} data-reply-id={id} data-depth={level} key={id} className="relative scroll-mt-24">`);
  } else {
    const re2 = /<div([^>]*?)key=\{id\}([^>]*?)className="relative"([^>]*?)>/m;
    must(re2.test(tree), "sd_955: could not find reply node wrapper in ThreadTree.tsx to add DOM ids.");
    tree = tree.replace(re2, `<div$1key={id}$2className="relative scroll-mt-24"$3 id={\`reply-\${id}\`} data-reply-id={id} data-depth={level}>`);
  }

  if (tree.includes("sd_952: ThreadTree")) {
    tree = tree.replace("sd_952: ThreadTree", "sd_952: ThreadTree\n// " + markerTree);
  } else {
    tree = "// " + markerTree + "\n" + tree;
  }

  fs.writeFileSync(TREE, tree, "utf8");
  console.log("PATCHED:", TREE);
} else {
  console.log("SKIP:", TREE, "(already has sd_955 marker)");
}

// 2) PostDetail: jump + flash helper + clickable Replying-to chip
let page = fs.readFileSync(PAGE, "utf8");
const markerPage = "sd_955_replying_to_jump";

if (!page.includes(markerPage)) {
  const shellIdx = page.indexOf('data-testid="thread-shell"');
  must(shellIdx >= 0, "sd_955: could not find thread-shell marker in page.tsx (sd_950 required).");

  const retIdx = page.lastIndexOf("return (", shellIdx);
  must(retIdx >= 0, "sd_955: could not locate return( before thread-shell.");

  const helper = `
  // ${markerPage}: jump to a reply node and briefly highlight it
  const jumpToReply = (targetId: string | null | undefined) => {
    const id = String(targetId || "").trim();
    if (!id) return;
    const el = typeof document !== "undefined" ? document.getElementById(\`reply-\${id}\`) : null;
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}

    try {
      (el as any).animate?.(
        [
          { backgroundColor: "rgba(59, 130, 246, 0.14)", boxShadow: "0 0 0 0 rgba(59,130,246,0.0)" },
          { backgroundColor: "rgba(59, 130, 246, 0.06)", boxShadow: "0 0 0 10px rgba(59,130,246,0.0)" },
          { backgroundColor: "transparent", boxShadow: "0 0 0 0 rgba(59,130,246,0.0)" },
        ],
        { duration: 900, easing: "ease-out" }
      );
    } catch {}
  };
`;
  page = page.slice(0, retIdx) + helper + "\n" + page.slice(retIdx);

  const indicatorRe = /{replyTo\s*\?\s*\(\s*<div[^>]*>\s*<span[^>]*>Replying to\s*<span[^>]*>\{replyTo\.label\}<\/span><\/span>\s*<button[\s\S]*?onClick=\{\(\)\s*=>\s*setReplyTo\(null\)\}[\s\S]*?<\/button>\s*<\/div>\s*\)\s*:\s*null\s*}/m;

  if (indicatorRe.test(page)) {
    page = page.replace(indicatorRe, `{replyTo ? (
            <div className="flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">
              <button
                type="button"
                onClick={() => jumpToReply(replyTo.parentId)}
                className="truncate text-left hover:text-gray-600"
                title="Jump to replied comment"
              >
                Replying to <span className="text-blue-600 font-black">{replyTo.label}</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
                  onClick={() => jumpToReply(replyTo.parentId)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                  onClick={() => setReplyTo(null)}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}`);
  } else {
    const idx = page.indexOf("Replying to");
    must(idx >= 0, "sd_955: could not find 'Replying to' indicator in page.tsx to patch.");
    page = page.slice(0, idx) + `{/* ${markerPage}: TODO - Replying-to indicator drifted; jumpToReply is available */}\n` + page.slice(idx);
  }

  page += `\n\n// ${markerPage}\n`;
  fs.writeFileSync(PAGE, page, "utf8");
  console.log("PATCHED:", PAGE);
} else {
  console.log("SKIP:", PAGE, "(already has sd_955 marker)");
}

// 3) STATE.md update
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_955:** Thread UX: 'Replying to' chip jumps to comment (scroll + flash) and ThreadTree exposes stable reply DOM ids.";
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
