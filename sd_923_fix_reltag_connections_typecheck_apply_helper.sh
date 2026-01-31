#!/usr/bin/env bash
set -euo pipefail

# sd_923_fix_reltag_connections_typecheck_apply_helper.sh
# Fix: TS2304 Cannot find name 'RelTag' in frontend/src/app/siddes-profile/connections/page.tsx
# Note: Uses `node --input-type=commonjs - ...` so Node never tries to execute .tsx directly.

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
  echo "❌ ERROR: Run this from inside the repo (must contain frontend/ and backend/)." >&2
  exit 1
fi

TARGET="$ROOT/frontend/src/app/siddes-profile/connections/page.tsx"
if [ ! -f "$TARGET" ]; then
  echo "❌ ERROR: missing $TARGET" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_923_fix_reltag_connections_$TS"
mkdir -p "$BK/frontend/src/app/siddes-profile/connections"
cp "$TARGET" "$BK/frontend/src/app/siddes-profile/connections/page.tsx"

echo "Backup saved to: $BK"
echo ""

node --input-type=commonjs - "$TARGET" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("sd_923: Missing target filepath argument");
  process.exit(2);
}

let s = fs.readFileSync(file, "utf8");

const usesRelTag = s.includes("<RelTag");
const hasRelTagDef = /function\s+RelTag\s*\(|const\s+RelTag\s*=/.test(s);

if (!usesRelTag) {
  console.log("sd_923: No <RelTag usage found. Nothing to do.");
  process.exit(0);
}
if (hasRelTagDef) {
  console.log("sd_923: RelTag already defined. Nothing to do.");
  process.exit(0);
}

const insert = `

// sd_923: Relationship tag (for Connections UI)
// Renders a small side-colored pill like: "You → Friends"
const REL_SIDE_LABEL: Record<string, string> = {
  public: "Public",
  friends: "Friends",
  close: "Close",
  work: "Work",
};

const REL_TONE: Record<string, { bg: string; text: string; border: string }> = {
  public: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  friends: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  close: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  work: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

function RelTag({ side, who }: { side: string; who: string }) {
  const key = String(side || "").toLowerCase().trim();
  const tone = REL_TONE[key] || REL_TONE.friends;
  const label = REL_SIDE_LABEL[key] || (key ? key[0].toUpperCase() + key.slice(1) : "Circle");

  return (
    <span className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold border \${tone.bg} \${tone.text} \${tone.border}\`}>
      {who} → {label}
    </span>
  );
}

`;

// Insert after the top import block (safest)
const m = s.match(/^(\s*["']use client["'];\s*)?((?:import[\s\S]*?;\s*)+)/);
if (m) {
  const prefixLen = (m[1] ? m[1].length : 0) + m[2].length;
  s = s.slice(0, prefixLen) + insert + s.slice(prefixLen);
} else if (s.includes('"use client";')) {
  const idx = s.indexOf('"use client";') + '"use client";'.length;
  s = s.slice(0, idx) + "\n" + insert + s.slice(idx);
} else {
  s = insert + s;
}

fs.writeFileSync(file, s);
console.log("sd_923: Injected RelTag into connections page.");
NODE

echo ""
echo "✅ sd_923 applied."
echo "Backup: $BK"
echo ""
echo "Next:"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
