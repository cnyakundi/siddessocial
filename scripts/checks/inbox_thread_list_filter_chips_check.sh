#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list filter chips =="

REQ=("frontend/src/app/siddes-inbox/page.tsx")

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

PAGE="frontend/src/app/siddes-inbox/page.tsx"

# Prefer stable testids
if grep -q 'data-testid="inbox-filter-chips"' "$PAGE"   && grep -q 'data-testid="chip-all"' "$PAGE"   && grep -q 'data-testid="chip-this"' "$PAGE"   && grep -q 'data-testid="chip-mismatch"' "$PAGE"; then
  echo "✅ Filter chips present + wired (testids)"
  exit 0
fi

# Legacy fallback
if grep -q "FilterChipsRow" "$PAGE"   && grep -q "This Side" "$PAGE"   && grep -q "Mismatched" "$PAGE"   && grep -q 'filter === "this"' "$PAGE"   && grep -q 'filter === "all"' "$PAGE"; then
  echo "✅ Filter chips present + wired (legacy)"
else
  echo "❌ Filter chips missing or not wired"
  exit 1
fi
