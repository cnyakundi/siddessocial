#!/usr/bin/env bash
set -euo pipefail

NAME="sd_948b_connections_directional_ui_safe"
TARGET="frontend/src/app/siddes-profile/connections/page.tsx"

if [ ! -f "$TARGET" ]; then
  echo "❌ Missing: $TARGET"
  echo "Run from repo root (folder containing frontend/ and backend/)."
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

if "sd_948b_connections_directional_ui_safe" in s:
    print("ℹ️ sd_948b already applied; no changes made.")
    raise SystemExit(0)

# 1) Tabs: keep ids, change labels
s = re.sub(r'(id:\s*"followers"\s*,\s*label:\s*")[^"]+(")', r'\1They → You\2', s)
s = re.sub(r'(id:\s*"following"\s*,\s*label:\s*")[^"]+(")', r'\1You → Them\2', s)

# 2) Header explainer copy (directional)
s = s.replace(
    "Followers are people who placed you into Friends/Close/Work. Following are people you placed into your Sides.",
    "They → You: people who placed you into Friends/Close/Work. You → Them: people you placed into your Sides.",
)

# 3) Empty states (kill twitter-brain words)
s = s.replace("No followers yet.", "No one has added you to their Sides yet.")
s = s.replace("You aren’t following anyone yet.", "You haven’t added anyone to your Sides yet.")

# 4) Calm badges WITHOUT replacing <Badge> usages:
#    - rename existing Badge -> BadgePill
#    - insert new minimal Badge (dot + children) above it
if "function BadgePill(" not in s:
    if "function Badge(" not in s:
        raise SystemExit("ERROR: Could not find `function Badge(` in connections page.tsx")
    s = s.replace("function Badge(", "function BadgePill(", 1)

idx = s.find("function BadgePill(")
if idx < 0:
    raise SystemExit("ERROR: Could not locate `function BadgePill(` after rename")

insert = """// sd_948b_connections_directional_ui_safe: make relationship tags calm (dot + text), keep all call sites.
const SIDE_DOT: Record<SideKey, string> = {
  friends: "bg-emerald-500",
  close: "bg-rose-500",
  work: "bg-slate-500",
};

function Badge({ children, side }: { children: React.ReactNode; side: SideKey }) {
  const dot = SIDE_DOT[side] || "bg-gray-300";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={"w-1.5 h-1.5 rounded-full " + dot} aria-hidden="true" />
      <span className="text-gray-700">{children}</span>
    </span>
  );
}

"""

s = s[:idx] + insert + s[idx:]

# Marker
s += "\n\n// sd_948b_connections_directional_ui_safe\n"

if s == orig:
    raise SystemExit("ERROR: No changes applied (file may have drifted).")

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
