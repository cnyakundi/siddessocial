#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_969_sidefeed_advanced_gate_dev_and_public_tune"
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

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/SideFeed.tsx")
s = p.read_text(encoding="utf-8")

MARK = "sd_969_sidefeed_advanced_gate_dev_and_public_tune"

# 0) small code-dirt fixes (safe, compile-neutral)
s = s.replace('"use client";import React', '"use client";\n\nimport React', 1)
s = s.replace('FeedComposerRow";import type', 'FeedComposerRow";\nimport type', 1)

# 1) Insert advanced flag after `const sp = useSearchParams();`
if "const advanced =" not in s:
  m = re.search(r'^\s*const\s+sp\s*=\s*useSearchParams\(\);\s*$', s, flags=re.M)
  if not m:
    raise SystemExit("ERROR: could not find `const sp = useSearchParams();` in SideFeed.tsx")
  insert = m.group(0) + f'\n  const advanced = (sp.get("advanced") || "").trim() === "1"; // {MARK}\n'
  s = s[:m.start()] + insert + s[m.end():]

# 2) Gate DEV FEED_V2 badge behind advanced
# from: process.env.NODE_ENV !== "production" ? (
# to:   process.env.NODE_ENV !== "production" && advanced ? (
s = s.replace(
  'process.env.NODE_ENV !== "production" ? (',
  'process.env.NODE_ENV !== "production" && advanced ? (',
  1
)

# 3) Circle "New" behavior:
# - dev + advanced => Import sheet
# - otherwise => /siddes-circles?create=1
s = s.replace(
  'if (process.env.NODE_ENV !== "production") setImportOpen(true);',
  'if (process.env.NODE_ENV !== "production" && advanced) setImportOpen(true);',
  1
)

# 4) Public tune button: Topics normal; Trust/Counts only if advanced
s = s.replace(
  'side === "public" && (FLAGS.publicChannels || FLAGS.publicTrustDial || FLAGS.publicCalmUi)',
  'side === "public" && (FLAGS.publicChannels || (advanced && (FLAGS.publicTrustDial || FLAGS.publicCalmUi)))'
)

# 5) PublicTuneSheet props: Trust/Counts are advanced-only
s = s.replace(
  'showTrust={side === "public" && FLAGS.publicTrustDial}',
  'showTrust={side === "public" && FLAGS.publicTrustDial && advanced}'
)
s = s.replace(
  'showCounts={side === "public" && FLAGS.publicCalmUi}',
  'showCounts={side === "public" && FLAGS.publicCalmUi && advanced}'
)

# marker at top
if '"use client";' in s and MARK not in s:
  s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed: gate DEV badge + dev import sheet behind ?advanced=1; Public Tune shows Topics normally; Trust/Counts only in advanced mode.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates (don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - /siddes-feed (dev): DEV FEED_V2 badge should NOT show"
echo "  - /siddes-feed?advanced=1 (dev): DEV badge SHOULD show"
echo "  - Public: Tune shows Topics normally; Trust/Counts only appear with ?advanced=1"
echo "  - Circles: New Circle opens Import sheet only with ?advanced=1; otherwise goes to /siddes-circles?create=1"
