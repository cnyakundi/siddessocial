#!/usr/bin/env bash
set -euo pipefail

NAME="sd_948_connections_directional_ui"
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

path = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = path.read_text(encoding="utf-8")
orig = s

if "sd_948_connections_directional_ui" in s:
    print("ℹ️ sd_948 already applied; no changes made.")
    raise SystemExit(0)

# 1) Tabs labels (keep ids)
s = s.replace('{ id: "followers", label: "Followers", icon: Users },', '{ id: "followers", label: "They → You", icon: Users },')
s = s.replace('{ id: "following", label: "Following", icon: UserPlus },', '{ id: "following", label: "You → Them", icon: UserPlus },')

# 2) Header explainer copy
s = s.replace(
    "Followers are people who placed you into Friends/Close/Work. Following are people you placed into your Sides.",
    "They → You: people who placed you into Friends/Close/Work. You → Them: people you placed into your Sides.",
)

# 3) Empty state copy
s = s.replace("No followers yet.", "No one has added you to their Sides yet.")
s = s.replace("You aren’t following anyone yet.", "You haven’t added anyone to your Sides yet.")

# 4) Replace SIDE_BADGE -> SIDE_STAMP (calm dot + text)
re_badge = re.compile(r"const SIDE_BADGE:\s*Record<SideKey,\s*string>\s*=\s*\{[\s\S]*?\};", re.M)
if re_badge.search(s):
    s = re_badge.sub(
        """// sd_948_connections_directional_ui: calmer stamps instead of pill badges
const SIDE_STAMP: Record<SideKey, { dot: string; text: string }> = {
  friends: { dot: "bg-emerald-500", text: "text-emerald-800" },
  close: { dot: "bg-rose-500", text: "text-rose-800" },
  work: { dot: "bg-slate-500", text: "text-slate-800" },
};""",
        s,
        count=1,
    )
else:
    # If already renamed or modified, we proceed; the next step will fail safely if DirStamp can't be inserted.
    pass

# 5) Replace Badge() function with DirStamp()
re_badge_fn = re.compile(
    r"function Badge\(\{ children, side \}:\s*\{ children:\s*React\.ReactNode;\s*side:\s*SideKey\s*\}\)\s*\{\s*return\s*\([\s\S]*?\);\s*\}\s*\}",
    re.M,
)
if re_badge_fn.search(s):
    s = re_badge_fn.sub(
        """function DirStamp({ dir, side }: { dir: "You" | "Them"; side: SideKey }) {
  const t = SIDE_STAMP[side];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} aria-hidden="true" />
      <span className="text-gray-400 font-extrabold">{dir}</span>
      <span className="text-gray-300">→</span>
      <span className={cn("font-extrabold", t.text)}>{SIDE_LABEL[side]}</span>
    </span>
  );
}""",
        s,
        count=1,
    )

# 6) Replace all <Badge ...> usages with <DirStamp ...>
repls = [
    (r'<Badge side=\{m\.youSide\}>You → \{SIDE_LABEL\[m\.youSide\]\}</Badge>', '<DirStamp dir="You" side={m.youSide} />'),
    (r'<Badge side=\{m\.theySide\}>Them → \{SIDE_LABEL\[m\.theySide\]\}</Badge>', '<DirStamp dir="Them" side={m.theySide} />'),
    (r'<Badge side=\{it\.side\}>They → \{SIDE_LABEL\[it\.side\]\}</Badge>', '<DirStamp dir="Them" side={it.side} />'),
    (r'<Badge side=\{it\.side\}>You → \{SIDE_LABEL\[it\.side\]\}</Badge>', '<DirStamp dir="You" side={it.side} />'),
]
for pat, rep in repls:
    s2 = re.sub(pat, rep, s)
    s = s2

# Safety: no leftover Badge usage
if "<Badge " in s or "function Badge(" in s:
    raise SystemExit("ERROR: leftover <Badge> usage found; patch aborted to avoid half-state.")

# Add marker
s += "\n\n// sd_948_connections_directional_ui\n"

if s == orig:
    raise SystemExit("ERROR: no changes applied (file may have drifted).")

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
