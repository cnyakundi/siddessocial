#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_951_connections_cleanup_badgepills"
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
import re

p = Path("frontend/src/app/siddes-profile/connections/page.tsx")
s = p.read_text(encoding="utf-8")
orig = s

# 1) Remove SIDE_BADGE pill styles (now unused if we delete BadgePill)
# Matches the whole const SIDE_BADGE = { ... };
s2, n1 = re.subn(
    r"\nconst\s+SIDE_BADGE:\s*Record<SideKey,\s*string>\s*=\s*\{[\s\S]*?\n\};\n",
    "\n",
    s,
    count=1,
)
s = s2
print("OK: removed SIDE_BADGE" if n1 else "SKIP: SIDE_BADGE not found")

# 2) Remove BadgePill() function (legacy pill badge)
s2, n2 = re.subn(
    r"\nfunction\s+BadgePill\([\s\S]*?\n\}\n",
    "\n",
    s,
    count=1,
)
s = s2
print("OK: removed BadgePill" if n2 else "SKIP: BadgePill not found")

# 3) Remove any trailing double blank lines created by deletions (small tidy)
s = re.sub(r"\n{3,}", "\n\n", s)

if "sd_951_connections_cleanup_badgepills" not in s:
    s += "\n\n// sd_951_connections_cleanup_badgepills\n"

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("✅ Patched:", str(p))
else:
    print("ℹ️ No changes (already clean).")
PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup: ${BK}"
echo ""
echo "Now run:"
echo "  ./verify_overlays.sh"
echo "  bash scripts/run_tests.sh --smoke"
