#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_948_feed_empty_state_single_cta"
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

MARK = "sd_948_feed_empty_state_single_cta"
if MARK in s:
    print("SKIP: sd_948 already applied.")
    raise SystemExit(0)

# 1) Update EmptyState signature (remove onCreateSet to avoid unused lint)
sig_pat = r'function EmptyState\(\{ side, onCreateSet, composeHref, canPost \}: \{ side: SideId; onCreateSet\?: \(\) => void; composeHref\?: string; canPost\?: boolean \} \) \{'
if re.search(sig_pat, s):
    s = re.sub(
        sig_pat,
        f'function EmptyState({{ side, composeHref, canPost }}: {{ side: SideId; composeHref?: string; canPost?: boolean }}) {{\n  // {MARK}',
        s,
        count=1
    )
else:
    # Slightly looser fallback (in case whitespace differs)
    sig_pat2 = r'function EmptyState\(\{[^}]*onCreateSet[^}]*\}\s*:\s*\{\s*side:\s*SideId;\s*onCreateSet\?:\s*\(\)\s*=>\s*void;\s*composeHref\?:\s*string;\s*canPost\?:\s*boolean\s*\}\s*\)\s*\{'
    if not re.search(sig_pat2, s):
        raise SystemExit("ERROR: Could not find EmptyState signature with onCreateSet.")
    s = re.sub(
        sig_pat2,
        f'function EmptyState({{ side, composeHref, canPost }}: {{ side: SideId; composeHref?: string; canPost?: boolean }}) {{\n  // {MARK}',
        s,
        count=1
    )

# 2) Remove the Create Circle button block in EmptyState
btn_pat = r'\n\s*\{side\s*!==\s*"public"\s*\?\s*\(<button[\s\S]*?Create Circle[\s\S]*?\)\s*:\s*null\}\s*'
s2, n = re.subn(btn_pat, "\n", s, count=1)
if n != 1:
    raise SystemExit("ERROR: Could not remove Create Circle button block (pattern not found exactly once).")
s = s2

# 3) Remove onCreateSet prop from EmptyState call site (avoids passing unused + keeps JSX clean)
call_pat = r'\s+onCreateSet=\{\(\)\s*=>\s*\{[\s\S]*?\}\}\s*'
# There should be exactly one call site
s, n = re.subn(call_pat, "\n", s, count=1)
if n != 1:
    raise SystemExit(f"ERROR: Could not remove onCreateSet prop at call site (expected 1, got {n}).")

# Add marker near top
if '"use client";' in s and MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed EmptyState: remove secondary 'Create Circle' CTA; keep single primary action for clarity; creation stays in Circle picker/siddes-circles.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
