#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_975_apptopbar_calm_refresh_gate"
TOP="frontend/src/components/AppTopBar.tsx"
NAV="frontend/src/components/BottomNav.tsx"

[[ -d frontend ]] || { echo "❌ Run from repo root (missing frontend/)"; exit 1; }
[[ -f "$TOP" ]] || { echo "❌ Missing: $TOP"; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$TOP" "$BK/AppTopBar.tsx.bak"
[[ -f "$NAV" ]] && cp -a "$NAV" "$BK/BottomNav.tsx.bak" || true
echo "Backup: $BK"

node <<'NODE'
const fs = require("fs");

function patchTopbar() {
  const file = "frontend/src/components/AppTopBar.tsx";
  let s = fs.readFileSync(file, "utf8");

  // Fix goBack/pageTitle same-line dirt (safe noop if already fixed)
  s = s.replace(
    'const goBack = useSmartBack("/siddes-feed");  const pageTitle = useMemo(() => {',
    'const goBack = useSmartBack("/siddes-feed");\n\n  const pageTitle = useMemo(() => {'
  );

  // Add advanced flag (client-only) after pathname line
  if (!s.includes("const [advanced, setAdvanced]")) {
    const re = /(const\s+pathname\s*=\s*usePathname\(\)\s*\|\|\s*[^;]+;\s*\n)/;
    if (!re.test(s)) throw new Error("sd_975: could not find pathname line to anchor advanced flag");
    s = s.replace(
      re,
      `$1  // sd_975: advanced UI gate via ?advanced=1\n  const [advanced, setAdvanced] = useState(false);\n  useEffect(() => {\n    try {\n      const q = new URLSearchParams(window.location.search || \"\");\n      setAdvanced((q.get(\"advanced\") || \"\").trim() === \"1\");\n    } catch {\n      setAdvanced(false);\n    }\n  }, [pathname]);\n`
    );
  }

  // Calm alerts dot + copy
  s = s.replaceAll("bg-red-500", "bg-gray-900");
  s = s.replaceAll('aria-label="New notifications"', 'aria-label="New alerts"');

  // Gate Refresh button (wrap the exact Refresh button block)
  if (!s.includes("sd_975_refresh_gated") && s.includes('aria-label="Refresh"')) {
    const btnRe = /(\n[ \t]*)(<button[\s\S]*?aria-label="Refresh"[\s\S]*?<\/button>)/m;
    if (!btnRe.test(s)) throw new Error("sd_975: could not locate Refresh button block");
    s = s.replace(btnRe, (m, indent, btn) => {
      return `\n${indent}{process.env.NODE_ENV !== "production" && advanced ? (\n${indent}${btn}\n${indent}) : null} {/* sd_975_refresh_gated */}`;
    });
  }

  fs.writeFileSync(file, s, "utf8");
  console.log("PATCHED:", file);
}

function patchBottomNavOptional() {
  const file = "frontend/src/components/BottomNav.tsx";
  if (!fs.existsSync(file)) return;

  let s = fs.readFileSync(file, "utf8");
  const before = s;

  // Neutralize badge color if present
  s = s.replaceAll("bg-red-500", "bg-gray-900");

  // If showDot/showCount exist, force dot-only
  s = s.replace(
    /const\s+showDot\s*=\s*n\s*>\s*0\s*&&\s*n\s*<\s*10\s*;/,
    "const showDot = n > 0; // sd_975 dot-only"
  );
  s = s.replace(
    /const\s+showCount\s*=\s*n\s*>=\s*10\s*;/,
    "const showCount = false; // sd_975 dot-only"
  );

  if (s !== before) {
    fs.writeFileSync(file, s, "utf8");
    console.log("PATCHED:", file);
  } else {
    console.log("OK:", file, "(no changes)");
  }
}

patchTopbar();
patchBottomNavOptional();
NODE

echo ""
echo "== Gates (don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Normal: Refresh is hidden"
echo "  - Dev + ?advanced=1: Refresh appears"
echo "  - Alerts dot is neutral (not red) and aria-label says 'New alerts'"
