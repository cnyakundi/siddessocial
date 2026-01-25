# Siddes Caching Paranoia Checklist

This is the "no privacy leaks" test suite for Siddes caching.

Run the automated harness anytime:

```bash
bash scripts/checks/caching_paranoia_check.sh
```

If it fails, it will tell you exactly what rule was violated.

## What this protects
Non-negotiables:
1) No cross-Side bleed (Friends/Close/Work content must never show in another Side).
2) No cross-user bleed (User A cache must never show to User B in the same browser profile).
3) Service Worker caches are shared -> therefore never cache private JSON in SW.

## Manual tests (must pass)

### 1) Service Worker cache storage audit
In Chrome DevTools:
- Application -> Service Workers: confirm active + updated
- Application -> Cache Storage:
  - Only safe caches (shell/static)
  - No cached /api/* JSON
  - No cached /m/* private media

### 2) Cross-user paranoia test (same browser profile)
- Login User A
- Open Friends feed and an Inbox thread
- Logout
- Login User B
- MUST never see User A feed/thread content (no flashes)

### 3) Cross-Side paranoia test
- Login user
- Open Friends feed (wait for posts)
- Switch to Work
- Work must never show Friends items (even briefly)

### 4) Offline sanity (safe last-known state)
- Visit the app once online
- DevTools -> Network -> Offline
- Reload
- App shell loads + offline page shows (no private data pulled from SW caches)

## Deployed header sanity (Cloudflare)
Replace YOUR_DOMAIN:

```bash
curl -I https://YOUR_DOMAIN/api/inbox/threads
curl -I https://YOUR_DOMAIN/api/feed?side=friends
curl -I https://YOUR_DOMAIN/_next/static/CHUNK.js
```

Expected:
- /api/* -> Cache-Control: private, no-store AND CF-Cache-Status: BYPASS (or DYNAMIC)
- /_next/static/* -> cacheable (ideally immutable)

## If you see a violation
- If SW cached /api/* -> fix SW fetch strategy to NetworkOnly for /api/* (Part 1).
- If inbox cache shows cross-user flashes -> enforce epoch+viewer keys (Part 2).
- If edge caches /api/* -> add origin headers + Cloudflare bypass rule (Part 5).
