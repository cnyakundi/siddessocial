#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_940_unify_alerts_drawer_entrypoints"
FILE="frontend/src/components/AppShell.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp "$FILE" "$BK/AppShell.tsx.bak"
[[ -f "$STATE" ]] && cp "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

node <<'NODE'
const fs = require("fs");
const file = "frontend/src/components/AppShell.tsx";
let s = fs.readFileSync(file, "utf8");

const MARK = "sd_940_unify_alerts_drawer_entrypoints";
if (s.includes(MARK) || s.includes("onToggleNotificationsDrawer")) {
  console.log("SKIP: AppShell already wires BottomNav to notifications drawer.");
  process.exit(0);
}

// Replace <BottomNav /> with a wired version that toggles the drawer
const re1 = /<BottomNav\s*\/>/;
const repl =
  '<BottomNav onToggleNotificationsDrawer={() => setNotifsOpen((v) => !v)} notificationsDrawerOpen={notifsOpen} />';

if (!re1.test(s)) {
  // Also handle <BottomNav/>
  const re2 = /<BottomNav\s*\/\s*>/;
  if (!re2.test(s)) {
    throw new Error("sd_940: Could not find <BottomNav /> in AppShell.tsx");
  }
  s = s.replace(re2, repl);
} else {
  s = s.replace(re1, repl);
}

// Add a small marker comment so future scripts can detect it
if (!s.includes(MARK)) {
  s = s.replace(
    repl,
    `{/* ${MARK}: BottomNav Alerts opens NotificationsDrawer (same as top bell) */}\n        ${repl}`
  );
}

fs.writeFileSync(file, s, "utf8");
console.log("PATCHED:", file);

// docs/STATE.md best-effort
const stateFile = "docs/STATE.md";
if (fs.existsSync(stateFile)) {
  let t = fs.readFileSync(stateFile, "utf8");
  if (!t.includes(MARK)) {
    const line = `- **${MARK}:** Mobile polish: BottomNav Alerts now opens the same NotificationsDrawer as AppTopBar (no route hop; consistent behavior).\\n`;
    if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\\n" + line);
    else t += "\\n\\n## NEXT overlay\\n" + line;
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
echo "  - Tap top bell -> drawer opens"
echo "  - Tap BottomNav Alerts -> SAME drawer opens (and tap again toggles closed)"
