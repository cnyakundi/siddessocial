#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_954_feed_empty_state_single_cta"
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

MARK = "sd_954_feed_empty_state_single_cta"
if MARK in s:
    print("SKIP: sd_954 already applied.")
    raise SystemExit(0)

# 1) Remove onCreateSet from EmptyState signature
sig_re = re.compile(
    r'function\s+EmptyState\(\{\s*side,\s*onCreateSet,\s*composeHref,\s*canPost\s*\}\s*:\s*\{\s*side:\s*SideId;\s*onCreateSet\?:\s*\(\)\s*=>\s*void;\s*composeHref\?:\s*string;\s*canPost\?:\s*boolean\s*\}\s*\)\s*\{'
)

m = sig_re.search(s)
if not m:
    raise SystemExit("ERROR: Could not find EmptyState signature with onCreateSet (file shape changed).")

s = s[:m.start()] + (
    f'function EmptyState({{ side, composeHref, canPost }}: {{ side: SideId; composeHref?: string; canPost?: boolean }}) {{\n'
    f'  // {MARK}: empty state should be single-CTA (circle creation lives in Circle picker/siddes-circles)\n'
) + s[m.end():]

# 2) Remove the Create Circle button block in EmptyState
btn_re = re.compile(r'\n\s*\{side\s*!==\s*"public"\s*\?\s*\(\s*<button[\s\S]*?>\s*Create Circle\s*</button>\s*\)\s*:\s*null\}\s*', re.M)
s2, n = btn_re.subn("\n", s, count=1)
if n != 1:
    # The JSX is slightly different (your file uses `(<button ...>) : null` in one line)
    btn_re2 = re.compile(r'\n\s*\{side\s*!==\s*"public"\s*\?\s*\(<button[\s\S]*?Create Circle[\s\S]*?\)\s*:\s*null\}\s*', re.M)
    s2, n2 = btn_re2.subn("\n", s, count=1)
    if n2 != 1:
        raise SystemExit("ERROR: Could not remove Create Circle button block (pattern not found).")
    s = s2
else:
    s = s2

# 3) Remove onCreateSet prop from EmptyState call site
# Current call resembles: <EmptyState ... onCreateSet={() => { ... }} />
call_re = re.compile(r'\s+onCreateSet=\{\(\)\s*=>\s*\{[\s\S]*?\}\}\s*', re.M)
s3, n3 = call_re.subn("\n", s, count=1)
if n3 != 1:
    raise SystemExit(f"ERROR: Could not remove onCreateSet prop at call site (expected 1, got {n3}).")
s = s3

# 4) Sanity: no leftover onCreateSet references
if "onCreateSet" in s:
    raise SystemExit("ERROR: leftover onCreateSet reference remains after patch.")

# Marker at top for easy detection
if '"use client";' in s and MARK not in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** SideFeed EmptyState: remove secondary 'Create Circle' CTA; keep single primary action; circle creation stays in Circle picker / Circles page.\n" "$SD_ID" >> "$STATE"
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
echo "  - /siddes-feed (Friends/Close/Work with 0 posts): only one CTA (New Post / Sign in)"
echo "  - Circle creation is available from the Circle picker / /siddes-circles"
