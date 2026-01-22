#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Compose intent refinements =="

F_INTENT="frontend/src/lib/composeIntent.ts"
F_BAR="frontend/src/components/ComposeSuggestionBar.tsx"

[[ -f "$F_INTENT" ]] || { echo "❌ Missing: $F_INTENT"; exit 1; }
[[ -f "$F_BAR" ]] || { echo "❌ Missing: $F_BAR"; exit 1; }

echo "✅ $F_INTENT"
echo "✅ $F_BAR"

# Ensure suggestion bar is wired to computeComposeSuggestions.
grep -q "computeComposeSuggestions" "$F_BAR" || { echo "❌ ComposeSuggestionBar not wired to computeComposeSuggestions"; exit 1; }
echo "✅ Suggestion bar wired"

# Ensure confidence gating is present in composeIntent.
grep -q "confidence" "$F_INTENT" || { echo "❌ composeIntent missing confidence scoring"; exit 1; }
grep -q "confidence >=" "$F_INTENT" || { echo "❌ composeIntent missing confidence thresholds"; exit 1; }
echo "✅ Confidence gating present"

# Ensure we are NOT leaking internal "Why:" debug tooltips in UI.
if grep -q "Why:" "$F_BAR"; then
  echo "❌ Internal 'Why:' tooltip text detected in ComposeSuggestionBar"; exit 1
fi

echo "✅ No internal tooltips leaked"
