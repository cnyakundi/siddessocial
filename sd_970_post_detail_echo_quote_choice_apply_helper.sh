#!/usr/bin/env bash
set -euo pipefail

TARGET="frontend/src/components/PostCard.tsx"
if [[ ! -f "$TARGET" ]]; then
  echo "❌ ERROR: Run this from repo root (missing $TARGET)."
  exit 1
fi

BK=".backup_sd_970_post_detail_echo_quote_choice_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK/$(dirname "$TARGET")"
cp "$TARGET" "$BK/$TARGET"
echo "✅ Backup: $BK/$TARGET"

node - <<'NODE'
const fs = require("fs");

const path = "frontend/src/components/PostCard.tsx";
let s = fs.readFileSync(path, "utf8");

if (s.includes("sd_970_detail_echo_quote_choice")) {
  console.log("✅ Already applied (sd_970 marker found).");
  process.exit(0);
}

// Matches the current Echo button handler that does preventDefault/stopPropagation + toggleEcho()
const re =
  /onClick=\{\(e\)\s*=>\s*\{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*(?:void\s*)?toggleEcho\(\);\s*\}\}/g;

const replacement =
`onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // sd_970_detail_echo_quote_choice: in post detail, show chooser (EchoSheet)
                    if (isDetail) {
                      setOpenEcho(true);
                      return;
                    }
                    toggleEcho();
                  }}`;

const before = s;
s = s.replace(re, replacement);

if (s === before) {
  console.error("❌ ERROR: Pattern not found. The Echo onClick(toggleEcho()) block wasn’t located in PostCard.tsx.");
  process.exit(1);
}

fs.writeFileSync(path, s, "utf8");
console.log("✅ OK: patched", path);
NODE

echo ""
echo "✅ sd_970 applied."
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  ./verify_overlays.sh"
echo ""
echo "Manual QA:"
echo "  - Open /siddes-post/<id>"
echo "  - Tap Echo (Repeat) -> should open EchoSheet (Echo vs Quote Echo)"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$TARGET\" \"$TARGET\""
