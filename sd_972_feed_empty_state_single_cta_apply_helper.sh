#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_972_feed_empty_state_single_cta"
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
orig = s

MARK = "sd_972_feed_empty_state_single_cta"

# 1) Update EmptyState signature: remove onCreateSet
sig1 = re.compile(
    r'function\s+EmptyState\(\{\s*side\s*,\s*onCreateSet\s*,\s*composeHref\s*,\s*canPost\s*\}\s*:\s*\{\s*side:\s*SideId;\s*onCreateSet\?:\s*\(\)\s*=>\s*void;\s*composeHref\?:\s*string;\s*canPost\?:\s*boolean\s*\}\s*\)\s*\{'
)
if sig1.search(s):
    s = sig1.sub(
        'function EmptyState({ side, composeHref, canPost }: { side: SideId; composeHref?: string; canPost?: boolean }) {\n  // sd_972: empty state should be single-CTA; circle creation lives in Circle picker / Circles page',
        s,
        count=1
    )
else:
    # fallback if spacing differs but still contains onCreateSet
    sig2 = re.compile(r'function\s+EmptyState\(\{[^}]*onCreateSet[^}]*\}\s*:\s*\{[^}]*onCreateSet\?:\s*\(\)\s*=>\s*void;[^}]*\}\s*\)\s*\{', re.M)
    if not sig2.search(s):
        raise SystemExit("ERROR: Could not find EmptyState signature containing onCreateSet.")
    s = sig2.sub(
        'function EmptyState({ side, composeHref, canPost }: { side: SideId; composeHref?: string; canPost?: boolean }) {\n  // sd_972: empty state should be single-CTA; circle creation lives in Circle picker / Circles page',
        s,
        count=1
    )

# 2) Remove the "Create Circle" CTA block inside EmptyState
btn_re = re.compile(
    r'\n\s*\{side\s*!==\s*"public"\s*\?\s*\(\s*<button[\s\S]*?>\s*Create Circle\s*</button>\s*\)\s*:\s*null\}\s*',
    re.M
)
s2, n = btn_re.subn("\n", s, count=1)
if n != 1:
    # match the exact inline parentheses style in your file
    btn_re2 = re.compile(r'\n\s*\{side\s*!==\s*"public"\s*\?\s*\(<button[\s\S]*?Create Circle[\s\S]*?\)\s*:\s*null\}\s*', re.M)
    s2, n2 = btn_re2.subn("\n", s, count=1)
    if n2 != 1:
        raise SystemExit("ERROR: Could not remove Create Circle block (pattern not found).")
    s = s2
else:
    s = s2

# 3) Remove onCreateSet prop from EmptyState call site
call_re = re.compile(r'\s+onCreateSet=\{\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\}\s*\}\s*', re.M)
s3, n3 = call_re.subn("\n", s, count=1)
if n3 != 1:
    # Some versions have no spaces: onCreateSet={() => { ... }}
    call_re2 = re.compile(r'\s+onCreateSet=\{\(\)\s*=>\s*\{[\s\S]*?\}\}\s*', re.M)
    s3, n3b = call_re2.subn("\n", s, count=1)
    if n3b != 1:
        raise SystemExit(f"ERROR: Could not remove onCreateSet prop at call site (expected 1, got {n3 + n3b}).")
    s = s3
else:
    s = s3

# 4) Ensure no leftover onCreateSet references remain
if "onCreateSet" in s:
    raise SystemExit("ERROR: leftover onCreateSet remains after patch.")

# marker at top
if '"use client";' in s and MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

if s == orig:
    raise SystemExit("ERROR: No changes made (unexpected).")

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed EmptyState: remove secondary 'Create Circle' CTA; keep single primary action; circle creation stays in Circle picker / Circles page.\n" "$SD_ID" >> "$STATE"
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
echo "  - Open /siddes-feed on Friends/Close/Work with 0 posts"
echo "  - You should see ONLY one CTA (New Post / Sign in), no Create Circle button"
