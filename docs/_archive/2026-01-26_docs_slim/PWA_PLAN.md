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


## App-like polish (sd_736)
- **Theme-color sync:** the `<meta name="theme-color">` is updated when the active Side changes (Public/Friends/Close/Work).
  This makes installed PWAs feel more native on Android (status bar / top chrome color matches the app).
- **Touch polish:** global CSS reduces tap highlight and prevents pull-to-refresh on supporting browsers.

Files:
- `frontend/src/components/ThemeColorSync.tsx`
- `frontend/src/components/AppProviders.tsx` (wires ThemeColorSync)
- `frontend/src/app/globals.css` (touch polish)



## App icon badges (sd_737_app_icon_badges)
On supported browsers (mainly Chromium installed PWAs), Siddes can show a small badge on the app icon when new activity arrives.

### How it works
- **Service worker** sets a badge when a **push** arrives.
  - Payload may include `badge` (int). If absent, Siddes falls back to `1`.
- **Client** clears the badge when the app becomes active (focus/visible), and the SW also clears it on notification click.

Files:
- `frontend/public/sw.js` (sets badge on push; clears on notification click)
- `frontend/src/components/AppBadgeClient.tsx` (clears badge on app open)
- `frontend/src/components/AppProviders.tsx` (wires AppBadgeClient)

