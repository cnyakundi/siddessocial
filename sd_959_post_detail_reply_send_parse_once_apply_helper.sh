#!/usr/bin/env bash
set -euo pipefail

NAME="sd_959_post_detail_reply_send_parse_once"
FILE="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Run this from repo root (folder that contains frontend/)."
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

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Find function block by name (arrow or function) and return [startIdx, endIdxInclusive]
function findFunctionRange(source, name) {
  const idxA = source.indexOf(`const ${name}`);
  const idxB = source.search(new RegExp(`\\bfunction\\s+${name}\\b`));
  const start = idxA !== -1 ? idxA : (idxB !== -1 ? idxB : -1);
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

const range = findFunctionRange(src, "sendReplyNow");
must(range, "sd_959: Could not find sendReplyNow() in page.tsx (file drift).");

const [fnStart, fnEnd] = range;
let fn = src.slice(fnStart, fnEnd + 1);

// Find the reply fetch in sendReplyNow
const fetchRe = /const\s+res\s*=\s*await\s+fetch\(`\/api\/post\/\$\{encodeURIComponent\(found\.post\.id\)\}\/reply`/m;
const fPos = fn.search(fetchRe);
must(fPos !== -1, "sd_959: Could not find reply fetch() in sendReplyNow().");

// Indent of the `const res = await fetch...` line
const fLineStart = fn.lastIndexOf("\n", fPos) + 1;
const indent = (fn.slice(fLineStart, fPos).match(/^\s*/) || [""])[0];

// Find end of fetch call (a line containing `${indent}});`)
let closeIdx = fn.indexOf("\n" + indent + "});", fPos);
if (closeIdx === -1) {
  // fallback: first `});` after fetch
  const tail = fn.slice(fPos);
  const m = tail.match(/\n\s*\}\);\s*\n/);
  must(m && typeof m.index === "number", "sd_959: Could not find end of fetch call.");
  closeIdx = fPos + m.index;
}
let afterFetch = fn.indexOf("\n", closeIdx + 1);
afterFetch = afterFetch === -1 ? fn.length : (afterFetch + 1);

// Find the first status handler block (we'll keep everything from there down)
let statusIdx = fn.indexOf("\n" + indent + "if (res.status", afterFetch);
if (statusIdx === -1) {
  const rest = fn.slice(afterFetch);
  const m2 = rest.match(/\n\s*if\s*\(\s*res\.status/);
  must(m2 && typeof m2.index === "number", "sd_959: Could not find `if (res.status...)` block after fetch.");
  statusIdx = afterFetch + m2.index;
}

// Replace whatever parsing/success logic exists between end-of-fetch and first status handler
const newBlock =
`${indent}// sd_959_reply_send_parse_once: response body can only be consumed once.\n` +
`${indent}let data: any = null;\n` +
`${indent}try {\n` +
`${indent}  const txt = await res.text();\n` +
`${indent}  data = txt ? JSON.parse(txt) : null;\n` +
`${indent}} catch {\n` +
`${indent}  data = null;\n` +
`${indent}}\n` +
`${indent}const j = data as any;\n\n` +
`${indent}if (res.ok) {\n` +
`${indent}  if (!j || (j as any).ok !== false) {\n` +
`${indent}    setReplyText(\"\");\n` +
`${indent}    setReplyTo(null);\n` +
`${indent}    setReplyBusy(false);\n` +
`${indent}    toast.success(\"Reply sent.\");\n` +
`${indent}    try {\n` +
`${indent}      window.dispatchEvent(new Event(\`sd.post.replies.changed:\${found.post.id}\`));\n` +
`${indent}    } catch {\n` +
`${indent}      // ignore\n` +
`${indent}    }\n` +
`${indent}    return;\n` +
`${indent}  }\n` +
`${indent}}\n\n` +
`${indent}const code = j && typeof (j as any).error === \"string\" ? String((j as any).error) : \"request_failed\";\n\n`;

fn = fn.slice(0, afterFetch) + newBlock + fn.slice(statusIdx);

// Now: make sure there is NO SECOND read.
// Any remaining res.json() calls inside sendReplyNow become `j`.
fn = fn.replace(/await\s+res\.json\(\)\.catch\(\(\)\s*=>\s*null\)/g, "j");
fn = fn.replace(/await\s+res\.json\(\)/g, "j");

// Kill any leftover helper call from earlier patches (also becomes `j`)
fn = fn.replace(/__sd_read_reply_json_once\s*\([^)]*\)/g, "j");
fn = fn.replace(/__sd_read_reply_json_once\s*\(\s*\)/g, "j");

// Sanity checks
must(!fn.includes("res.json("), "sd_959: sendReplyNow() still contains res.json() after patch.");
must(!fn.includes("__sd_read_reply_json_once"), "sd_959: sendReplyNow() still references __sd_read_reply_json_once after patch.");

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
echo "Smoke test:"
echo "  1) Open /siddes-post/<id>"
echo "  2) Send a normal reply -> should succeed"
echo "  3) Send empty reply -> 'Write something first.'"
echo "  4) If backend returns an error, you should see a stable message (no weird flakiness)"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
