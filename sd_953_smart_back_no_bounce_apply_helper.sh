#!/usr/bin/env bash
set -euo pipefail

NAME="sd_953_smart_back_no_bounce"
F1="frontend/src/hooks/useSmartBack.ts"
F2="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$F1" || ! -f "$F2" ]]; then
  echo "❌ Run from repo root. Missing:"
  [[ ! -f "$F1" ]] && echo "   - $F1"
  [[ ! -f "$F2" ]] && echo "   - $F2"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${STAMP}"
mkdir -p "$BK/$(dirname "$F1")" "$BK/$(dirname "$F2")"
cp "$F1" "$BK/$F1"
cp "$F2" "$BK/$F2"

node - <<'NODE'
const fs = require("fs");

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

function patchSmartBack() {
  const FILE = "frontend/src/hooks/useSmartBack.ts";
  let s = fs.readFileSync(FILE, "utf8");

  // 1) Return path: push -> replace (prevents history bounce)
  const a = s;
  s = s.replace(/router\.push\(\s*p\s*\);\s*\n\s*return;/, "router.replace(p);\n          return;");
  must(s !== a, "useSmartBack.ts: could not replace router.push(p) -> router.replace(p)");

  // 2) Fallback: push -> replace (deep-link back shouldn’t bounce either)
  const b = s;
  s = s.replace(/router\.push\(\s*fallbackHref\s*\);\s*$/m, "router.replace(fallbackHref);");
  must(s !== b, "useSmartBack.ts: could not replace router.push(fallbackHref) -> router.replace(fallbackHref)");

  fs.writeFileSync(FILE, s, "utf8");
  console.log("OK: patched", FILE);
}

function patchPostDetailBack() {
  const FILE = "frontend/src/app/siddes-post/[id]/page.tsx";
  let s = fs.readFileSync(FILE, "utf8");

  // Import useSmartBack (if missing)
  if (!s.includes('from "@/src/hooks/useSmartBack"')) {
    const needle = 'import { useSide } from "@/src/components/SideProvider";';
    must(s.includes(needle), "PostDetail: could not find SideProvider import to anchor insertion.");
    s = s.replace(
      needle,
      needle + '\nimport { useSmartBack } from "@/src/hooks/useSmartBack";'
    );
  }

  // Add const goBack = useSmartBack(backHref); (if missing)
  if (!s.includes("const goBack = useSmartBack(backHref)")) {
    const re = /const backHref = ([^\n]+);\n(\s*)const backLabel =/m;
    must(re.test(s), "PostDetail: could not find backHref/backLabel block.");
    s = s.replace(re, (m, rhs, indent) => {
      return `const backHref = ${rhs};\n${indent}const goBack = useSmartBack(backHref);\n${indent}const backLabel =`;
    });
  }

  // Replace the two back Links to buttons (prevents history bounce)
  // (1) not-found state
  s = s.replace(
    /<Link href=\{backHref\} className="inline-block mt-4 text-sm font-extrabold text-gray-700 hover:underline">\s*←\s*Back to \{backLabel\}\s*<\/Link>/m,
    `<button type="button" onClick={goBack} className="inline-block mt-4 text-sm font-extrabold text-gray-700 hover:underline">\n              ← Back to {backLabel}\n            </button>`
  );

  // (2) header row
  s = s.replace(
    /<Link href=\{backHref\} className="text-sm font-extrabold text-gray-700 hover:underline">\s*←\s*\{backLabel\}\s*<\/Link>/m,
    `<button type="button" onClick={goBack} className="text-sm font-extrabold text-gray-700 hover:underline">\n              ← {backLabel}\n            </button>`
  );

  // Ensure we actually have goBack used somewhere
  must(s.includes("onClick={goBack}"), "PostDetail: did not inject onClick={goBack} (unexpected file shape).");

  fs.writeFileSync(FILE, s, "utf8");
  console.log("OK: patched", FILE);
}

patchSmartBack();
patchPostDetailBack();
NODE

echo ""
echo "✅ $NAME applied."
echo "Backup saved to: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Open Feed -> open a Post"
echo "  2) Tap Back (top bar or in-page Back)"
echo "  3) You should return to where you were"
echo "  4) Press browser back again: you should NOT bounce back into the post"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$F1\" \"$F1\""
echo "  cp \"$BK/$F2\" \"$F2\""
