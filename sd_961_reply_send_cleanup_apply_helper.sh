#!/usr/bin/env bash
set -euo pipefail

NAME="sd_961_reply_send_cleanup"
FILE="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Run from repo root (folder that contains frontend/)."
  echo "   Missing: $FILE"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${STAMP}"
mkdir -p "$BK/$(dirname "$FILE")"
cp "$FILE" "$BK/$FILE"

node - <<'NODE'
const fs = require("fs");

const FILE = "frontend/src/app/siddes-post/[id]/page.tsx";
let src = fs.readFileSync(FILE, "utf8");

function must(cond, msg) { if (!cond) throw new Error(msg); }

// Brace-scan function by name
function findFunctionRange(source, name) {
  const idxA = source.indexOf(`const ${name}`);
  const idxB = source.search(new RegExp(`\\bfunction\\s+${name}\\b`));
  const start = idxA !== -1 ? idxA : (idxB !== -1 ? idxB : -1);
  if (start === -1) return null;

  const open = source.indexOf("{", start);
  if (open === -1) return null;

  let depth = 0;
  let inS=false,inD=false,inB=false,inLine=false,inBlock=false,esc=false;

  for (let i=open;i<source.length;i++){
    const c=source[i], n=source[i+1];

    if (inLine){ if(c==="\n") inLine=false; continue; }
    if (inBlock){ if(c==="*"&&n==="/"){ inBlock=false; i++; } continue; }

    if (inS){ if(!esc&&c=="'") inS=false; esc=(!esc&&c==="\\"); continue; }
    if (inD){ if(!esc&&c=='"') inD=false; esc=(!esc&&c==="\\"); continue; }
    if (inB){ if(!esc&&c=="`") inB=false; esc=(!esc&&c==="\\"); continue; }

    if (c==="/"&&n==="/"){ inLine=true; i++; continue; }
    if (c==="/"&&n==="*"){ inBlock=true; i++; continue; }
    if (c=="'"){ inS=true; esc=false; continue; }
    if (c=='"'){ inD=true; esc=false; continue; }
    if (c=="`"){ inB=true; esc=false; continue; }

    if (c==="{") depth++;
    if (c==="}"){
      depth--;
      if(depth===0) return [start,i];
    }
  }
  return null;
}

// Remove the sd_957 helper block if present (prevents hook dependency warnings / signature clashes)
src = src.replace(
  /\/\* sd_957_reply_json_helper:[\s\S]*?\nasync function __sd_read_reply_json_once\([\s\S]*?\n}\n\n/m,
  ""
);

const r = findFunctionRange(src, "sendReplyNow");
must(r, "sd_961: Could not find sendReplyNow() in page.tsx (file drift).");

const [fnStart, fnEnd] = r;
let fn = src.slice(fnStart, fnEnd + 1);

// Remove local sd_955-style helper variables if present
fn = fn.replace(/^\s*let __sd_reply_body_read.*\n/gm, "");
fn = fn.replace(/^\s*let __sd_reply_json.*\n/gm, "");

// Remove local helper function `const __sd_read_reply_json_once = async ... { ... };`
(function removeLocalHelper(){
  const needle = "const __sd_read_reply_json_once";
  const i = fn.indexOf(needle);
  if (i === -1) return;

  const startLine = fn.lastIndexOf("\n", i) + 1;
  const open = fn.indexOf("{", i);
  if (open === -1) return;

  let depth = 0;
  for (let k=open; k<fn.length; k++){
    const c = fn[k];
    if (c === "{") depth++;
    if (c === "}"){
      depth--;
      if (depth === 0){
        // consume trailing `;`
        let end = k + 1;
        while (end < fn.length && fn[end] !== ";") end++;
        if (end < fn.length) end++; // include ;
        // include one newline
        if (fn[end] === "\n") end++;
        fn = fn.slice(0, startLine) + fn.slice(end);
        return;
      }
    }
  }
})();

// Kill lines that redeclare data/j from helper/json (we’ll rely on existing parse or inject one)
fn = fn.replace(/^\s*const\s+data\s*=\s*await\s+__sd_read_reply_json_once[^\n]*\n/gm, "");
fn = fn.replace(/^\s*const\s+j\s*=\s*await\s+__sd_read_reply_json_once[^\n]*\n/gm, "");
fn = fn.replace(/^\s*const\s+data\s*=\s*await\s+res\.json[^\n]*\n/gm, "");
fn = fn.replace(/^\s*const\s+j\s*=\s*await\s+res\.json[^\n]*\n/gm, "");

// Decide whether we need to inject a single parse block
const hasParseMarker = fn.includes("sd_959_reply_send_parse_once") || fn.includes("sd_961_reply_body_once");
const hasResText = /await\s+res\.text\(\)/.test(fn);
let hasDataDecl = /\b(let|const)\s+data\b/.test(fn);
let hasJDecl = /\b(let|const)\s+j\b/.test(fn);

// If we don't already parse the body AND we don't already have data/j, inject right after the reply fetch.
if (!hasParseMarker && !hasResText && (!hasDataDecl || !hasJDecl)) {
  const fetchNeedle = "const res = await fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`";
  const fPos = fn.indexOf(fetchNeedle);
  must(fPos !== -1, "sd_961: Could not find reply fetch() inside sendReplyNow().");

  const lineStart = fn.lastIndexOf("\n", fPos) + 1;
  const indent = (fn.slice(lineStart, fPos).match(/^\s*/) || [""])[0];

  // Find end of fetch call (first `});` after it)
  const tail = fn.slice(fPos);
  const m = tail.match(/\n\s*\}\);\s*\n/);
  must(m && typeof m.index === "number", "sd_961: Could not locate end of fetch() call.");
  const insertAt = fPos + m.index + m[0].length;

  const parseBlock =
`${indent}// sd_961_reply_body_once: read response body once and reuse it.\n` +
`${indent}let __sd_reply_txt = "";\n` +
`${indent}try {\n` +
`${indent}  __sd_reply_txt = await res.text();\n` +
`${indent}} catch {\n` +
`${indent}  __sd_reply_txt = "";\n` +
`${indent}}\n` +
`${indent}let data: any = null;\n` +
`${indent}try {\n` +
`${indent}  data = __sd_reply_txt ? JSON.parse(__sd_reply_txt) : null;\n` +
`${indent}} catch {\n` +
`${indent}  data = null;\n` +
`${indent}}\n` +
`${indent}const j = data as any;\n\n`;

  fn = fn.slice(0, insertAt) + parseBlock + fn.slice(insertAt);

  hasDataDecl = true;
  hasJDecl = true;
}

// Replace any leftover helper call usages with `j` (or `data` as fallback)
const repl = hasJDecl ? "j" : (hasDataDecl ? "data" : "null");
fn = fn.replace(/__sd_read_reply_json_once\s*\([^)]*\)/g, repl);
fn = fn.replace(/__sd_read_reply_json_once\s*\(\s*\)/g, repl);

// Replace any leftover direct json parsing expressions (prevents double-consume)
fn = fn.replace(/await\s+res\.json\(\)\.catch\(\(\)\s*=>\s*null\)/g, hasDataDecl ? "data" : repl);
fn = fn.replace(/await\s+res\.json\(\)/g, hasDataDecl ? "data" : repl);

// Final sanity: no helper name remains
must(!fn.includes("__sd_read_reply_json_once"), "sd_961: __sd_read_reply_json_once still present after cleanup.");

src = src.slice(0, fnStart) + fn + src.slice(fnEnd + 1);
fs.writeFileSync(FILE, src, "utf8");
console.log("OK: patched", FILE);
NODE

echo ""
echo "✅ $NAME applied."
echo "Backup saved to: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  npm run build"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
