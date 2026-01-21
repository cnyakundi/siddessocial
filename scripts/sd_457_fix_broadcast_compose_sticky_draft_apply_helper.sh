#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
FILE="$ROOT/frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: file not found: $FILE" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_457_fix_broadcast_compose_sticky_draft_$TS"
mkdir -p "$BK"
cp "$FILE" "$BK/page.tsx"

node -e '
const fs=require("fs");
const f=process.argv[1];
let s=fs.readFileSync(f,"utf8");

s = s.replace(
  /const close = \(\) => \{\s*\n\s*if \(\(text \|\| ""\)\.trim\(\)\) saveCurrentDraft\(\);\s*\n/m,
  "const close = (opts?: { skipSaveDraft?: boolean }) => {\\n    if (!opts?.skipSaveDraft && (text || \"\").trim()) saveCurrentDraft();\\n"
);

s = s.replace(/close\(\);\s*return;/m, "close({ skipSaveDraft: true });\\n      return;");

// avoid TS mismatch when passing close as an onClick handler
s = s.replace(/onClick=\{close\}/g, "onClick={() => close()}");

fs.writeFileSync(f,s);
console.log("sd_457: patched broadcast compose close() to skip saving after reset/queue.");
' "$FILE"

echo "OK: sd_457 applied."
echo "Backup: $BK"
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
