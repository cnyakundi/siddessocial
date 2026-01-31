#!/usr/bin/env bash
set -euo pipefail

# sd_922_fix_reltag_connections_typecheck_apply_helper.sh
# Fix: TS2304 Cannot find name 'RelTag' in Connections page.
# Strategy: If the file uses <RelTag .../> but doesn't define it, inject a tiny RelTag component
# (side-colored pill) just after SIDE_LABEL, so the page typechecks.

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
  echo "Tip: if you're in frontend/, run: cd .." >&2
  exit 1
fi

TARGET="$ROOT/frontend/src/app/siddes-profile/connections/page.tsx"
if [ ! -f "$TARGET" ]; then
  echo "❌ ERROR: missing $TARGET" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_922_fix_reltag_connections_$TS"
mkdir -p "$BK/frontend/src/app/siddes-profile/connections"
cp "$TARGET" "$BK/frontend/src/app/siddes-profile/connections/page.tsx"

echo "Backup saved to: $BK"
echo ""

node <<'NODE' "$TARGET"
const fs = require("fs");

const file = process.argv[1];
let s = fs.readFileSync(file, "utf8");
const before = s;

const usesRelTag = s.includes("<RelTag");
const hasRelTagDef = /function\s+RelTag\s*\(/.test(s) || /const\s+RelTag\s*=/.test(s);

if (!usesRelTag) {
  console.log("sd_922: No <RelTag usage found. Nothing to do.");
  process.exit(0);
}
if (hasRelTagDef) {
  console.log("sd_922: RelTag already defined. Nothing to do.");
  process.exit(0);
}

const insert = `

// sd_922: Relationship tag (for Connections UI)
// Renders a small side-colored pill like: "You → Friends"
const REL_TONE: Record<SideKey, { bg: string; text: string; border: string }> = {
  friends: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  close: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  work: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

function RelTag({ side, who }: { side: SideKey; who: string }) {
  const tone = REL_TONE[side] || REL_TONE.friends;
  return (
    <span className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold border \${tone.bg} \${tone.text} \${tone.border}\`}>
      {who} → {SIDE_LABEL[side]}
    </span>
  );
}

`;

// Prefer inserting right after SIDE_LABEL block
const sideLabelRe = /(const\s+SIDE_LABEL[\s\S]*?\n\};\n)/m;

if (sideLabelRe.test(s)) {
  s = s.replace(sideLabelRe, (m) => m + insert);
} else {
  // Fallback: insert after SideKey type
  const sideKeyRe = /(type\s+SideKey\s*=\s*[^;]+;\n)/m;
  if (!sideKeyRe.test(s)) {
    console.error("sd_922: Could not find SIDE_LABEL or SideKey anchors to insert RelTag.");
    process.exit(2);
  }
  s = s.replace(sideKeyRe, (m) => m + "\n" + insert);
}

fs.writeFileSync(file, s);
console.log("sd_922: Injected RelTag into connections page.");
NODE

echo ""
echo "✅ sd_922 applied."
echo "Backup: $BK"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT\""
echo "  ./verify_overlays.sh || true"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Note:"
echo "  If you are already inside frontend/, don't run 'cd frontend' again."
echo "  To go back to repo root: cd .."
