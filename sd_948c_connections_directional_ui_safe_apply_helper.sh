#!/usr/bin/env bash
set -euo pipefail

NAME="sd_948c_connections_directional_ui_safe"
TARGET="frontend/src/app/siddes-profile/connections/page.tsx"

if [ ! -f "$TARGET" ]; then
  echo "❌ Missing: $TARGET"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${TS}"
mkdir -p "$BK/$(dirname "$TARGET")"
cp -a "$TARGET" "$BK/$TARGET"

python3 - <<'PY'
from pathlib import Path
import re

path = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = path.read_text(encoding="utf-8")
orig = s

if "sd_948c_connections_directional_ui_safe" in s:
    print("ℹ️ sd_948c already applied; no changes made.")
    raise SystemExit(0)

# 1) Tabs: keep ids, change labels (safe regex)
s = re.sub(r'(\{\s*id:\s*"followers"\s*,\s*label:\s*")[^"]+("\s*,\s*icon:\s*Users\s*\})',
           r'\1They → You\2', s)
s = re.sub(r'(\{\s*id:\s*"following"\s*,\s*label:\s*")[^"]+("\s*,\s*icon:\s*UserPlus\s*\})',
           r'\1You → Them\2', s)

# 2) Explainer copy
s = s.replace(
    "Followers are people who placed you into Friends/Close/Work. Following are people you placed into your Sides.",
    "They → You: people who placed you into Friends/Close/Work. You → Them: people you placed into your Sides.",
)

# 3) Empty state copy
s = s.replace("No followers yet.", "No one has added you to their Sides yet.")
s = s.replace("You aren’t following anyone yet.", "You haven’t added anyone to your Sides yet.")

# 4) Replace SIDE_BADGE constant with a calmer SIDE_STAMP (prevents unused var lint)
re_side_badge = re.compile(
    r'const SIDE_BADGE:\s*Record<SideKey,\s*string>\s*=\s*\{[\s\S]*?\n\};\n',
    re.M
)
if not re_side_badge.search(s):
    raise SystemExit("ERROR: Could not find SIDE_BADGE constant to replace.")
s = re_side_badge.sub(
    '''// sd_948c: calmer connection stamps (dot + light text), instead of pill badges
const SIDE_STAMP: Record<SideKey, { dot: string; text: string }> = {
  friends: { dot: "bg-emerald-500", text: "text-emerald-800" },
  close: { dot: "bg-rose-500", text: "text-rose-800" },
  work: { dot: "bg-slate-500", text: "text-slate-800" },
};
''',
    s,
    count=1
)

# 5) Replace Badge() function block by anchoring on "export default function ConnectionsPage"
re_badge_block = re.compile(r'function Badge\([\s\S]*?\n\}\n\nexport default function ConnectionsPage', re.M)
if not re_badge_block.search(s):
    raise SystemExit("ERROR: Could not find Badge() block anchored before ConnectionsPage.")
s = re_badge_block.sub(
    '''function Badge({ children, side }: { children: React.ReactNode; side: SideKey }) {
  const t = SIDE_STAMP[side];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} aria-hidden="true" />
      <span className={cn("font-extrabold", t.text)}>{children}</span>
    </span>
  );
}

export default function ConnectionsPage''',
    s,
    count=1
)

# Marker
s += "\n\n// sd_948c_connections_directional_ui_safe\n"

if s == orig:
    raise SystemExit("ERROR: No changes applied (file may have drifted).")

path.write_text(s, encoding="utf-8")
print("✅ Patched:", str(path))
PY

echo ""
echo "✅ $NAME applied."
echo "Backup: $BK"
echo ""
echo "Now run:"
echo "  ./verify_overlays.sh"
echo "  bash scripts/run_tests.sh --smoke"
