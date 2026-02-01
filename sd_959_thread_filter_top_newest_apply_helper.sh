#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_959_thread_filter_top_newest"
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

PAGE="frontend/src/app/siddes-post/[id]/page.tsx"
STATE="docs/STATE.md"

[[ -f "$PAGE" ]] || { echo "❌ Missing: $PAGE"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node is required."; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$PAGE")" "$BK/$(dirname "$STATE")"
cp -a "$PAGE" "$BK/$PAGE"
cp -a "$STATE" "$BK/$STATE" 2>/dev/null || true

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

let s = fs.readFileSync(PAGE, "utf8");

// -----------------------------------------
// sd_959: Top/Newest filter for thread replies
// - Top: sort by likeCount desc, then createdAt asc
// - Newest: createdAt desc
// Keep stable ordering.
// -----------------------------------------
const MARK = "sd_959_thread_filter";
if (!s.includes(MARK)) {
  // 1) Add sortMode state inside SentReplies (after viewerId state)
  const reViewer = /(\s*const\s*\[\s*viewerId\s*,\s*setViewerId\s*\]\s*=\s*useState<[^>]*>\(null\);\s*)/m;
  const m = s.match(reViewer);
  must(m && m[1], "sd_959: could not find viewerId state line inside SentReplies.");

  const indent = (m[1].match(/^\s*/) || [""])[0];
  const insertState = `${m[1]}\n${indent}const [sortMode, setSortMode] = useState<"top" | "newest">("top"); // ${MARK}\n`;
  s = s.replace(m[1], insertState);

  // 2) Add helper to sort replies list (after flattenReplies helper if present, else after state)
  const helperNeedle = "function flattenReplies";
  const helperIdx = s.indexOf(helperNeedle);
  const anchorIdx = helperIdx >= 0 ? helperIdx : s.indexOf("const [sortMode");
  must(anchorIdx >= 0, "sd_959: could not locate insertion region for sort helper.");

  // Insert sort helper just after flattenReplies function (find its closing brace), else after sortMode state line
  if (helperIdx >= 0) {
    const endFn = s.indexOf("}\n", helperIdx); // first close brace line (good enough because helper is local and ends with })
    // better scan: find the last line `return out as StoredReply[];` then next `}`
    const lastReturn = s.indexOf("return out as StoredReply[]", helperIdx);
    if (lastReturn >= 0) {
      const close = s.indexOf("}", lastReturn);
      if (close >= 0) {
        const insertAt = close + 1;
        const sortHelper = `

${indent}function sortReplies(list: StoredReply[], mode: "top" | "newest"): StoredReply[] {
${indent}  const arr = [...(list || [])];
${indent}  if (mode === "newest") {
${indent}    arr.sort((a, b) => {
${indent}      const aa = Number((a as any)?.createdAt || 0);
${indent}      const bb = Number((b as any)?.createdAt || 0);
${indent}      if (bb !== aa) return bb - aa;
${indent}      return String((a as any)?.id || "").localeCompare(String((b as any)?.id || ""));
${indent}    });
${indent}    return arr;
${indent}  }
${indent}
${indent}  // "top"
${indent}  arr.sort((a, b) => {
${indent}    const la = Number((a as any)?.likeCount || 0);
${indent}    const lb = Number((b as any)?.likeCount || 0);
${indent}    if (lb !== la) return lb - la;
${indent}    const aa = Number((a as any)?.createdAt || 0);
${indent}    const bb = Number((b as any)?.createdAt || 0);
${indent}    if (aa !== bb) return aa - bb;
${indent}    return String((a as any)?.id || "").localeCompare(String((b as any)?.id || ""));
${indent}  });
${indent}  return arr;
${indent}}
`;
        s = s.slice(0, insertAt) + sortHelper + s.slice(insertAt);
      }
    }
  } else {
    // Insert after sortMode line
    const sortModeLine = `${indent}const [sortMode, setSortMode] = useState<"top" | "newest">("top"); // ${MARK}`;
    if (s.includes(sortModeLine)) {
      const insertAt = s.indexOf(sortModeLine) + sortModeLine.length;
      const sortHelper = `

${indent}function sortReplies(list: StoredReply[], mode: "top" | "newest"): StoredReply[] {
${indent}  const arr = [...(list || [])];
${indent}  if (mode === "newest") {
${indent}    arr.sort((a, b) => Number((b as any)?.createdAt || 0) - Number((a as any)?.createdAt || 0));
${indent}    return arr;
${indent}  }
${indent}  arr.sort((a, b) => Number((b as any)?.likeCount || 0) - Number((a as any)?.likeCount || 0));
${indent}  return arr;
${indent}}
`;
      s = s.slice(0, insertAt) + sortHelper + s.slice(insertAt);
    }
  }

  // 3) Apply sorting where we setReplies(rs)
  // Replace setReplies(rs); with setReplies(sortReplies(rs, sortMode));
  s = s.replace(/setReplies\(rs\);\s*/g, `setReplies(sortReplies(rs, sortMode));\n`);

  // 4) Add UI filter button near "Replies" header
  // Find the header block label "Replies"
  const headerNeedle = `Replies</div>`;
  const hdrIdx = s.indexOf(headerNeedle);
  if (hdrIdx >= 0) {
    // Find the surrounding header row container and insert a toggle button.
    // We'll add a small button after the Replies label.
    s = s.replace(
      /(<div className="flex items-center justify-between">\s*<div className="text-sm font-extrabold text-gray-900">Replies<\/div>)(\s*<\/div>)/m,
      `$1
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortMode((m) => (m === "top" ? "newest" : "top"))}
            className={cn(
              "px-3 py-1.5 rounded-full border text-[11px] font-extrabold",
              sortMode === "top" ? "bg-gray-50 border-gray-200 text-gray-800" : "bg-blue-50 border-blue-200 text-blue-800"
            )}
            title="Toggle reply sort"
          >
            {sortMode === "top" ? "Top" : "Newest"}
          </button>
        </div>
      $2`
    );
  } else {
    // If header drifted, add marker comment so we know to adjust later
    s += `\n\n// ${MARK}: TODO header insertion drifted; add Top/Newest toggle near Replies header.\n`;
  }

  fs.writeFileSync(PAGE, s, "utf8");
  console.log("PATCHED:", PAGE);

  // docs/STATE.md best-effort
  try {
    if (fs.existsSync(STATE)) {
      const mark = "**sd_959:** Thread UI: add Top/Newest filter for replies in PostDetail (stable sort; default Top).";
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
} else {
  console.log("NOOP:", PAGE, "(already has sd_959 marker)");
}
NODE

echo ""
echo "== Quick sanity =="
git diff --stat || true
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
