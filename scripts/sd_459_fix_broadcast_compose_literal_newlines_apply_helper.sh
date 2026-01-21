#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
FILE="$ROOT/frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: file not found: $FILE" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_459_fix_broadcast_compose_literal_newlines_$TS"
mkdir -p "$BK"
cp "$FILE" "$BK/page.tsx"

export FILE
node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
if (!file) throw new Error("FILE env var missing");

let s = fs.readFileSync(file, "utf8");
const before = s;

// 1) Fix the close() block: convert literal "\n" sequences to real newlines
const marker = "const close =";
const i = s.indexOf(marker);
if (i !== -1) {
  // Find the end of this function (first occurrence of "\n  };" or "\n};" after marker)
  let end = s.indexOf("\n  };", i);
  if (end === -1) end = s.indexOf("\n};", i);
  if (end !== -1) {
    const block = s.slice(i, end + 4);
    if (block.includes("\\n")) {
      const fixed = block.replace(/\\n/g, "\n");
      s = s.slice(0, i) + fixed + s.slice(end + 4);
    }
  }
}

// 2) Fix any leftover injected "\n      return;" sequence after close({..});
s = s.replace(/close\(\{ skipSaveDraft: true \}\);\\n\s*return;/g, (m) => {
  return m.replace(/\\n/g, "\n");
});

// 3) Safety: if close() takes opts, it can't be a raw onClick handler
s = s.replace(/onClick=\{close\}/g, "onClick={() => close()}");

if (s === before) {
  console.error("sd_459: No changes made. If errors persist, open the file and search for literal \\\\n sequences.");
  process.exit(2);
}

fs.writeFileSync(file, s);
console.log("sd_459: fixed literal \\\\n sequences in broadcast compose file and wrapped onClick.");
NODE

echo "OK: sd_459 applied."
echo "Backup: $BK"
