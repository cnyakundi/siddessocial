#!/usr/bin/env bash
set -euo pipefail

NAME="sd_949_connections_directional_ui_safe"
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

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8")
orig = s

if "sd_949_connections_directional_ui_safe" in s:
    print("ℹ️ sd_949 already applied; no changes made.")
    raise SystemExit(0)

# 1) Tabs: keep ids, change labels
s = s.replace('{ id: "followers", label: "Followers", icon: Users },', '{ id: "followers", label: "They → You", icon: Users },')
s = s.replace('{ id: "following", label: "Following", icon: UserPlus },', '{ id: "following", label: "You → Them", icon: UserPlus },')

# 2) Header explainer copy
s = s.replace(
    "Followers are people who placed you into Friends/Close/Work. Following are people you placed into your Sides.",
    "They → You: people who placed you into Friends/Close/Work. You → Them: people you placed into your Sides.",
)

# 3) Empty states
s = s.replace("No followers yet.", "No one has added you to their Sides yet.")
s = s.replace("You aren’t following anyone yet.", "You haven’t added anyone to your Sides yet.")

# 4) Replace SIDE_BADGE constant with calm stamp colors
re_badge = re.compile(r"const SIDE_BADGE:\s*Record<SideKey,\s*string>\s*=\s*\{[\s\S]*?\n\};", re.M)
if not re_badge.search(s):
    raise SystemExit("ERROR: Could not find SIDE_BADGE block to replace.")
s = re_badge.sub(
    """// sd_949_connections_directional_ui_safe: calm dot+text stamps (no pills)
const SIDE_STAMP: Record<SideKey, { dot: string; text: string }> = {
  friends: { dot: "bg-emerald-500", text: "text-emerald-800" },
  close: { dot: "bg-rose-500", text: "text-rose-800" },
  work: { dot: "bg-slate-500", text: "text-slate-800" },
};""",
    s,
    count=1,
)

# 5) Replace Badge() function (keep all usage sites intact)
re_badge_fn = re.compile(r"function Badge\([\s\S]*?\n\}\n\nexport default function ConnectionsPage", re.M)
if not re_badge_fn.search(s):
    raise SystemExit("ERROR: Could not find Badge() block anchored before ConnectionsPage.")
s = re_badge_fn.sub(
    """function Badge({ children, side }: { children: React.ReactNode; side: SideKey }) {
  const t = SIDE_STAMP[side];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} aria-hidden="true" />
      <span className={cn("font-extrabold", t.text)}>{children}</span>
    </span>
  );
}

export default function ConnectionsPage""",
    s,
    count=1,
)

s += "\n\n// sd_949_connections_directional_ui_safe\n"

if s == orig:
    raise SystemExit("ERROR: no changes applied (file drifted).")

p.write_text(s, encoding="utf-8")
print("✅ Patched:", str(p))
PY

echo ""
echo "✅ $NAME applied."
echo "Backup: $BK"
echo ""
echo "Now run:"
echo "  ./verify_overlays.sh"
echo "  bash scripts/run_tests.sh --smoke"
