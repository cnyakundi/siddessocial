#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_943_apptopbar_repair_and_gate_refresh"
FILE="frontend/src/components/AppTopBar.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK/$FILE"

echo ""
echo "== Step 1: restore AppTopBar.tsx from git (to remove syntax corruption) =="
git checkout -- "$FILE"
echo "✅ Restored $FILE"

echo ""
echo "== Step 2: apply safe patch (advanced gate + rounded-xl + line-break fix) =="

node <<'NODE'
const fs = require("fs");

const file = "frontend/src/components/AppTopBar.tsx";
let s = fs.readFileSync(file, "utf8");
const MARK = "sd_943_apptopbar_repair_and_gate_refresh";

// marker
if (!s.includes(MARK)) {
  s = s.replace('"use client";', `"use client";\n\n// ${MARK}`);
}

// 1) add useSearchParams import
s = s.replace(
  'import { usePathname, useRouter } from "next/navigation";',
  'import { usePathname, useRouter, useSearchParams } from "next/navigation";'
);

// 2) add advanced flag after router init
if (!s.includes("const advanced =")) {
  const re = /(const\s+router\s*=\s*useRouter\(\);\s*(?:\/\/[^\n]*)?\n)/;
  if (!re.test(s)) throw new Error("sd_943: could not find `const router = useRouter();`");
  s = s.replace(
    re,
    `$1  const sp = useSearchParams();\n  const advanced = (sp.get("advanced") || "").trim() === "1"; // ${MARK}\n`
  );
}

// 3) fix goBack/pageTitle same-line dirt (seen in repo version) :contentReference[oaicite:2]{index=2}
s = s.replace(
  'const goBack = useSmartBack("/siddes-feed");  const pageTitle = useMemo(() => {',
  'const goBack = useSmartBack("/siddes-feed");\n\n  const pageTitle = useMemo(() => {'
);

// 4) gate Refresh button behind advanced (wrap the button that has aria-label="Refresh") :contentReference[oaicite:3]{index=3}
const btnRe = /(\n\s*)(<button[\s\S]*?aria-label="Refresh"[\s\S]*?<\/button>)/m;
if (!btnRe.test(s)) throw new Error('sd_943: could not find Refresh button block (aria-label="Refresh")');
s = s.replace(btnRe, (m, indent, btn) => {
  return `\n${indent}{advanced ? (\n${indent}${btn}\n${indent}) : null} {/* ${MARK}_refresh_gated */}`;
});

// 5) make topbar icon buttons consistent: only change the 44px icon button class pattern
s = s.replaceAll(
  "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-full",
  "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl"
);

fs.writeFileSync(file, s, "utf8");
console.log("PATCHED:", file);
NODE

# docs/STATE.md best-effort
if [[ -f "$STATE" ]]; then
  if ! grep -q "sd_943_apptopbar_repair_and_gate_refresh" "$STATE"; then
    printf "\n- **sd_943_apptopbar_repair_and_gate_refresh:** Repair AppTopBar; gate Refresh behind ?advanced=1; normalize 44px icon buttons to rounded-xl; fix goBack/pageTitle formatting.\n" >> "$STATE"
  fi
fi

echo ""
echo "== Gates (IMPORTANT: do not cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: $BK"
