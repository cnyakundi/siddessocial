#!/usr/bin/env bash
set -euo pipefail
echo "== Check: StubViewerCookie is gated (sd_153) =="
F="frontend/src/components/StubViewerCookie.tsx"
[[ -f "$F" ]] || { echo "❌ Missing: $F"; exit 1; }
echo "✅ $F"
grep -q "NEXT_PUBLIC_STUB_VIEWER" "$F" || { echo "❌ missing NEXT_PUBLIC_STUB_VIEWER gate"; exit 1; }
grep -q 'process.env.NODE_ENV === "production"' "$F" || { echo "❌ missing production guard"; exit 1; }
echo "✅ StubViewerCookie gated"
