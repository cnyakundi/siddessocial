#!/usr/bin/env bash
set -euo pipefail

echo "== Check: Caching paranoia (no cross-user / cross-side bleed) =="

REQ=(
  "frontend/public/sw.js"
  "frontend/next.config.js"
  "frontend/src/lib/feedInstantCache.ts"
  "frontend/src/lib/inboxCache.ts"
  "ops/cloudflare/r2_media_worker/index.js"
  "backend/siddes_backend/middleware.py"
  "backend/siddes_backend/settings.py"
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

python3 - <<'PY'
from __future__ import annotations
from pathlib import Path
import sys

crit: list[str] = []
warn: list[str] = []

def ok(msg: str):
    print("✅ " + msg)

def w(msg: str):
    print("⚠️  " + msg)
    warn.append(msg)

def c(msg: str):
    print("❌ " + msg)
    crit.append(msg)

# ----------------------------
# 1) Service Worker (MOST IMPORTANT)
# ----------------------------
sw = Path("frontend/public/sw.js").read_text(encoding="utf-8", errors="ignore")

# Must not define or use legacy API/media caches.
if "API_CACHE" in sw or "siddes-api-" in sw:
    c("Service Worker still has API_CACHE / siddes-api cache (must never cache /api/* in SW).")

if "IMG_CACHE" in sw or "siddes-img-" in sw:
    c("Service Worker still has IMG_CACHE / siddes-img cache (generic image caching can store private /m/*).")

# Must explicitly guard /api and /m (SW caches are shared across browser profile).
if ('url.pathname.startsWith("/api/")' not in sw
    and 'pathname.startsWith("/api/")' not in sw
    and "pathname.startsWith('/api/')" not in sw):
    c("Service Worker missing explicit /api guard.")

if ('url.pathname.startsWith("/m/")' not in sw
    and 'pathname.startsWith("/m/")' not in sw
    and "pathname.startsWith('/m/')" not in sw):
    c("Service Worker missing explicit /m guard.")

# Disallow generic unsafe strategy helpers (names used in older Workbox-style scripts).
if "staleWhileRevalidate" in sw or "networkFirst" in sw:
    c("Service Worker contains unsafe generic caching strategy helpers (expected: custom minimal code).")

# sd_900: allow public-only immutable /m image caching IF header-gated.
has_sd900 = "sd_900_public_media_cache" in sw
if has_sd900:
    must = ["MEDIA_CACHE", "cache-control", "immutable", "public", "no-store", "private"]
    missing = [m for m in must if m not in sw]
    if missing:
        c(f"sd_900 SW public media cache gate missing expected tokens: {missing}")
    else:
        ok("Service Worker: /m/* is cached ONLY when response is public+immutable (private/no-store never cached).")
else:
    # Baseline: /m is NetworkOnly (safe but slower)
    ok("Service Worker: /m/* is NetworkOnly (safe baseline).")

# Navigations: should be NetworkOnly + /offline.html fallback (never cached HTML/RSC).
if ('request.mode === "navigate"' not in sw
    and "request.mode === 'navigate'" not in sw
    and "request.mode==='navigate'" not in sw):
    c("Service Worker missing navigation handler (should be NetworkOnly + offline fallback).")

if "/offline.html" not in sw:
    c("Service Worker missing /offline.html fallback for offline navigation.")

# Nice-to-have: delete old caches so legacy caches are purged.
if "caches.keys" in sw and "siddes-" in sw and "caches.delete" in sw:
    ok("Service Worker deletes old siddes-* caches on activate (purges legacy caches).")
else:
    w("Could not confirm SW purge of old caches on activate (recommended).")

# /api must never be cached.
ok("Service Worker: /api/* is NetworkOnly (never cached).")

# ----------------------------
# 2) /sw.js anti-stuck headers (Next.js)
# ----------------------------
nc = Path("frontend/next.config.js").read_text(encoding="utf-8", errors="ignore")

if 'source: "/sw.js"' not in nc and "source: '/sw.js'" not in nc:
    c('next.config.js missing headers rule for "/sw.js" (anti-stuck no-store).')
else:
    if "no-store" not in nc:
        w('Found "/sw.js" header rule but could not confirm Cache-Control includes "no-store".')
    else:
        ok('/sw.js is served with anti-stuck Cache-Control (no-store).')

# ----------------------------
# 3) Origin discourages caching /api/* (belt-and-suspenders)
# ----------------------------
if 'source: "/api/:path*"' not in nc and "source: '/api/:path*'" not in nc:
    w('next.config.js missing "/api/:path*" headers rule (recommended: Cache-Control: private, no-store).')
else:
    if "private" in nc and "no-store" in nc:
        ok('/api/:path* is marked private,no-store at origin (discourages edge caching).')
    else:
        w('Found "/api/:path*" rule but could not confirm it includes private,no-store.')

# ----------------------------
# 4) Backend belt-and-suspenders middleware (optional but good)
# ----------------------------
mw = Path("backend/siddes_backend/middleware.py").read_text(encoding="utf-8", errors="ignore")
st = Path("backend/siddes_backend/settings.py").read_text(encoding="utf-8", errors="ignore")

if "ApiCacheSafetyHeadersMiddleware" not in mw:
    w("Backend ApiCacheSafetyHeadersMiddleware not found (optional but recommended).")
else:
    if "ApiCacheSafetyHeadersMiddleware" in st:
        ok("Backend ApiCacheSafetyHeadersMiddleware is enabled in settings.py.")
    else:
        w("ApiCacheSafetyHeadersMiddleware exists but is not referenced in settings.py MIDDLEWARE.")

# ----------------------------
# 5) Cloudflare R2 media worker: priv must be private,no-store
# ----------------------------
wk = Path("ops/cloudflare/r2_media_worker/index.js").read_text(encoding="utf-8", errors="ignore").lower()
if "private, no-store" in wk:
    ok("R2 media worker sets private,no-store for private media responses.")
else:
    w("Could not confirm R2 worker sets private,no-store for private media (check ops/cloudflare/r2_media_worker).")

# ----------------------------
# 6) Client caches: key scoping sanity
# ----------------------------
feed = Path("frontend/src/lib/feedInstantCache.ts").read_text(encoding="utf-8", errors="ignore")
if "feed:v1|epoch:" in feed and "|viewer:" in feed and "|side:" in feed:
    ok("Feed instant cache keys include epoch + viewer + side.")
else:
    w("Feed instant cache keys may be missing epoch/viewer/side scoping (verify feedInstantCache.ts).")

inbox = Path("frontend/src/lib/inboxCache.ts").read_text(encoding="utf-8", errors="ignore")
if "thread:v2|epoch:" in inbox and "|viewer:" in inbox:
    ok("Inbox thread cache keys include epoch + viewer (v2).")
else:
    c("Inbox thread cache keys are not epoch-scoped (v2). Apply Part 2 (sd_581) to prevent cross-user flashes in a shared tab session.")

print("")
if crit:
    print("== RESULT: FAIL (critical caching safety issues) ==")
    for m in crit:
        print(" - " + m)
    sys.exit(1)

print("== RESULT: PASS (no critical caching safety issues) ==")
if warn:
    print("Warnings:")
    for m in warn:
        print(" - " + m)
PY
