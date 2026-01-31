#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_947_sidefeed_public_tune_declutter"
FILE="frontend/src/components/SideFeed.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE (run from repo root)"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$FILE" "$BK/SideFeed.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

PYBIN="python3"
if ! command -v "$PYBIN" >/dev/null 2>&1; then PYBIN="python"; fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/SideFeed.tsx")
s = p.read_text(encoding="utf-8")

MARK = "sd_947_sidefeed_public_tune_declutter"
if MARK in s:
    print("SKIP: sd_947 already applied.")
    raise SystemExit(0)

# 1) Insert advanced flag right after `const sp = useSearchParams();`
m = re.search(r'^\s*const\s+sp\s*=\s*useSearchParams\(\);\s*$', s, flags=re.M)
if not m:
    raise SystemExit("ERROR: Could not find `const sp = useSearchParams();` in SideFeed.tsx")

insert = (
    m.group(0)
    + f"\n  const advanced = (sp.get(\"advanced\") || \"\").trim() === \"1\"; // {MARK}\n"
)
s = s[:m.start()] + insert + s[m.end():]

# 2) Gate any dev-only UI blocks behind advanced (safe within SideFeed only)
# This keeps dev badges/tools out of normal UX.
s = s.replace(
    'process.env.NODE_ENV !== "production" ? (',
    'process.env.NODE_ENV !== "production" && advanced ? ('
)

# 3) Public Tune button: show only if Topics are enabled, OR (advanced && (Trust/Counts enabled))
# (This reduces header clutter for normal users.)
s = s.replace(
    'side === "public" && (FLAGS.publicChannels || FLAGS.publicTrustDial || FLAGS.publicCalmUi)',
    'side === "public" && (FLAGS.publicChannels || (advanced && (FLAGS.publicTrustDial || FLAGS.publicCalmUi)))'
)

# 4) PublicTuneSheet props: Trust/Counts become advanced-only controls
s = s.replace(
    'showTrust={side === "public" && FLAGS.publicTrustDial}',
    'showTrust={side === "public" && FLAGS.publicTrustDial && advanced}'
)
s = s.replace(
    'showCounts={side === "public" && FLAGS.publicCalmUi}',
    'showCounts={side === "public" && FLAGS.publicCalmUi && advanced}'
)

# 5) (Optional hygiene) fix an existing same-line declaration dirt if present:
s = s.replace("}, [rawPosts]);  const [nextCursor", "}, [rawPosts]);\n  const [nextCursor")

# Add a small marker comment near top so we can detect later
if '"use client";' in s and MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed: Public Tune declutter — Topics normal; Trust+Counts only when ?advanced=1; gate dev-only UI behind advanced.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - /siddes-feed?side=public -> Tune only shows if Topics are enabled (normal UX)"
echo "  - /siddes-feed?side=public&advanced=1 -> Trust/Counts controls appear"
