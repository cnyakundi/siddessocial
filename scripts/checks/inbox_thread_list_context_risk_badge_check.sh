#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Inbox thread list context risk badge =="

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

if grep -q "ContextRiskBadge" "$PAGE"   && grep -q "Context Risk" "$PAGE"   && grep -q "isPrivate" "$PAGE"; then
  echo "✅ Context risk badge present + conditional"
  exit 0
fi

# Allow testid-only marker as a fallback (still requires being wired somewhere)
if grep -q 'data-testid="context-risk"' "$PAGE"; then
  echo "✅ Context risk badge present (testid)"
  exit 0
fi

echo "❌ Context risk badge missing or not conditional"
exit 1
