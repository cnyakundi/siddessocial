#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_958_frontend_consume_tree_replies"
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

if [[ ! -f "$PAGE" ]]; then
  echo "❌ Missing: $PAGE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required (used for safe patching)."
  exit 1
fi

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

// 1) Fetch replies as tree (backend sd_957) but keep fallback if backend ignores query.
const fetchNeedle = "fetch(`/api/post/${encodeURIComponent(postId)}/replies`";
if (s.includes(fetchNeedle) && !s.includes("replies?tree=1")) {
  s = s.replace(fetchNeedle, "fetch(`/api/post/${encodeURIComponent(postId)}/replies?tree=1`");
}

// 2) Insert tree->flat normalizer inside SentReplies (idempotent).
const MARK_HELPER = "sd_958_tree_flatten_helper";
if (!s.includes(MARK_HELPER)) {
  // Anchor after viewerId state line inside SentReplies
  const re = /(\s*const\s*\[\s*viewerId\s*,\s*setViewerId\s*\]\s*=\s*useState<[^>]*>\(null\);\s*)/m;
  const m = s.match(re);
  must(m && m[1], "sd_958: could not find viewerId state line inside SentReplies.");

  const indent = (m[1].match(/^\s*/) || [""])[0];

  const helper = `
${indent}// ${MARK_HELPER}: accept backend tree replies (?tree=1) OR flat replies and produce a flat list with depth.
${indent}function flattenReplies(raw: any[]): StoredReply[] {
${indent}  const arr = Array.isArray(raw) ? raw : [];
${indent}  if (!arr.length) return [];
${indent}
${indent}  const hasNested = arr.some((x) => x && Array.isArray((x as any).replies));
${indent}  let roots: any[] = arr;
${indent}
${indent}  // If backend didn't send a tree, build one from parentId.
${indent}  if (!hasNested) {
${indent}    const byId: Record<string, any> = {};
${indent}    const nodes: any[] = [];
${indent}    for (const x of arr) {
${indent}      if (!x || typeof x !== "object") continue;
${indent}      const id = String((x as any).id || "").trim();
${indent}      const n = { ...(x as any), replies: [] as any[] };
${indent}      if (id) byId[id] = n;
${indent}      nodes.push(n);
${indent}    }
${indent}    const rs: any[] = [];
${indent}    for (const n of nodes) {
${indent}      const pid = String((n as any).parentId || "").trim();
${indent}      const id = String((n as any).id || "").trim();
${indent}      if (pid && byId[pid] && pid !== id) {
${indent}        byId[pid].replies.push(n);
${indent}      } else {
${indent}        rs.push(n);
${indent}      }
${indent}    }
${indent}    roots = rs;
${indent}  }
${indent}
${indent}  // Sort children by createdAt (stable-ish).
${indent}  const sortTree = (n: any) => {
${indent}    try {
${indent}      const kids = Array.isArray(n?.replies) ? [...n.replies] : [];
${indent}      kids.sort((a, b) => {
${indent}        const aa = Number((a as any)?.createdAt || 0);
${indent}        const bb = Number((b as any)?.createdAt || 0);
${indent}        return aa - bb;
${indent}      });
${indent}      n.replies = kids;
${indent}      for (const c of kids) sortTree(c);
${indent}    } catch {}
${indent}  };
${indent}  for (const r of roots) sortTree(r);
${indent}
${indent}  const out: any[] = [];
${indent}  const walk = (nodes: any[], depth: number) => {
${indent}    for (const node of nodes) {
${indent}      if (!node || typeof node !== "object") continue;
${indent}      const n = { ...(node as any), depth };
${indent}      out.push(n);
${indent}      const kids = Array.isArray((node as any).replies) ? (node as any).replies : [];
${indent}      if (kids.length) walk(kids, depth + 1);
${indent}    }
${indent}  };
${indent}  walk(roots, 0);
${indent}  return out as StoredReply[];
${indent}}
`;

  s = s.replace(m[1], m[1] + helper);
}

// 3) Use flattenReplies(data.replies) and prefer flatCount from backend.
const MARK_PARSE = "sd_958_tree_consume";
if (!s.includes(MARK_PARSE)) {
  // Replace the simple rs assignment in SentReplies refresh
  const reRs = /const\s+rs\s*=\s*\(\(data\.replies\s*\|\|\s*\[\]\)\s+as\s+StoredReply\[\]\);\s*\n\s*setReplies\(rs\);\s*/m;
  if (reRs.test(s)) {
    s = s.replace(reRs, `// ${MARK_PARSE}: consume tree replies (or flat) and keep existing UI.\n      const rs = flattenReplies((data as any)?.replies || []);\n      setReplies(rs);\n`);
  } else {
    // Fallback: patch line-by-line if formatting drifted
    s = s.replace(/const\s+rs\s*=\s*\(\(data\.replies\s*\|\|\s*\[\]\)\s+as\s+StoredReply\[\]\);\s*/m, `// ${MARK_PARSE}: consume tree replies (or flat) and keep existing UI.\n      const rs = flattenReplies((data as any)?.replies || []);\n`);
  }

  // Update count change block
  s = s.replace(/onCountChange\?\.\(rs\.length\);/g, `onCountChange?.(typeof (data as any)?.flatCount === "number" ? Number((data as any).flatCount) : rs.length);`);
}

// 4) Allow replying at any depth (remove depth===0 gate)
const MARK_REPLY_ANY = "sd_958_reply_any_depth";
if (!s.includes(MARK_REPLY_ANY)) {
  // Remove old "no nested reply" comments
  s = s.replace(/^\s*\{\s*\/\*\s*sd_924_no_nested_reply_action[\s\S]*?\*\/\s*\}\s*$/gm, "");
  s = s.replace(/^\s*\{\s*\/\*\s*sd_927_no_nested_reply_action[\s\S]*?\*\/\s*\}\s*$/gm, "");
  s = s.replace(/^\s*\/\*\s*sd_924_no_nested_reply_action[\s\S]*?\*\/\s*$/gm, "");
  s = s.replace(/^\s*\/\*\s*sd_927_no_nested_reply_action[\s\S]*?\*\/\s*$/gm, "");

  // Replace {depth === 0 ? ( ... ) : null} with just the inner block.
  const reGate = /\{depth\s*===\s*0\s*\?\s*\(\s*([\s\S]*?)\s*\)\s*:\s*null\s*\}/m;
  if (reGate.test(s)) {
    s = s.replace(reGate, `$1\n\n                      {/* ${MARK_REPLY_ANY} */}`);
  } else {
    // If already removed, still add marker near onReplyTo button
    s = s.replace(/onClick=\{\(\)\s*=>\s*onReplyTo\?\.\(r\.id,\s*name\)\}/m, (m) => m + ` /* ${MARK_REPLY_ANY} */`);
  }
}

// Write back
fs.writeFileSync(PAGE, s, "utf8");
console.log("PATCHED:", PAGE);

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_958:** Frontend: consume replies tree (`?tree=1`) and flatten to depth-labeled list; allow replying at any depth (backend-enforced).";
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
