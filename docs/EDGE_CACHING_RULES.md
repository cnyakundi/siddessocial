# Edge caching rules (Cloudflare) — Siddes safe defaults

**Goal:** cache only what is globally safe (**static** + **truly public**). Everything personalized must be **BYPASS** at the edge.

## Non‑negotiables
- **Never** edge-cache anything that depends on: auth/session, viewer, Side, membership, blocks, trust, permissions.
- Treat `/api/*` as **PRIVATE BY DEFAULT**.
- Service Worker must never cache private JSON/media (handled in Part 1). Service workers ignore HTTP cache rules.

## What this repo enforces now (so edge defaults stay safe)
### Next.js (origin)
- **`/api/*`** → `Cache-Control: private, no-store` (+ `Pragma: no-cache`, `Expires: 0`)
- **`/_next/static/*`** → long-lived immutable caching
- **`/icons/*` + `/manifest.webmanifest`** → moderate caching (7d + SWR)

### Django (origin)
- Middleware forces `/api/*` to be **private, no-store** by default.
- Public allowlist (revalidate-only) can be extended via:
  - `SIDDES_PUBLIC_API_PREFIXES="/api/slate,/api/health"`

### Cloudflare Media (/m/*)
- **Do NOT** use “Cache Everything” blanket rules for `/m/*`.
- Prefer “Respect origin headers” so:
  - `pub` media can cache (`public, immutable`)
  - `priv` media never caches (`private, no-store`)

## Cloudflare cache rules (recommended)
These are written in Cloudflare “Cache Rules” terms. Put them in this order (top to bottom).

### Rule 1 — Bypass private APIs (required)
**If:** `URI Path starts with /api/`  
**Then:** **Bypass cache**

This is the core safety rule. Even if a route handler forgets headers, edge must not store it.

### Rule 2 — Never cache the Service Worker file (required)
**If:** `URI Path equals /sw.js`  
**Then:** **Bypass cache** (or “Respect origin” + origin has `no-store`)

This prevents “stuck SW” situations where Cloudflare serves an old SW forever.

### Rule 3 — Cache Next static assets (safe)
**If:** `URI Path starts with /_next/static/`  
**Then:** **Cache** (Respect origin)  
Optional: set Edge TTL = 1 year

These assets are content-hashed and safe to cache globally.

### Rule 4 — Cache icons + manifest (safe)
**If:** `URI Path starts with /icons/` OR `URI Path equals /manifest.webmanifest`  
**Then:** **Cache** (Respect origin)  
Suggested Edge TTL: 1–7 days

(If you update icons, you may need a “Purge Everything” once.)

### Rule 5 — Media (recommended posture)
**If:** `URI Path starts with /m/`  
**Then:** **Respect origin headers**  
Do not force “Cache Everything” here.

This preserves the worker’s `pub` vs `priv` safety split.

## Verification (must do)
Run these after deploy (replace your domain):

### Private endpoints must BYPASS
```bash
curl -I https://YOUR_DOMAIN/api/inbox/threads
curl -I https://YOUR_DOMAIN/api/feed?side=friends
```
Expected:
- `Cache-Control: private, no-store`
- Cloudflare: `CF-Cache-Status: BYPASS` (or `DYNAMIC` depending on plan)

### Static assets should HIT after first request
```bash
curl -I https://YOUR_DOMAIN/_next/static/CHUNK.js
curl -I https://YOUR_DOMAIN/icons/icon-192.png
```
Expected:
- long cache headers on `_next/static`
- `CF-Cache-Status: HIT` after warm

### Service worker must never be cached
```bash
curl -I https://YOUR_DOMAIN/sw.js
```
Expected:
- `Cache-Control: no-store, must-revalidate` (from Part 1)
- `CF-Cache-Status: BYPASS` (preferred)

## Privacy paranoia checklist (must pass)
1) User A logs in → opens Friends feed + inbox thread  
2) User A logs out  
3) User B logs in on same browser profile  
✅ User B must NEVER see User A content (no flash, no stale UI)

## Common misconfigs to avoid
- A global “Cache Everything” rule applied to `/api/*` (catastrophic)
- A global “Cache Everything” rule applied to `/m/*` (breaks priv media)
- Caching `/sw.js` at edge (stuck SW + impossible rollouts)

