#!/usr/bin/env bash
set -euo pipefail

# sd_927_circle_detail_back_label_circles_apply_helper.sh
# Goal: On /siddes-circles/[id], the back button should say "Circles" (not "Sets")
# Touches: frontend/src/app/siddes-circles/[id]/page.tsx only.

find_repo_root() {
  local d
  d="$(pwd)"
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
  echo "❌ ERROR: Run this from inside the Siddes repo (must contain frontend/ and backend/)." >&2
  exit 1
fi

TARGET="$ROOT/frontend/src/app/siddes-circles/[id]/page.tsx"
if [ ! -f "$TARGET" ]; then
  echo "❌ ERROR: missing $TARGET" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_927_circle_detail_back_label_$TS"
mkdir -p "$BK/frontend/src/app/siddes-circles/[id]"
cp "$TARGET" "$BK/frontend/src/app/siddes-circles/[id]/page.tsx"

echo "Backup saved to: $BK"
echo ""

node --input-type=commonjs - "$TARGET" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");
const before = s;

// Replace only the back-link label for the Circles list.
const re = /(<Link[\s\S]*?href="\/siddes-circles"[\s\S]*?<ArrowLeft[^>]*\/>\s*)(Sets)(\s*<\/Link>)/m;

if (!re.test(s)) {
  console.error("sd_927: Could not find the Circles back-link label to patch.");
  process.exit(2);
}

s = s.replace(re, "$1Circles$3");

if (s === before) {
  console.error("sd_927: No changes made (already applied?).");
  process.exit(2);
}

fs.writeFileSync(file, s);
console.log("sd_927: patched back label (Sets -> Circles)");
NODE

echo ""
echo "✅ sd_927 applied."
echo "Backup: $BK"
echo ""
echo "Next:"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo ""
echo "Smoke test:"
echo "  1) Open /siddes-circles/<id>"
echo "  2) The top-left back pill should read 'Circles' (not 'Sets')"
