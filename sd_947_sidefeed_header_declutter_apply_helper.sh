#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_947_sidefeed_header_declutter"
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

MARK = "sd_947_sidefeed_header_declutter"
if MARK in s:
    print("SKIP: sd_947 already applied.")
    raise SystemExit(0)

# 1) Add `advanced` right after `const sp = useSearchParams();`
anchor = "  const sp = useSearchParams();"
if anchor not in s:
    raise SystemExit("ERROR: Could not find `const sp = useSearchParams();` in SideFeed.tsx")

if "const advanced =" not in s:
    s = s.replace(
        anchor,
        anchor + f'\n  const advanced = (sp.get("advanced") || "").trim() === "1"; // {MARK}\n',
        1,
    )

# 2) Gate DEV badge behind advanced (dev-only UI should never show unless asked)
# From: {process.env.NODE_ENV !== "production" ? ( ... ) : null}
# To:   {process.env.NODE_ENV !== "production" && advanced ? ( ... ) : null}
s = s.replace(
    'process.env.NODE_ENV !== "production" ? (',
    'process.env.NODE_ENV !== "production" && advanced ? (',
    1,
)

# 3) Ensure CircleFilterBar gets currentSide={side} (avoid 0-circles side weirdness)
if "currentSide={side}" not in s:
    s = s.replace("activeSet={activeSet}\n", "activeSet={activeSet}\n      currentSide={side}\n", 1)

# 4) Gate the dev-only import flow behind advanced (otherwise always route to circles create)
s = s.replace(
    'if (process.env.NODE_ENV !== "production") setImportOpen(true);',
    'if (process.env.NODE_ENV !== "production" && advanced) setImportOpen(true);',
    1,
)

# 5) Public Tune button: Topics normal; Trust+Counts only when advanced
s = s.replace(
    'side === "public" && (FLAGS.publicChannels || FLAGS.publicTrustDial || FLAGS.publicCalmUi)',
    'side === "public" && (FLAGS.publicChannels || (advanced && (FLAGS.publicTrustDial || FLAGS.publicCalmUi)))',
    1,
)

# 6) PublicTuneSheet: Trust + Counts only when advanced
s = s.replace(
    'showTrust={side === "public" && FLAGS.publicTrustDial}',
    'showTrust={side === "public" && FLAGS.publicTrustDial && advanced}',
    1,
)
s = s.replace(
    'showCounts={side === "public" && FLAGS.publicCalmUi}',
    'showCounts={side === "public" && FLAGS.publicCalmUi && advanced}',
    1,
)

# Marker near top
if '"use client";' in s and MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed: gate DEV badge + dev import behind ?advanced=1; Public Tune shows Topics normally; Trust/Counts only in advanced mode.\n" "$SD_ID" >> "$STATE"
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
echo "  - /siddes-feed (dev): DEV badge should NOT show"
echo "  - /siddes-feed?advanced=1 (dev): DEV badge SHOULD show"
echo "  - /siddes-feed?side=public: Tune should only reflect Topics normally"
echo "  - /siddes-feed?side=public&advanced=1: Trust + Counts controls appear"
