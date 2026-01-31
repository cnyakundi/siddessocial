#!/usr/bin/env bash
set -euo pipefail

NAME="sd_957_fix_reply_json_helper"
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

// Find function block by name (arrow or function) and return [startIdx, endIdx]
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

let range = findFunctionRange(src, "sendReplyNow");
must(range, "Could not find sendReplyNow() in this file (file drift).");

let [fnStart] = range;

// 1) Insert global helper once (above sendReplyNow)
if (!src.includes("sd_957_reply_json_helper")) {
  const helper = `
/* sd_957_reply_json_helper: Response body can only be consumed once — cache it safely. */
const __sd_reply_json_cache = new WeakMap<Response, any>();
async function __sd_read_reply_json_once(res: Response): Promise<any> {
  if (__sd_reply_json_cache.has(res)) return __sd_reply_json_cache.get(res);
  let j: any = null;
  try {
    const txt = await res.text();
    j = txt ? JSON.parse(txt) : null;
  } catch {
    j = null;
  }
  __sd_reply_json_cache.set(res, j);
  return j;
}

`;
  src = src.slice(0, fnStart) + helper + src.slice(fnStart);
}

// 2) Patch call sites inside sendReplyNow: __sd_read_reply_json_once() -> __sd_read_reply_json_once(res)
range = findFunctionRange(src, "sendReplyNow");
must(range, "Could not re-find sendReplyNow() after insertion.");
const [newStart, newEnd] = range;

let fn = src.slice(newStart, newEnd + 1);

const hadBareCall = /__sd_read_reply_json_once\s*\(\s*\)/.test(fn);
fn = fn.replace(/__sd_read_reply_json_once\s*\(\s*\)/g, "__sd_read_reply_json_once(res)");

must(!/__sd_read_reply_json_once\s*\(\s*\)/.test(fn), "sendReplyNow(): bare __sd_read_reply_json_once() still present after patch.");
must(hadBareCall || fn.includes("__sd_read_reply_json_once(res)"), "sendReplyNow(): expected call not found (maybe already fixed).");

src = src.slice(0, newStart) + fn + src.slice(newEnd + 1);

fs.writeFileSync(FILE, src, "utf8");
console.log("OK: patched", FILE);
NODE

echo ""
echo "✅ $NAME applied."
echo "Backup saved to: $BK"
echo ""
echo "Next (run these):"
echo "  cd frontend && npm run typecheck"
echo "  npm run build"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
