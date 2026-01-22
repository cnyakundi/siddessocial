#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Feed DRF endpoint + API base fallback (sd_142) =="

REQ=(
  "backend/siddes_feed/feed_stub.py"
  "backend/siddes_feed/apps.py"
  "backend/siddes_feed/urls.py"
  "backend/siddes_feed/views.py"
  "backend/siddes_backend/settings.py"
  "backend/siddes_backend/api.py"
  "frontend/src/lib/feedProvider.ts"
  "frontend/src/lib/feedProviders/backendStub.ts"
  "docs/STATE.md"
  "frontend/src/app/api/auth/_proxy.ts"
  "frontend/src/app/api/feed/route.ts"
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

grep -q 'siddes_feed.apps.SiddesFeedConfig' backend/siddes_backend/settings.py && echo "✅ Feed app installed" || (echo "❌ Feed app not in INSTALLED_APPS" && exit 1)
grep -q 'include("siddes_feed.urls")' backend/siddes_backend/api.py && echo "✅ API root includes feed urls" || (echo "❌ siddes_backend/api.py missing feed include" && exit 1)
grep -q 'path("feed"' backend/siddes_feed/urls.py && echo "✅ /api/feed route present" || (echo "❌ siddes_feed/urls.py missing feed route" && exit 1)

grep -q 'NEXT_PUBLIC_API_BASE' frontend/src/app/api/auth/_proxy.ts && echo "✅ Proxy resolves NEXT_PUBLIC_API_BASE" || (echo "❌ proxy missing NEXT_PUBLIC_API_BASE logic" && exit 1)
grep -q 'resolveBestInternalBase' frontend/src/app/api/feed/route.ts && echo "✅ /api/feed proxy resolves backend base" || (echo "❌ /api/feed proxy missing base resolver" && exit 1)
grep -q 'x-sd-viewer' frontend/src/app/api/feed/route.ts && echo "✅ /api/feed forwards dev x-sd-viewer" || (echo "❌ /api/feed missing x-sd-viewer forwarding" && exit 1)
grep -Fq 'new URL("/api/feed"' frontend/src/lib/feedProviders/backendStub.ts && echo "✅ client calls same-origin /api/feed" || (echo "❌ client not calling same-origin /api/feed" && exit 1)

grep -q 'sd_142' docs/STATE.md && echo "✅ STATE doc mentions sd_142" || (echo "❌ docs/STATE.md missing sd_142" && exit 1)
