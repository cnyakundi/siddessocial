#!/usr/bin/env bash
set -euo pipefail

TARGET="frontend/src/components/PostCard.tsx"
if [[ ! -f "$TARGET" ]]; then
  echo "❌ Missing $TARGET. Run from repo root."
  exit 1
fi

BK=".backup_sd_974_echo_chooser_on_repeat_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK/$(dirname "$TARGET")"
cp "$TARGET" "$BK/$TARGET"
echo "✅ Backup: $BK/$TARGET"

node - <<'NODE'
const fs = require("fs");

const path = "frontend/src/components/PostCard.tsx";
let s = fs.readFileSync(path, "utf8");

if (s.includes("sd_974_row_echo_chooser")) {
  console.log("✅ Already applied (sd_974 marker found).");
  process.exit(0);
}

const newOnClick =
`onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // sd_974_row_echo_chooser: open chooser (Echo vs Quote Echo) instead of instant toggle
                    setOpenEcho(true);
                  }}`;

// Pass 1: strict-but-flexible match for the old toggleEcho handler
let n = 0;
const re1 = /onClick=\{\(e\)\s*=>\s*\{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*(?:void\s*|await\s*)?toggleEcho\(\)\s*;?\s*\}\}/g;
s = s.replace(re1, () => { n++; return newOnClick; });

if (n === 0) {
  // Pass 2: find the Echo button by its title and patch the first onClick block nearby that contains toggleEcho()
  const titleNeedle = 'title={echoed ? "Un-echo" : "Echo"}';
  let idx = s.indexOf(titleNeedle);
  while (idx !== -1) {
    const window = s.slice(idx, Math.min(s.length, idx + 1200));
    if (window.includes("toggleEcho(")) {
      const reBlock = /onClick=\{\(e\)\s*=>\s*\{[\s\S]*?\}\}/;
      const m = window.match(reBlock);
      if (m && m[0].includes("toggleEcho")) {
        const before = s;
        s = s.replace(m[0], newOnClick);
        if (s !== before) { n = 1; break; }
      }
    }
    idx = s.indexOf(titleNeedle, idx + titleNeedle.length);
  }
}

if (n === 0) {
  console.error("❌ ERROR: Could not find the Repeat/Echo button handler to patch.");
  console.error("Tip: open PostCard.tsx and search for 'toggleEcho()' and '<Repeat'.");
  process.exit(1);
}

fs.writeFileSync(path, s, "utf8");
console.log(`✅ OK: patched ${path} (${n} occurrence(s))`);
NODE

echo ""
echo "✅ sd_974 applied."
echo ""
echo "Verify:"
echo "  rg \"sd_974_row_echo_chooser\" -n \"$TARGET\""
echo ""
echo "Next (VS Code terminal):"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  ./verify_overlays.sh"
echo ""
echo "Manual QA:"
echo "  1) Open /siddes-feed (Public)"
echo "  2) Tap the Repeat (Echo) icon on a post"
echo "  3) You should see the EchoSheet with:"
echo "     - Echo / Un-echo"
echo "     - Quote Echo"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$TARGET\" \"$TARGET\""
