#!/usr/bin/env bash
set -euo pipefail

NAME="sd_955_post_detail_reply_json_once"
FILE="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Run this from your repo root (folder that contains frontend/)."
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

// Find a function block by name (arrow or function) and return [startIdx, endIdxInclusive]
function findFunctionRange(name) {
  const idxA = src.indexOf(`const ${name}`);
  const idxB = src.search(new RegExp(`\\bfunction\\s+${name}\\b`));
  const start = idxA !== -1 ? idxA : (idxB !== -1 ? idxB : -1);
  if (start === -1) return null;

  const open = src.indexOf("{", start);
  if (open === -1) return null;

  // Brace scan (ignores braces inside strings + comments; treats template literals as strings)
  let depth = 0;
  let inS = false, inD = false, inB = false, inLine = false, inBlock = false;
  let esc = false;

  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];

    if (inLine) {
      if (c === "\n") inLine = false;
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") { inBlock = false; i++; }
      continue;
    }
    if (inS) {
      if (!esc && c === "'") inS = false;
      esc = (!esc && c === "\\");
      continue;
    }
    if (inD) {
      if (!esc && c === '"') inD = false;
      esc = (!esc && c === "\\");
      continue;
    }
    if (inB) {
      if (!esc && c === "`") inB = false;
      esc = (!esc && c === "\\");
      continue;
    }

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

const range = findFunctionRange("sendReplyNow");
must(range, "Could not find sendReplyNow() in page.tsx (file drift).");

const [fnStart, fnEnd] = range;
let fn = src.slice(fnStart, fnEnd + 1);

if (fn.includes("sd_955_reply_json_once")) {
  console.log("Already patched (sd_955 marker found).");
  process.exit(0);
}

const jsonCalls = (fn.match(/\bres\.json\(\)/g) || []).length;
if (jsonCalls <= 1) {
  console.log("No duplicate res.json() calls detected inside sendReplyNow() — skipping.");
  process.exit(0);
}

// Find first occurrence of res.json() (or await res.json()) to insert helper right before it
const firstJsonIdx = fn.search(/\bres\.json\(\)/);
must(firstJsonIdx !== -1, "sendReplyNow() has no res.json() calls unexpectedly.");

// Find indentation of that line
const lineStart = fn.lastIndexOf("\n", firstJsonIdx);
const line = fn.slice(lineStart + 1, firstJsonIdx);
const indent = (line.match(/^\s*/) || [""])[0];

const helper =
`\n${indent}// sd_955_reply_json_once: Response body can only be read once — cache it.\n` +
`${indent}let __sd_reply_body_read = false;\n` +
`${indent}let __sd_reply_json: any = null;\n` +
`${indent}const __sd_read_reply_json_once = async (): Promise<any> => {\n` +
`${indent}  if (__sd_reply_body_read) return __sd_reply_json;\n` +
`${indent}  __sd_reply_body_read = true;\n` +
`${indent}  try {\n` +
`${indent}    const txt = await res.text();\n` +
`${indent}    __sd_reply_json = txt ? JSON.parse(txt) : null;\n` +
`${indent}  } catch {\n` +
`${indent}    __sd_reply_json = null;\n` +
`${indent}  }\n` +
`${indent}  return __sd_reply_json;\n` +
`${indent}};\n\n`;

// Insert helper before first json call
fn = fn.slice(0, lineStart + 1) + helper + fn.slice(lineStart + 1);

// Replace json reads with the cached reader (covers both `await res.json()` and `await res.json().catch(...)`)
fn = fn.replace(/await\s+res\.json\(\)\.catch\(\(\)\s*=>\s*null\)/g, "await __sd_read_reply_json_once()");
fn = fn.replace(/await\s+res\.json\(\)/g, "await __sd_read_reply_json_once()");

// Also handle `(await res.json().catch(() => null))` patterns
fn = fn.replace(/\(\s*await\s+res\.json\(\)\.catch\(\(\)\s*=>\s*null\)\s*\)/g, "(await __sd_read_reply_json_once())");
fn = fn.replace(/\(\s*await\s+res\.json\(\)\s*\)/g, "(await __sd_read_reply_json_once())");

// Sanity: ensure only one raw res.json() left (inside helper there should be none; we use res.text())
const remaining = (fn.match(/\bres\.json\(\)/g) || []).length;
must(remaining === 0, "Patch incomplete: res.json() still present in sendReplyNow().");

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
echo "  cd frontend && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Open a post -> /siddes-post/<id>"
echo "  2) Send a reply (online) -> should succeed or show a specific error"
echo "  3) Try again quickly -> should not flip to a generic 'request_failed'"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
