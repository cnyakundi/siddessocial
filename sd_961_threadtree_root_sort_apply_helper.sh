#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_961_threadtree_root_sort"
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
TREE="frontend/src/components/thread/ThreadTree.tsx"
STATE="docs/STATE.md"

[[ -f "$PAGE" ]] || { echo "❌ Missing: $PAGE"; exit 1; }
[[ -f "$TREE" ]] || { echo "❌ Missing: $TREE"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node is required."; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$PAGE")" "$BK/$(dirname "$TREE")" "$BK/$(dirname "$STATE")"
cp -a "$PAGE" "$BK/$PAGE"
cp -a "$TREE" "$BK/$TREE"
cp -a "$STATE" "$BK/$STATE" 2>/dev/null || true

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const TREE = "frontend/src/components/thread/ThreadTree.tsx";
const STATE = "docs/STATE.md";

const MARK = "sd_961_threadtree_root_sort";

function must(cond, msg) { if (!cond) throw new Error(msg); }

function removeFunctionBlock(src, name) {
  const idx = src.indexOf(`function ${name}(`);
  if (idx < 0) return { out: src, removed: false };

  // brace scan from first '{' after signature
  const open = src.indexOf("{", idx);
  if (open < 0) return { out: src, removed: false };

  let depth = 0;
  let inS=false, inD=false, inB=false, inLine=false, inBlock=false;
  let esc=false;

  for (let i = open; i < src.length; i++) {
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

    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) {
        // remove trailing newline if present
        const end = i + 1;
        const before = src.slice(0, idx);
        let after = src.slice(end);
        // remove one extra newline
        if (after.startsWith("\n")) after = after.slice(1);
        return { out: before + after, removed: true };
      }
    }
  }
  return { out: src, removed: false };
}

// -------------------------
// 1) Patch ThreadTree: accept sortMode and sort ROOTS only
// -------------------------
let t = fs.readFileSync(TREE, "utf8");
if (!t.includes(MARK)) {
  // Add sortMode prop in destructuring
  if (!t.includes("sortMode")) {
    // Insert into destructuring after onReplyTo
    t = t.replace(/onReplyTo,\s*\}\s*:\s*\{/m, 'onReplyTo,\n  sortMode,\n}: {');
  }

  // Add sortMode type
  if (!t.includes('sortMode?: "top" | "newest"')) {
    t = t.replace(/onReplyTo\?:\s*\(parentId:\s*string,\s*label:\s*string\)\s*=>\s*void;\s*\n\}/m,
      'onReplyTo?: (parentId: string, label: string) => void;\n  sortMode?: "top" | "newest";\n}');
  }

  // Insert roots sorting after tree is built
  const treeNeedle = "const tree = useMemo(() => buildTree(replies || []), [replies]);";
  must(t.includes(treeNeedle), "sd_961: could not find tree useMemo line in ThreadTree.tsx (file drift).");

  const rootsSortBlock = `
  // ${MARK}: sort root-level replies only; keep nested replies chronological.
  const roots = useMemo(() => {
    const arr = [...(tree.roots || [])];
    const getLike = (r: any) => Number(r?.likeCount ?? r?.likes ?? 0);
    const getCreated = (r: any) => Number(r?.createdAt ?? 0);
    const getId = (r: any) => String(r?.id ?? "");

    if (sortMode === "newest") {
      arr.sort((a: any, b: any) => {
        const aa = getCreated(a);
        const bb = getCreated(b);
        if (bb !== aa) return bb - aa;
        return getId(a).localeCompare(getId(b));
      });
      return arr;
    }

    if (sortMode === "top") {
      arr.sort((a: any, b: any) => {
        const la = getLike(a);
        const lb = getLike(b);
        if (lb !== la) return lb - la;
        const aa = getCreated(a);
        const bb = getCreated(b);
        if (aa !== bb) return aa - bb;
        return getId(a).localeCompare(getId(b));
      });
      return arr;
    }

    return arr;
  }, [tree, sortMode]);
`;
  t = t.replace(treeNeedle, treeNeedle + "\n" + rootsSortBlock);

  // Use roots in render
  t = t.replace("{tree.roots.map((r) => renderNode(r, 0))}", "{roots.map((r) => renderNode(r, 0))}");

  // Marker
  t = `// ${MARK}\n` + t;

  fs.writeFileSync(TREE, t, "utf8");
  console.log("PATCHED:", TREE);
} else {
  console.log("NOOP:", TREE, "(already patched)");
}

// -------------------------
// 2) Patch PostDetail page: pass sortMode to ThreadTree + remove old list-sorting helper
// -------------------------
let p = fs.readFileSync(PAGE, "utf8");

// Stop sorting the flat list before ThreadTree sees it
p = p.replace(/setReplies\(sortReplies\(rs,\s*sortMode\)\);\s*/g, "setReplies(rs);\n");

// Remove sortReplies helper if present (to avoid unused-vars lint)
const removed = removeFunctionBlock(p, "sortReplies");
p = removed.out;

// Pass sortMode prop into ThreadTree
if (p.includes("<ThreadTree") && !p.includes("sortMode={sortMode}")) {
  // replace the specific call in SentReplies
  p = p.replace(/<ThreadTree\s+replies=\{replies\}\s+viewerId=\{viewerId\}\s+onReplyTo=\{onReplyTo\}\s*\/>/m,
    `<ThreadTree replies={replies} viewerId={viewerId} onReplyTo={onReplyTo} sortMode={sortMode} />`);
  // fallback: insert before />
  p = p.replace(/<ThreadTree([^>]*?)\/>/m, (m) => {
    if (m.includes("sortMode=")) return m;
    return m.replace("/>", ' sortMode={sortMode} />');
  });
}

// Ensure ThreadTree import isn't broken (no change needed)
fs.writeFileSync(PAGE, p, "utf8");
console.log("PATCHED:", PAGE);

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_961:** Thread sorting: move Top/Newest to ThreadTree root-level sorting (do not reorder nested replies); SentReplies passes sortMode and stops list-wide sorting.";
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
