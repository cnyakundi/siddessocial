#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_941_bottomnav_calm_badges"
FILE="frontend/src/components/BottomNav.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp "$FILE" "$BK/BottomNav.tsx.bak"
[[ -f "$STATE" ]] && cp "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

node <<'NODE'
const fs = require("fs");
const file = "frontend/src/components/BottomNav.tsx";
let s = fs.readFileSync(file, "utf8");

const MARK = "sd_941_bottomnav_calm_badges";
if (s.includes(MARK)) {
  console.log("SKIP: sd_941 already applied.");
  process.exit(0);
}

// 1) Fix the accidental same-line import (code dirt)
s = s.replace(
  'import { CirclesMark } from "@/src/components/icons/CirclesMark";import {',
  'import { CirclesMark } from "@/src/components/icons/CirclesMark";\nimport {'
);

// 2) Add useSearchParams so we can gate counts behind ?advanced=1
s = s.replace(
  'import { usePathname } from "next/navigation";',
  'import { usePathname, useSearchParams } from "next/navigation";'
);

// 3) Add advanced flag inside BottomNav
if (!s.includes("const advanced =") && s.includes("export function BottomNav")) {
  s = s.replace(
    'const pathname = usePathname() || "";',
    `const pathname = usePathname() || "";
  const sp = useSearchParams();
  const advanced = (sp.get("advanced") || "").trim() === "1"; // ${MARK}`
  );
}

// 4) Calmer label styling (less shouty)
s = s.replaceAll(
  'text-[9px] font-black uppercase tracking-tighter',
  'text-[10px] font-semibold tracking-normal'
);

// 5) Make badges calm:
// - default: dot only for any unread
// - advanced: count only for 10+
// - neutral badge color (no red)
function patchBadgeLogic(block) {
  block = block.replace(
    /const showDot = n > 0 && n < 10;\s*\n\s*const showCount = n >= 10;\s*\n\s*const display = n > 99 \? "99\+" : String\(n\);/g,
    `const showCount = Boolean(showCounts) && n >= 10;
  const showDot = n > 0 && !showCount;
  const display = n > 99 ? "99+" : String(n);`
  );
  block = block.replaceAll("bg-red-500", "bg-gray-900");
  return block;
}
s = patchBadgeLogic(s);

// 6) Add showCounts prop to TabLink
s = s.replace(
  /function TabLink\(\{\s*([\s\S]*?)badge,\s*\n\}\:\s*\{\s*([\s\S]*?)badge\?: number;\s*\n\}\)\s*\{/m,
  (m, a, b) => {
    if (m.includes("showCounts")) return m;
    return `function TabLink({\n${a}badge,\n  showCounts = false,\n}: {\n${b}badge?: number;\n  showCounts?: boolean;\n}) {`;
  }
);

// 7) Add showCounts prop to TabButton
s = s.replace(
  /function TabButton\(\{\s*([\s\S]*?)badge,\s*\n\s*onClick,\s*\n\}\:\s*\{\s*([\s\S]*?)badge\?: number;\s*\n([\s\S]*?)onClick: \(\) => void;\s*\n\}\)\s*\{/m,
  (m, a, b, c) => {
    if (m.includes("showCounts")) return m;
    return `function TabButton({\n${a}badge,\n  showCounts = false,\n  onClick,\n}: {\n${b}badge?: number;\n  showCounts?: boolean;\n${c}onClick: () => void;\n}) {`;
  }
);

// 8) Pass showCounts={advanced} only where badges exist (Alerts + Inbox)
s = s.replace(/(<TabLink[^>]*badge=\{unread\}[^>]*)(\/>)/g, `$1 showCounts={advanced} $2`);
s = s.replace(/(<TabButton[^>]*badge=\{unread\}[^>]*)(\/>)/g, `$1 showCounts={advanced} $2`);
s = s.replace(/(<TabLink[^>]*badge=\{inbox[^}]*\}[^>]*)(\/>)/g, `$1 showCounts={advanced} $2`);
s = s.replace(/(<TabButton[^>]*badge=\{inbox[^}]*\}[^>]*)(\/>)/g, `$1 showCounts={advanced} $2`);

// Marker near top
s = s.replace('"use client";', `"use client";\n\n// ${MARK}`);

fs.writeFileSync(file, s, "utf8");
console.log("PATCHED:", file);

// docs/STATE.md best-effort
const stateFile = "docs/STATE.md";
if (fs.existsSync(stateFile)) {
  let t = fs.readFileSync(stateFile, "utf8");
  if (!t.includes(MARK)) {
    const line = `- **${MARK}:** BottomNav: calm badges (dot by default; counts only with ?advanced=1); neutral badge color; soften tab labels.\n`;
    if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
    else t += "\n\n## NEXT overlay\n" + line;
    fs.writeFileSync(stateFile, t, "utf8");
    console.log("PATCHED:", stateFile);
  }
}
NODE

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Normal: Alerts/Inbox show a small neutral dot when unread (no numbers)"
echo "  - Advanced: add ?advanced=1 -> 10+ shows counts (99+ cap)"
