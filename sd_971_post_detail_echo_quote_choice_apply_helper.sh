#!/usr/bin/env bash
set -euo pipefail

TARGET="frontend/src/components/PostCard.tsx"
if [[ ! -f "$TARGET" ]]; then
  echo "❌ ERROR: Run this from repo root (missing $TARGET)."
  exit 1
fi

BK=".backup_sd_971_post_detail_echo_quote_choice_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK/$(dirname "$TARGET")"
cp "$TARGET" "$BK/$TARGET"
echo "✅ Backup: $BK/$TARGET"

node - <<'NODE'
const fs = require("fs");

const path = "frontend/src/components/PostCard.tsx";
let s = fs.readFileSync(path, "utf8");

if (s.includes("sd_971_detail_echo_quote_choice")) {
  console.log("✅ Already applied (sd_971 marker found).");
  process.exit(0);
}

const newOnClick =
`onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // sd_971_detail_echo_quote_choice: post detail opens chooser (Echo vs Quote Echo)
                    if (!isRow) {
                      setOpenEcho(true);
                      return;
                    }
                    toggleEcho();
                  }}`;

// Strategy 1: Match the Echo button by its title (Echo/Un-echo) and a toggleEcho() onClick nearby.
let patches = 0;
const re1 = /title=\{echoed\s*\?\s*"Un-echo"\s*:\s*"Echo"\}[\s\S]{0,700}?onClick=\{[\s\S]*?toggleEcho\(\);[\s\S]*?\}\}/g;
s = s.replace(re1, (m) => {
  const out = m.replace(/onClick=\{[\s\S]*?\}\}/, newOnClick);
  if (out !== m) patches++;
  return out;
});

// Strategy 2: Match by aria-label containing Echo and a toggleEcho() handler (fallback)
if (patches === 0) {
  const re2 = /aria-label=\{[\s\S]{0,200}?Echo[\s\S]{0,200}?\}[\s\S]{0,700}?onClick=\{[\s\S]*?toggleEcho\(\);[\s\S]*?\}\}/g;
  s = s.replace(re2, (m) => {
    const out = m.replace(/onClick=\{[\s\S]*?\}\}/, newOnClick);
    if (out !== m) patches++;
    return out;
  });
}

// Strategy 3: Replace any onClick handler that calls toggleEcho(), but ONLY if a <Repeat ...> icon appears soon after (Echo button signature).
if (patches === 0) {
  const re3 = /onClick=\{[\s\S]*?toggleEcho\(\);[\s\S]*?\}\}(?=[\s\S]{0,400}?<Repeat\b)/g;
  s = s.replace(re3, (m) => {
    patches++;
    return newOnClick;
  });
}

if (patches === 0) {
  const hits = [...s.matchAll(/toggleEcho\(\)/g)].slice(0, 5);
  console.error("❌ ERROR: Could not patch Echo button onClick. Found toggleEcho() occurrences:", hits.length);
  hits.forEach((h, i) => {
    const idx = h.index ?? 0;
    const start = Math.max(0, idx - 140);
    const end = Math.min(s.length, idx + 260);
    console.error(`---- context ${i + 1} ----\n` + s.slice(start, end) + "\n");
  });
  process.exit(1);
}

fs.writeFileSync(path, s, "utf8");
console.log(`✅ OK: patched ${path} (${patches} occurrence(s))`);
NODE

echo ""
echo "✅ sd_971 applied."
echo ""
echo "Verify patch is present:"
echo "  rg \"sd_971_detail_echo_quote_choice\" -n \"$TARGET\""
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  ./verify_overlays.sh"
echo ""
echo "Manual QA:"
echo "  1) Open /siddes-post/<id>"
echo "  2) Tap Echo (Repeat) -> should open the chooser sheet (Echo / Quote Echo)"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$TARGET\" \"$TARGET\""
