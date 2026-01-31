#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_922_fix_reltag_connections_typecheck"
TARGET="frontend/src/app/siddes-profile/connections/page.tsx"

if [ ! -f "$TARGET" ]; then
  echo "❌ Missing: $TARGET"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$TARGET")"
cp -a "$TARGET" "$BK/$TARGET"

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8")
orig = s

# If already defined, stop.
if "function RelTag(" in s or "const RelTag" in s:
    print("OK: RelTag already exists (no changes).")
    raise SystemExit(0)

# Only patch if it's actually used.
if "<RelTag" not in s:
    print("OK: No <RelTag ...> usage found (no changes).")
    raise SystemExit(0)

# Insert before the first export default function (robust).
idx = s.find("export default function")
if idx < 0:
    raise SystemExit("ERROR: Could not find `export default function` in connections page.")

insert = """
// sd_922_fix_reltag_connections_typecheck: RelTag was referenced but not defined.
// Keep it tiny + calm (dot + direction + side label).
function RelTag({ side, who }: { side: SideKey; who: "You" | "Them" | "They" }) {
  const dot =
    side === "friends" ? "bg-emerald-500" : side === "close" ? "bg-rose-500" : "bg-slate-500";

  const text =
    side === "friends" ? "text-emerald-800" : side === "close" ? "text-rose-800" : "text-slate-800";

  const label = (typeof (SIDE_LABEL as any)?.[side] === "string" ? (SIDE_LABEL as any)[side] : String(side));

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span className="text-gray-400 font-extrabold">{who}</span>
      <span className="text-gray-300">→</span>
      <span className={`font-extrabold ${text}`}>{label}</span>
    </span>
  );
}

"""

s = s[:idx] + insert + s[idx:]

if "sd_922_fix_reltag_connections_typecheck" not in s:
    s += "\n\n// sd_922_fix_reltag_connections_typecheck\n"

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("✅ Patched:", str(p))
else:
    print("ℹ️ No changes.")
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
