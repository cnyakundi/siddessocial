# Siddes — PWA (Mobile-App Feel) Guide
**Updated:** 2026-01-25

This doc explains **how Siddes behaves as a PWA**, what’s already implemented, and how to test it so it feels like a real mobile app.

---

## What exists today (in this repo)

### 1) Web App Manifest
- File: `frontend/public/manifest.webmanifest`
- Purpose: home screen install metadata (name, icon, theme color, shortcuts)

### 2) Service Worker (safe caching rules)
- File: `frontend/public/sw.js`
- Purpose: **instant app shell** + offline fallback, without leaking user/private data

**Non‑negotiable safety rules in `sw.js`:**
- **Never cache** `/_next/*` HTML navigations (NetworkOnly; offline falls back to `/offline.html`)
- **Never cache** `/api/*` (user + Side scoped)
- **Never cache** `/m/*` (media can be public/private; we rely on normal HTTP caching)

### 3) Offline fallback page
- File: `frontend/public/offline.html`
- When you navigate while offline, the SW will show this page.

### 4) PWA client runtime (install + update banners)
- File: `frontend/src/components/PwaClient.tsx`
- What it does:
  - Shows **offline** banner (browser offline event)
  - Shows **Install** button on Android/Chromium (`beforeinstallprompt`)
  - Shows **iOS “Add to Home Screen”** hint (Safari has no `beforeinstallprompt`)
  - Registers `/sw.js` in production builds (and optionally in dev via flag)

### 5) App metadata + viewport (iOS safe-area)
- File: `frontend/src/app/layout.tsx`
- Includes:
  - `manifest: "/manifest.webmanifest"`
  - iOS PWA meta (apple web app capable)
  - `viewportFit: "cover"` for notch safe areas

### 6) Caching headers + security headers
- File: `frontend/next.config.js`
- Includes caching rules for:
  - `/sw.js` (no-store so updates are picked up)
  - `/manifest.webmanifest` and `/icons/*` (cacheable)
  - `/_next/static/*` (immutable)

---

## How to test “installed app” behavior (the important part)

### A) Build + run in production mode
Service workers + install prompts don’t behave correctly in `next dev`.

Run:
```bash
cd frontend
npm run build
npm run start
```

### B) Test on a real phone
PWAs require a **secure context** (HTTPS), except `localhost`.

**Recommended (beginner-safe): use a tunnel**
- Option 1: `ngrok http 3000`
- Option 2: Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`)

Open the HTTPS URL on your phone.

### C) Install
- **Android/Chromium:** you should see the in-app install banner (or browser install UI)
- **iPhone/iPad:** open in **Safari**, then:
  - Share → **Add to Home Screen**
  - Launch Siddes from the icon

### D) Offline smoke
After installing:
1. Open Siddes
2. Turn on airplane mode
3. Navigate to a new screen
4. You should see the offline fallback (`offline.html`)

---

## Dev toggle (optional)
If you want SW registration outside production builds, set:

```bash
NEXT_PUBLIC_PWA_DEV=1
```

This is useful for testing, but don’t ship it enabled by default.

---

## Updating SW caches safely
`frontend/public/sw.js` uses a `VERSION` constant for cache names.

When you change cache rules (or you want to force clients to refresh caches), bump:
- `VERSION`
- and therefore the cache names (`siddes-core-*`, `siddes-static-*`)

---

## Checklist: “Feels like an app”
You’re good when all of these are true:

- Launches from home screen in **standalone**
- No browser chrome (address bar)
- Bottom nav + safe-area padding feels correct
- Install guidance works on both Android + iOS
- Offline fallback works (no white screen)
- Updates prompt appears when a new SW is waiting
