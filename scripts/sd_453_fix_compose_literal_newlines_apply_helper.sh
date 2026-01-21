#!/usr/bin/env bash
set -euo pipefail

find_repo_root() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "ERROR: run this from inside the repo (must contain frontend/ and backend/)." >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_453_fix_compose_literal_newlines_$TS"
mkdir -p "$BK"

FILE="$ROOT/frontend/src/app/siddes-compose/client.tsx"
cp "$FILE" "$BK/client.tsx"
export FILE

node <<'NODE'
const fs = require("fs");

const file = process.env.FILE;
if (!file) throw new Error("FILE env var missing");

let s = fs.readFileSync(file, "utf8");
const before = s;

// 1) Replace the exact bad injected sequence with real newlines
s = s.replace(
  /const close = \(opts\?: \{ skipSaveDraft\?: boolean \}\) => \{\\n\s*\/\/ Never drop text silently \(unless we just successfully posted\/queued\)\.\\n\s*if \(!opts\?\.skipSaveDraft && \(text \|\| ""\)\.trim\(\)\) saveCurrentDraft\(\);\\n\\n/,
  'const close = (opts?: { skipSaveDraft?: boolean }) => {\n    // Never drop text silently (unless we just successfully posted/queued).\n    if (!opts?.skipSaveDraft && (text || "").trim()) saveCurrentDraft();\n\n'
);

// 2) Fallback: if the close() block still contains literal "\n", convert them
const marker = "const close = (opts?: { skipSaveDraft?: boolean }) => {";
const idx = s.indexOf(marker);
if (idx !== -1) {
  const end = s.indexOf("};", idx);
  if (end !== -1) {
    const block = s.slice(idx, end + 2);
    if (block.includes("\\n")) {
      const fixed = block.replace(/\\n/g, "\n");
      s = s.slice(0, idx) + fixed + s.slice(end + 2);
    }
  }
}

if (s === before) {
  console.error("sd_453: No changes made (pattern not found). Open the file and remove literal \\\\n manually.");
  process.exit(2);
}

fs.writeFileSync(file, s);
console.log("sd_453: fixed literal \\\\n sequences in compose close() block.");
NODE

echo "OK: sd_453 applied."
echo "Backup: $BK"
