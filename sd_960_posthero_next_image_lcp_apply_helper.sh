#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_960_posthero_next_image_lcp"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Preconditions
for d in frontend backend scripts docs; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

HERO="frontend/src/components/thread/PostHero.tsx"
STATE="docs/STATE.md"

[[ -f "$HERO" ]] || { echo "❌ Missing: $HERO"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node is required."; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$HERO")" "$BK/$(dirname "$STATE")"
cp -a "$HERO" "$BK/$HERO"
cp -a "$STATE" "$BK/$STATE" 2>/dev/null || true

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const HERO = "frontend/src/components/thread/PostHero.tsx";
const STATE = "docs/STATE.md";
const MARK = "sd_960_next_image";

let s = fs.readFileSync(HERO, "utf8");
if (s.includes(MARK)) {
  console.log("NOOP:", HERO, "(already patched)");
} else {
  // Add next/image import if missing
  if (!s.includes('from "next/image"')) {
    // Insert after React import line
    const re = /^import\s+React,[^\n]*\n/m;
    if (re.test(s)) {
      s = s.replace(re, (m) => m + 'import Image from "next/image";\n');
    } else {
      s = 'import Image from "next/image";\n' + s;
    }
  }

  // Replace <img ...> with <Image ...>
  // Find the block that renders avatar
  // Pattern: {avatarUrl ? ( <img src={avatarUrl} ... /> ) : ( ... )}
  s = s.replace(
    /<img\s+src=\{avatarUrl\}\s+alt=""\s+className="w-full h-full object-cover"\s*\/>/m,
    `<Image src={avatarUrl} alt="" fill sizes="48px" className="object-cover" priority />`
  );

  // Ensure avatar container has relative positioning (needed for fill)
  s = s.replace(
    /className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0"/m,
    `className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0"`
  );

  // Marker comment
  s = s.replace(/sd_951_v3: Dedicated "hero" renderer/g, `sd_951_v3: Dedicated "hero" renderer\n// ${MARK}: use next/image for avatar to avoid LCP warnings`);
  if (!s.includes(MARK)) {
    s = `// ${MARK}\n` + s;
  }

  fs.writeFileSync(HERO, s, "utf8");
  console.log("PATCHED:", HERO);

  // docs update
  try {
    if (fs.existsSync(STATE)) {
      const mark = "**sd_960:** PostHero: replace <img> with next/image for avatar (fix LCP lint warning).";
      let t = fs.readFileSync(STATE, "utf8");
      if (!t.includes(mark)) {
        const line = `- ${mark}\n`;
        if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
        else t += "\n\n## NEXT overlay\n" + line;
        fs.writeFileSync(STATE, t, "utf8");
        console.log("PATCHED:", STATE);
      }
    }
  } catch {}
}
NODE

echo ""
echo "== Gates =="
./verify_overlays.sh
(
  cd frontend
  npm run typecheck
  npm run build
)
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
