#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_951_post_hero_v5_side_fix"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Hard preconditions
for d in frontend backend scripts; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

PAGE="frontend/src/app/siddes-post/[id]/page.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$PAGE" ]]; then
  echo "❌ Missing: $PAGE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required for safe patching."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"
mkdir -p "$BK/frontend/src/app/siddes-post/[id]" 2>/dev/null || true
cp -a "$PAGE" "$BK/$PAGE"

if [[ -f "$STATE" ]]; then
  mkdir -p "$BK/docs" 2>/dev/null || true
  cp -a "$STATE" "$BK/$STATE" || true
fi

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const STATE = "docs/STATE.md";

let s = fs.readFileSync(PAGE, "utf8");
const before = s;

// Replace any `... ?? side` fallback with a safe literal.
const pat = /side=\{\(found as any\)\?\.\s*side\s*(\?\?|\|\|)\s*side\s*\}/g;
s = s.replace(pat, 'side={(found as any)?.side ?? "public"}');

// Also handle exact earlier formatting.
s = s.replace(/side=\{\(found as any\)\?\.\s*side\s*\?\?\s*side\}/g, 'side={(found as any)?.side ?? "public"}');

if (s === before) {
  console.log("NOOP: did not find the broken '?? side' expression.");
} else {
  fs.writeFileSync(PAGE, s, "utf8");
  console.log("PATCHED:", PAGE);
}

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_951_fix:** Post detail PostHero: fix missing `side` symbol by using safe fallback \"public\".";
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
