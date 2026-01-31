#!/usr/bin/env bash
set -euo pipefail

NAME="sd_960_post_detail_reply_send_parse_once"
FILE="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Run this from your repo root (the folder that contains frontend/)."
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

// --- helper: brace-scan a function block by name (handles nested braces + ignores strings/comments) ---
function findFunctionRange(source, name) {
  const idxA = source.indexOf(`const ${name} =`);
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

// --- Patch A: fix sendReplyNow() to parse JSON ONCE ---
{
  const r = findFunctionRange(src, "sendReplyNow");
  must(r, "sd_960: Could not find sendReplyNow() in page.tsx (file drift).");
  const [fnStart, fnEnd] = r;
  let fn = src.slice(fnStart, fnEnd + 1);

  // If earlier attempts left helper calls, neutralize them to just `j`.
  fn = fn.replace(/__sd_read_reply_json_once\s*\([^)]*\)/g, "j");
  fn = fn.replace(/__sd_read_reply_json_once\s*\(\s*\)/g, "j");

  // Remove any existing `const j = await res.json...` lines so we can insert exactly one.
  fn = fn.replace(/^\s*const j = await res\.json\(\)\.catch\(\(\) => null\);\s*$/gm, "");

  // Find the fetch call for /reply
  const needle = "const res = await fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`";
  const resIdx = fn.indexOf(needle);
  must(resIdx !== -1, "sd_960: Could not find reply fetch() inside sendReplyNow().");

  // Find end of the fetch call (first occurrence of a closing `});` after it)
  const tail = fn.slice(resIdx);
  const m = tail.match(/\n(\s*)\}\);\s*\n/);
  must(m && typeof m.index === "number", "sd_960: Could not locate end of fetch() call.");

  const insertAt = resIdx + m.index + m[0].length;
  const indent = m[1] || "";

  // Insert the single JSON parse, right after fetch
  const parseLine = `${indent}const j = await res.json().catch(() => null);\n\n`;
  fn = fn.slice(0, insertAt) + parseLine + fn.slice(insertAt);

  // Replace any other reads with `j`
  fn = fn.replace(/await\s+res\.json\(\)\.catch\(\(\)\s*=>\s*null\)/g, "j");
  fn = fn.replace(/await\s+res\.json\(\)/g, "j");

  // If there was a `const data = ...` in the ok branch, remove it and ensure it uses `j`
  fn = fn.replace(/^\s*const data = j;\s*$/gm, "");
  fn = fn.replace(/^\s*const data = .*?;\s*$/gm, (line) => {
    // specifically kill the old `const data = await res.json...`
    return line.includes("res.json") ? "" : line;
  });

  // Fix common pattern: `if (!data || data.ok !== false)` -> `if (!j || j.ok !== false)`
  fn = fn.replace(/\bdata\.ok\b/g, "j.ok");
  fn = fn.replace(/\b!data\b/g, "!j");
  fn = fn.replace(/\bdata\b/g, "j"); // safe inside this function (no data-testid etc)

  // Sanity: only one res.json should remain in this function (our inserted line).
  const jsonCount = (fn.match(/res\.json\(/g) || []).length;
  must(jsonCount === 1, `sd_960: Expected exactly 1 res.json() in sendReplyNow(), found ${jsonCount}.`);

  src = src.slice(0, fnStart) + fn + src.slice(fnEnd + 1);
}

// --- Patch B: remove duplicate SentReplies header + tighten spacing inside the thread card ---
{
  // mt-6 -> mt-0 for sent replies container
  src = src.replace(
    /<div className="mt-6" data-testid="sent-replies">/g,
    '<div className="mt-0" data-testid="sent-replies">'
  );

  // Remove the internal "Replies" header block (PostDetail already shows replies header now)
  src = src.replace(
    /<div className="flex items-baseline gap-2 mb-3">\s*<div className="text-\[11px\] font-black text-gray-900">\{replies\.length === 1 \? "1 Reply" : `\$\{replies\.length\} Replies`\}<\/div>\s*<\/div>\s*/m,
    ""
  );
}

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
echo "  2) Send reply -> should succeed consistently (no flake)"
echo "  3) Replies header should appear only once (the thread card header)"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
