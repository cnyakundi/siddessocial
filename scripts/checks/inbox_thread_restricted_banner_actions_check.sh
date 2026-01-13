#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread restricted banner actions =="

REQ=(
  "frontend/src/components/InboxBanner.tsx"
  "frontend/src/app/siddes-inbox/[id]/page.tsx"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ -f "$f" ]]; then
    echo "✅ $f"
  else
    echo "❌ Missing: $f"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

FILE="frontend/src/app/siddes-inbox/[id]/page.tsx"

if grep -q 'data-testid="restricted-thread-banner"' "$FILE" \
  && grep -q 'data-testid="restricted-thread-actions"' "$FILE" \
  && grep -q 'data-testid="restricted-thread-retry-me"' "$FILE" \
  && grep -q 'data-testid="restricted-thread-clear-viewer"' "$FILE" \
  && grep -q 'data-testid="restricted-thread-back-inbox"' "$FILE"; then
  echo "✅ Restricted thread banner actions present"
else
  echo "❌ Restricted thread banner actions missing"
  exit 1
fi

# Ensure composer is gated when restricted
if grep -q 'disabled={restricted}' "$FILE" && grep -q 'Restricted — retry as me' "$FILE"; then
  echo "✅ Composer disabled + copy present for restricted threads"
else
  echo "❌ Composer gating for restricted threads missing"
  exit 1
fi
