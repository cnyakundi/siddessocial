# PWA Plan (Twitter-level feel)
**Updated:** 2026-01-09

## Goals
- Installable app (manifest + icons)
- Fast app shell (cached)
- Smooth feed scrolling
- Offline fallback (cached feed + banner)
- Push notifications with glimpses
- Safe update strategy (avoid stale-cache traps)

## Current implementation (sd_001)
This repo uses a lightweight baseline PWA setup:
- Manifest at `/manifest.webmanifest`
- Service worker at `/sw.js`
- Client bootstrap at `/pwa-client.js`:
  - registers SW
  - shows install banner (beforeinstallprompt)
  - shows update banner when a new SW is waiting
  - injects manifest link + theme-color meta if missing

To enable this, run once:
```bash
./scripts/patch_pwa_layout.sh
```
which injects:
```tsx
import Script from "next/script";
<Script src="/pwa-client.js" strategy="afterInteractive" />
```

## Service worker caching (baseline)
- Offline fallback for navigations (`/offline.html`)
- Cache-first for static assets (`/_next/static`, `/icons`, images)
- Network-first with cache fallback for other GET requests

## Roadmap
- Workbox caching strategies (sd_014)
- Push notifications + glimpses (sd_015)
- Offline post queue (sd_016)

## Testing
- `./scripts/pwa_check.sh`
- Chrome DevTools → Application → Manifest / Service Workers
- Offline test: disable network, refresh, observe offline page
