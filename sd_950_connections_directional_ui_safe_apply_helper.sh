#!/usr/bin/env bash
set -euo pipefail

NAME="sd_950_connections_directional_ui_safe"
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

if "sd_950_connections_directional_ui_safe" in s:
    print("ℹ️ sd_950 already applied; no changes made.")
    raise SystemExit(0)

# --- 1) Tabs: keep ids, change labels (robust regex) ---
s = re.sub(r'(\{\s*id:\s*"followers"\s*,\s*label:\s*")[^"]+(")',
           r'\1They → You\2', s, count=1)
s = re.sub(r'(\{\s*id:\s*"following"\s*,\s*label:\s*")[^"]+(")',
           r'\1You → Them\2', s, count=1)

# --- 2) Explainer copy (directional) ---
s = s.replace(
    "Followers are people who placed you into Friends/Close/Work. Following are people you placed into your Sides.",
    "They → You: people who placed you into Friends/Close/Work. You → Them: people you placed into your Sides.",
)

# --- 3) Empty states (kill twitter-brain words) ---
s = s.replace("No followers yet.", "No one has added you to their Sides yet.")
s = s.replace("You aren’t following anyone yet.", "You haven’t added anyone to your Sides yet.")

# --- 4) Badge: make it calm (dot + bold text), keep old mappings referenced if they exist ---
# Detect existing mapping name to keep it "used" (avoids TS noUnusedLocals failures).
mapping_name = None
for cand in ["SIDE_BADGE", "SIDE_STAMP", "SIDE_TAG", "SIDE_STYLE"]:
    if f"const {cand}" in s:
        mapping_name = cand
        break

badge_pattern = re.compile(r"function Badge\([\s\S]*?\n\}\n\nexport default function ConnectionsPage", re.M)
m = badge_pattern.search(s)
if not m:
    raise SystemExit("ERROR: Could not find Badge() block anchored before ConnectionsPage.")

if mapping_name:
    badge_code = f'''function Badge({{ children, side }}: {{ children: React.ReactNode; side: SideKey }}) {{
  // sd_950: calm stamp (dot + text). We keep {mapping_name} referenced to avoid unused-const TS errors.
  const DOT: Record<SideKey, string> = {{
    friends: "bg-emerald-500",
    close: "bg-rose-500",
    work: "bg-slate-500",
  }};
  const FALLBACK_TEXT: Record<SideKey, string> = {{
    friends: "text-emerald-800",
    close: "text-rose-800",
    work: "text-slate-800",
  }};

  const raw: any = ({mapping_name} as any)[side];

  const textClass =
    typeof raw === "string"
      ? (String(raw).split(" ").find((c: string) => c.startsWith("text-")) || FALLBACK_TEXT[side])
      : (raw && typeof raw === "object" && raw.text ? String(raw.text) : FALLBACK_TEXT[side]);

  const dotClass = raw && typeof raw === "object" && raw.dot ? String(raw.dot) : DOT[side];

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={{cn("w-1.5 h-1.5 rounded-full", dotClass)}} aria-hidden="true" />
      <span className={{cn("font-extrabold", textClass)}}>{{children}}</span>
    </span>
  );
}}

export default function ConnectionsPage'''
else:
    badge_code = '''function Badge({ children, side }: { children: React.ReactNode; side: SideKey }) {
  // sd_950: calm stamp (dot + text)
  const DOT: Record<SideKey, string> = {
    friends: "bg-emerald-500",
    close: "bg-rose-500",
    work: "bg-slate-500",
  };
  const TEXT: Record<SideKey, string> = {
    friends: "text-emerald-800",
    close: "text-rose-800",
    work: "text-slate-800",
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={cn("w-1.5 h-1.5 rounded-full", DOT[side])} aria-hidden="true" />
      <span className={cn("font-extrabold", TEXT[side])}>{children}</span>
    </span>
  );
}

export default function ConnectionsPage'''

s = badge_pattern.sub(badge_code, s, count=1)

s += "\n\n// sd_950_connections_directional_ui_safe\n"

if s == orig:
    raise SystemExit("ERROR: No changes applied (file drifted).")

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
