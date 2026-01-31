#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_939_app_topbar_declutter"
FILE="frontend/src/components/AppTopBar.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp "$FILE" "$BK/AppTopBar.tsx.bak"
[[ -f "$STATE" ]] && cp "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

# If ComposeMVP was previously corrupted by a bad patch (python f-string in TSX), restore it so gates can run.
if [[ -f "frontend/src/app/siddes-compose/ComposeMVP.tsx" ]]; then
  if grep -q 'f"{members} people"' "frontend/src/app/siddes-compose/ComposeMVP.tsx"; then
    echo "⚠️ Detected invalid python f-string in ComposeMVP.tsx -> restoring from git HEAD"
    git checkout -- "frontend/src/app/siddes-compose/ComposeMVP.tsx"
  fi
fi

node <<'NODE'
const fs = require("fs");

const file = "frontend/src/components/AppTopBar.tsx";
let s = fs.readFileSync(file, "utf8");

const MARK = "sd_939_app_topbar_declutter";
if (s.includes(MARK)) {
  console.log("SKIP: sd_939 already applied.");
  process.exit(0);
}

// 1) Import useSearchParams
if (!s.includes("useSearchParams")) {
  const a = 'import { usePathname, useRouter } from "next/navigation";';
  const b = 'import { usePathname, useRouter, useSearchParams } from "next/navigation";';
  if (s.includes(a)) s = s.replace(a, b);
}

// 2) Add advanced mode flag (via ?advanced=1)
if (!s.includes("const advanced =") && s.includes("useSearchParams")) {
  const re = /(const\s+router\s*=\s*useRouter\(\);\s*[^\n]*\n)/;
  if (re.test(s)) {
    s = s.replace(
      re,
      `$1  const sp = useSearchParams();\n  const advanced = (sp.get("advanced") || "").trim() === "1"; // ${MARK}\n`
    );
  }
}

// 3) Fix the “goBack;  const pageTitle” same-line dirt
s = s.replace(
  'const goBack = useSmartBack("/siddes-feed");  const pageTitle = useMemo(() => {',
  'const goBack = useSmartBack("/siddes-feed");\n\n  const pageTitle = useMemo(() => {'
);

// 4) Make action buttons consistent (rounded-xl instead of rounded-full)
s = s.replaceAll(
  "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-full",
  "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl"
);
s = s.replaceAll(
  'className="p-2 rounded-full hover:bg-gray-100',
  'className="p-2 rounded-xl hover:bg-gray-100'
);

// 5) Hide Refresh unless ?advanced=1
if (s.includes('aria-label="Refresh"') && !s.includes("sd_939_refresh_gated")) {
  const re = /(\n\s*)(<button[\s\S]*?aria-label="Refresh"[\s\S]*?<\/button>)/m;
  if (!re.test(s)) {
    throw new Error("sd_939: could not find Refresh button block to gate");
  }
  s = s.replace(re, (m, indent, btn) => {
    return `\n${indent}{advanced ? (\n${indent}${btn}\n${indent}) : null} {/* sd_939_refresh_gated */}`;
  });
}

fs.writeFileSync(file, s, "utf8");
console.log("PATCHED:", file);

// docs/STATE.md best-effort
const stateFile = "docs/STATE.md";
if (fs.existsSync(stateFile)) {
  let t = fs.readFileSync(stateFile, "utf8");
  if (!t.includes(MARK)) {
    const line = `- **${MARK}:** AppTopBar: hide Refresh behind ?advanced=1; normalize topbar action buttons (rounded-xl); fix goBack/pageTitle formatting.\\n`;
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
echo "  - Normal: top bar shows no Refresh button"
echo "  - Advanced: open any page with ?advanced=1 -> Refresh appears"
echo "  - Buttons are rounded-xl and consistent"
