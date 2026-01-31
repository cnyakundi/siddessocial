#!/usr/bin/env bash
set -euo pipefail

# sd_928_desktop_user_menu_circles_label_apply_helper.sh
# Goal: DesktopUserMenu: /siddes-circles link should say "Circles" (not "Sets")
# and use CirclesMark icon (brand). Touches ONE file only.

find_repo_root() {
  local d
  d="$(pwd)"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "❌ ERROR: Run this from inside the Siddes repo (must contain frontend/ and backend/)." >&2
  exit 1
fi

TARGET="$ROOT/frontend/src/components/DesktopUserMenu.tsx"
if [ ! -f "$TARGET" ]; then
  echo "❌ ERROR: missing $TARGET" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_928_desktop_user_menu_$TS"
mkdir -p "$BK/frontend/src/components"
cp "$TARGET" "$BK/frontend/src/components/DesktopUserMenu.tsx"

echo "Backup saved to: $BK"
echo ""

node --input-type=commonjs - "$TARGET" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");
const before = s;

// 1) Replace the icon+label on the circles link
s = s.replace(
  /<Grid3X3\s+size=\{16\}\s+className="text-gray-500"\s*\/>\s*Sets/g,
  '<CirclesMark size={16} className="text-gray-500" /> Circles'
);

// 2) Ensure CirclesMark import exists
if (!s.includes('from "@/src/components/icons/CirclesMark"')) {
  // Insert after lucide-react import
  const lucideRe = /import\s+\{[^}]+\}\s+from\s+"lucide-react";\s*\n/;
  if (!lucideRe.test(s)) {
    console.error("sd_928: Could not find lucide-react import to insert CirclesMark import.");
    process.exit(2);
  }
  s = s.replace(lucideRe, (m) => m + 'import { CirclesMark } from "@/src/components/icons/CirclesMark";\n');
}

// 3) Remove Grid3X3 from lucide import list if now unused
s = s.replace(/import\s+\{([^}]+)\}\s+from\s+"lucide-react";/g, (m, inner) => {
  const parts = inner
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p !== "Grid3X3");
  return `import { ${parts.join(", ")} } from "lucide-react";`;
});

if (s === before) {
  console.error("sd_928: No changes made (already applied or patterns not found).");
  process.exit(2);
}

fs.writeFileSync(file, s);
console.log("sd_928: patched DesktopUserMenu.tsx (Circles label + CirclesMark)");
NODE

echo ""
echo "✅ sd_928 applied."
echo "Backup: $BK"
echo ""
echo "Next:"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo ""
echo "Smoke test:"
echo "  1) Open desktop top bar avatar menu."
echo "  2) The circles link should show CirclesMark + 'Circles' (not 'Sets')."
