#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT/frontend" ] || [ ! -d "$ROOT/backend" ]; then
  echo "ERROR: Run from repo root (must contain frontend/ and backend/), or pass repo root."
  echo "Usage: $0 /path/to/sidesroot"
  exit 1
fi

cd "$ROOT"

FILE="frontend/src/app/u/[username]/page.tsx"
if [ ! -f "$FILE" ]; then
  echo "ERROR: Missing $FILE"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_sd_975_fix_profile_follow_counts_redeclare_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

PYBIN=""
if command -v python3 >/dev/null 2>&1; then PYBIN="python3";
elif command -v python >/dev/null 2>&1; then PYBIN="python";
else
  echo "ERROR: python3 (or python) is required."
  exit 1
fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

path = Path("frontend/src/app/u/[username]/page.tsx")
t = path.read_text(encoding="utf-8")

orig = t

# 1) Remove sd_957 duplicate state vars (only the injected block)
if "// sd_957: public follow counts" in t:
    t = re.sub(
        r"\n\s*// sd_957: public follow counts \(Public graph\)\s*\n"
        r"\s*const\s*\[publicFollowers,\s*setPublicFollowers\]\s*=\s*useState(?:<[^>]+>)?\(null\);\s*\n"
        r"\s*const\s*\[publicFollowing,\s*setPublicFollowing\]\s*=\s*useState(?:<[^>]+>)?\(null\);\s*\n",
        "\n",
        t,
        count=1,
        flags=re.M,
    )

# 2) Remove sd_957 injected useEffect fetch block
if "sd_957_load_public_follow_counts" in t:
    t = re.sub(
        r"\n\s*// sd_957_load_public_follow_counts\s*\n"
        r"\s*useEffect\(\(\)\s*=>\s*\{[\s\S]*?\n\s*\},\s*\[[^\]]*\]\);\s*\n",
        "\n",
        t,
        count=1,
        flags=re.M,
    )

# 3) If useEffect is now only in the import line, remove it from react import
occ = len(re.findall(r"\buseEffect\b", t))
if occ == 1:
    # Handle: import React, { useEffect, useMemo, useState } from "react";
    m = re.search(r'^(import\s+React\s*,\s*\{\s*)([^}]*)(\}\s*from\s*["\']react["\']\s*;)\s*$',
                  t, flags=re.M)
    if m:
        items = [x.strip() for x in m.group(2).split(",") if x.strip()]
        items = [x for x in items if x != "useEffect"]
        new_mid = ", ".join(items)
        t = t[:m.start()] + (m.group(1) + new_mid + " " + m.group(3)) + t[m.end():]

    # Handle: import { useEffect, useMemo } from "react";
    m2 = re.search(r'^(import\s*\{\s*)([^}]*)(\}\s*from\s*["\']react["\']\s*;)\s*$',
                   t, flags=re.M)
    if m2:
        items = [x.strip() for x in m2.group(2).split(",") if x.strip()]
        if "useEffect" in items:
            items = [x for x in items if x != "useEffect"]
            if items:
                new_mid = ", ".join(items)
                t = t[:m2.start()] + (m2.group(1) + new_mid + " " + m2.group(3)) + t[m2.end():]

# 4) Sanity: ensure we don’t still have BOTH state + const declarations
has_state = re.search(r"\bconst\s*\[\s*publicFollowers\s*,", t) is not None
has_const = re.search(r"\bconst\s+publicFollowers\b", t) is not None
if has_state and has_const:
    raise SystemExit("ERROR: sd_975: Still seeing both state + const publicFollowers. Paste the top ~120 lines of page.tsx.")

has_state2 = re.search(r"\bconst\s*\[\s*publicFollowing\s*,", t) is not None
has_const2 = re.search(r"\bconst\s+publicFollowing\b", t) is not None
if has_state2 and has_const2:
    raise SystemExit("ERROR: sd_975: Still seeing both state + const publicFollowing. Paste the top ~120 lines of page.tsx.")

if t == orig:
    print("OK: No changes needed (sd_975 found nothing to remove).")
else:
    path.write_text(t, encoding="utf-8")
    print("OK: Patched page.tsx (removed duplicate sd_957 follow count state/effect).")
PY

echo ""
echo "✅ sd_975 applied."
echo "Backup: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  cd .. && ./verify_overlays.sh"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
