#!/usr/bin/env bash
set -euo pipefail

NAME="sd_958_fix_reply_json_call_signature"
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
let s = fs.readFileSync(FILE, "utf8");
const before = s;

// Fix: function expects 0 args, so stop passing `res`
s = s.replace(/__sd_read_reply_json_once\s*\(\s*res\s*\)/g, "__sd_read_reply_json_once()");
s = s.replace(/await\s+__sd_read_reply_json_once\s*\(\s*res\s*\)/g, "await __sd_read_reply_json_once()");

if (s === before) {
  throw new Error("No __sd_read_reply_json_once(res) found to replace. File may have changed.");
}

fs.writeFileSync(FILE, s, "utf8");
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
