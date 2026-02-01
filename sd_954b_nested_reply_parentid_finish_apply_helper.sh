#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_954b_nested_reply_parentid_finish"
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
ROUTE="frontend/src/app/api/post/[id]/reply/route.ts"
TREE="frontend/src/components/thread/ThreadTree.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$PAGE" ]]; then
  echo "❌ Missing: $PAGE"
  exit 1
fi
if [[ ! -f "$ROUTE" ]]; then
  echo "❌ Missing: $ROUTE"
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
backup_one "$ROUTE"
backup_one "$TREE"
backup_one "$STATE"

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const ROUTE = "frontend/src/app/api/post/[id]/reply/route.ts";
const TREE = "frontend/src/components/thread/ThreadTree.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }

// -------- helpers --------
function findFunctionRange(source, name) {
  const reConst = new RegExp(`\\bconst\\s+${name}\\b`);
  const reFn = new RegExp(`\\bfunction\\s+${name}\\b`);
  const mA = reConst.exec(source);
  const mB = reFn.exec(source);
  const start = mA ? mA.index : (mB ? mB.index : -1);
  if (start === -1) return null;

  const open = source.indexOf("{", start);
  if (open === -1) return null;

  let depth = 0;
  let inS = false, inD = false, inB = false, inLine = false, inBlock = false;
  let esc = false;

  for (let i = open; i < source.length; i++) {
    const c = source[i];
    const n = source[i + 1];

    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }

    if (inS) { if (!esc && c === "'") inS = false; esc = (!esc && c === "\\"); continue; }
    if (inD) { if (!esc && c === '"') inD = false; esc = (!esc && c === "\\"); continue; }
    if (inB) { if (!esc && c === "`") inB = false; esc = (!esc && c === "\\"); continue; }

    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    if (c === "'") { inS = true; esc = false; continue; }
    if (c === '"') { inD = true; esc = false; continue; }
    if (c === "`") { inB = true; esc = false; continue; }

    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return [start, i];
    }
  }
  return null;
}

function patchJsonStringifyObject(src, openBraceIdx, closeBraceIdx, insertExpr) {
  let inner = src.slice(openBraceIdx + 1, closeBraceIdx);
  if (/parent_id\s*:|parentId\s*:/.test(inner)) return { out: src, changed: false };

  const trimmed = inner.trimEnd();
  const needsComma = trimmed.length > 0 && !trimmed.endsWith(",");
  const insertion = (needsComma ? ", " : " ") + insertExpr;

  const outInner = inner + insertion;
  const out = src.slice(0, openBraceIdx + 1) + outInner + src.slice(closeBraceIdx);
  return { out, changed: true };
}

function patchReplyBodyInBlock(block, replyVarExpr) {
  const replyIdx = block.search(/\/api\/post\/[^`"' ]*\/reply|\/reply/);
  if (replyIdx === -1) return { out: block, changed: false };

  const fetchIdx = block.lastIndexOf("fetch(", replyIdx);
  if (fetchIdx === -1) return { out: block, changed: false };

  const window = block.slice(fetchIdx, Math.min(block.length, fetchIdx + 4000));
  const bodyIdx = window.indexOf("body:");
  if (bodyIdx === -1) return { out: block, changed: false };

  const jsIdx = window.indexOf("JSON.stringify", bodyIdx);
  if (jsIdx === -1) return { out: block, changed: false };

  const openObj = window.indexOf("{", jsIdx);
  if (openObj === -1) return { out: block, changed: false };

  let depth = 0;
  let endObj = -1;
  let inS = false, inD = false, inB = false, inLine = false, inBlock = false;
  let esc = false;

  for (let i = openObj; i < window.length; i++) {
    const c = window[i];
    const n = window[i + 1];

    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }

    if (inS) { if (!esc && c === "'") inS = false; esc = (!esc && c === "\\"); continue; }
    if (inD) { if (!esc && c === '"') inD = false; esc = (!esc && c === "\\"); continue; }
    if (inB) { if (!esc && c === "`") inB = false; esc = (!esc && c === "\\"); continue; }

    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    if (c === "'") { inS = true; esc = false; continue; }
    if (c === '"') { inD = true; esc = false; continue; }
    if (c === "`") { inB = true; esc = false; continue; }

    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) { endObj = i; break; }
    }
  }
  if (endObj === -1) return { out: block, changed: false };

  const absOpen = fetchIdx + openObj;
  const absClose = fetchIdx + endObj;

  const objInner = block.slice(absOpen + 1, absClose);
  if (!/text/.test(objInner) || !/client_key/.test(objInner)) return { out: block, changed: false };

  const insertExpr = `parent_id: ${replyVarExpr}?.id || null`;
  return patchJsonStringifyObject(block, absOpen, absClose, insertExpr);
}

// -------------------------------
// 1) Patch Post Detail page.tsx to send parent_id
// -------------------------------
let src = fs.readFileSync(PAGE, "utf8");
const markerPage = "sd_954b_parent_id_in_post_detail";
if (!src.includes(markerPage)) {
  let replyVar = "replyTo";
  const mState = src.match(/const\s*\[\s*([A-Za-z0-9_]+)\s*,\s*setReplyTo\s*\]\s*=\s*useState/);
  if (mState && mState[1]) replyVar = mState[1];

  let range = findFunctionRange(src, "sendReplyNow");
  let fnName = "sendReplyNow";
  if (!range) {
    for (const n of ["sendReply", "sendReplyAsync", "submitReply"]) {
      range = findFunctionRange(src, n);
      if (range) { fnName = n; break; }
    }
  }

  if (range) {
    const [fnStart, fnEnd] = range;
    let fn = src.slice(fnStart, fnEnd + 1);

    const patched = patchReplyBodyInBlock(fn, replyVar);
    must(patched.changed, `sd_954b: could not patch reply payload inside ${fnName}() (no matching JSON.stringify body found).`);
    fn = patched.out + `\n// ${markerPage}\n`;
    src = src.slice(0, fnStart) + fn + src.slice(fnEnd + 1);
    fs.writeFileSync(PAGE, src, "utf8");
    console.log("PATCHED:", PAGE, `(parent_id wired in ${fnName} using ${replyVar})`);
  } else {
    const patched = patchReplyBodyInBlock(src, "replyTo");
    must(patched.changed, "sd_954b: could not find reply fetch body to patch in page.tsx (file drift).");
    src = patched.out + `\n\n// ${markerPage}\n`;
    fs.writeFileSync(PAGE, src, "utf8");
    console.log("PATCHED:", PAGE, "(global fallback)");
  }
} else {
  console.log("SKIP:", PAGE, "(already patched)");
}

// -------------------------------
// 2) Patch Next API route to forward parent_id to Django proxy
// -------------------------------
let rt = fs.readFileSync(ROUTE, "utf8");
const markerRoute = "sd_954b_forward_parent_id";
if (!rt.includes(markerRoute)) {
  // Insert parentId extraction after clientKey line (best effort)
  if (!/\bconst\s+parentId\b/.test(rt)) {
    const ckRe = /(const\s+clientKey\s*=\s*[^;\n]+;[ \t]*\n)/m;
    if (ckRe.test(rt)) {
      rt = rt.replace(ckRe, (m) => (
        m + `\n  // ${markerRoute}: allow nested replies\n  const parentId = String((body as any)?.parentId || (body as any)?.parent_id || "").trim() || null;\n`
      ));
    }
  }

  // Add parent_id to proxy payload
  if (rt.includes("JSON.stringify({ text, client_key: clientKey") && !rt.includes("parent_id:")) {
    rt = rt.replace(
      /JSON\.stringify\(\{\s*text\s*,\s*client_key\s*:\s*clientKey\s*\}\)/g,
      'JSON.stringify({ text, client_key: clientKey, parent_id: parentId })'
    );
  } else {
    const idx = rt.indexOf("JSON.stringify({");
    if (idx !== -1) {
      const open = rt.indexOf("{", idx);
      let depth = 0, end = -1;
      for (let i = open; i < rt.length; i++) {
        const c = rt[i];
        if (c === "{") depth++;
        if (c === "}") {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end !== -1) {
        const inner = rt.slice(open + 1, end);
        if (inner.includes("client_key") && inner.includes("clientKey") && !inner.includes("parent_id")) {
          const insert = inner.trimEnd().endsWith(",") ? " parent_id: parentId" : ", parent_id: parentId";
          rt = rt.slice(0, open + 1) + inner + insert + rt.slice(end);
        }
      }
    }
  }

  rt += `\n\n// ${markerRoute}\n`;
  fs.writeFileSync(ROUTE, rt, "utf8");
  console.log("PATCHED:", ROUTE);
} else {
  console.log("SKIP:", ROUTE, "(already patched)");
}

// -------------------------------
// 3) docs/STATE.md best-effort update
// -------------------------------
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_954:** Thread: reply-to-nested enabled (ThreadTree Reply at any depth + PostDetail sends parent_id + Next /api/post/[id]/reply forwards parent_id).";
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
