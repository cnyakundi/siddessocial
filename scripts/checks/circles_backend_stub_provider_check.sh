#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Circles backend_stub provider wiring =="

REQ=(
  "frontend/src/lib/setsProviders/backendStub.ts"
  "frontend/src/lib/setsProvider.ts"
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

grep -q "export const backendStubProvider" frontend/src/lib/setsProviders/backendStub.ts && echo "✅ backendStubProvider exported" || (echo "❌ backendStubProvider missing export" && exit 1)
grep -q "/api/circles" frontend/src/lib/setsProviders/backendStub.ts && echo "✅ backendStubProvider calls /api/circles" || (echo "❌ backendStubProvider not calling /api/circles" && exit 1)

grep -q "backendStubProvider" frontend/src/lib/setsProvider.ts && echo "✅ setsProvider imports backendStubProvider" || (echo "❌ setsProvider missing backendStubProvider import" && exit 1)
grep -q 'mode === "backend_stub"' frontend/src/lib/setsProvider.ts && echo "✅ setsProvider switches on backend_stub" || (echo "❌ setsProvider missing backend_stub switch" && exit 1)

grep -q "sd_135c" docs/STATE.md && echo "✅ STATE doc mentions sd_135c" || (echo "❌ docs/STATE.md missing sd_135c" && exit 1)
