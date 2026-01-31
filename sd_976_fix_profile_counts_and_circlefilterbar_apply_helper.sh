#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_976_fix_profile_counts_and_circlefilterbar"
ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"

PFILE="frontend/src/app/u/[username]/page.tsx"
CF="frontend/src/components/CircleFilterBar.tsx"

echo "== ${SD_ID} =="
echo "Root: ${ROOT}"

[[ -d frontend ]] || { echo "❌ Missing frontend/ (run from repo root)"; exit 1; }
[[ -f "$PFILE" ]] || { echo "❌ Missing: $PFILE"; exit 1; }
[[ -f "$CF"    ]] || { echo "❌ Missing: $CF"; exit 1; }

mkdir -p "$BK"
cp -a "$PFILE" "$BK/u_profile.page.tsx.bak"
cp -a "$CF" "$BK/CircleFilterBar.tsx.bak"
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

# -----------------------------
# 1) Fix /u/[username]/page.tsx redeclare
# -----------------------------
p = Path("frontend/src/app/u/[username]/page.tsx")
s = p.read_text(encoding="utf-8")

# Only patch if BOTH forms exist:
# - state: const [publicFollowers, setPublicFollowers] ...
# - const: const publicFollowers = typeof (data as any)?.publicFollowers ...
has_state = bool(re.search(r'const\s*\[\s*publicFollowers\s*,\s*setPublicFollowers\s*\]\s*=\s*useState', s))
has_const = "const publicFollowers = typeof (data as any)?.publicFollowers" in s

if has_state and has_const:
    s = s.replace(
        "const publicFollowers = typeof (data as any)?.publicFollowers === \"number\" ? (data as any).publicFollowers : null;",
        "const publicFollowersFromServer = typeof (data as any)?.publicFollowers === \"number\" ? (data as any).publicFollowers : null;",
        1
    )
    s = s.replace(
        "const publicFollowing = typeof (data as any)?.publicFollowing === \"number\" ? (data as any).publicFollowing : null;",
        "const publicFollowingFromServer = typeof (data as any)?.publicFollowing === \"number\" ? (data as any).publicFollowing : null;",
        1
    )
    print("PATCHED:", str(p), "(renamed server consts to avoid redeclare)")
else:
    print("OK:", str(p), "(no redeclare pattern found; skipping)")

p.write_text(s, encoding="utf-8")

# -----------------------------
# 2) Fix CircleFilterBar theme primaryBg usage
# -----------------------------
cf = Path("frontend/src/components/CircleFilterBar.tsx")
t = cf.read_text(encoding="utf-8")

# Replace the exact problematic expression if present:
# (t?.primaryBg || "bg-gray-700").replace("text-", "bg-")
if "t?.primaryBg" in t:
    t = t.replace(
        '(t?.primaryBg || "bg-gray-700").replace("text-", "bg-")',
        '(t?.text || "text-gray-700").replace("text-", "bg-")'
    )
    print("PATCHED:", str(cf), "(primaryBg -> text->bg)")
else:
    # If it uses primaryBg in some other layout, rewrite any `t?.primaryBg` to `t?.text`
    t2 = t.replace("t?.primaryBg", "t?.text")
    if t2 != t:
        t = t2
        print("PATCHED:", str(cf), "(primaryBg -> text fallback)")
    else:
        print("OK:", str(cf), "(no primaryBg reference; skipping)")

cf.write_text(t, encoding="utf-8")
PY

echo ""
echo "== Gates (IMPORTANT: don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
