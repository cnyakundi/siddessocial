# PWA Push (Device notifications)
<!-- sd_741_push_backend_db -->

This repo supports Web Push notifications for the Siddes PWA.

## What this adds
- Backend DB storage for push subscriptions (per viewer)
- DRF endpoints under `/api/push/*`
- Next.js proxy routes under `/api/push/*`
- UI at `/siddes-notifications` to enable/subscribe/save + dev test send

## Endpoints
All endpoints are **default-safe**:
- If a viewer isn’t available → returns `{ restricted: true }` (no leak).

### GET /api/push/status
Returns number of stored subscriptions for the current viewer.

### POST /api/push/subscribe
Body:
```json
{ "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } } }
```

### POST /api/push/unsubscribe
Body:
```json
{ "endpoint": "..." }
```
(or full subscription JSON)

### POST /api/push/debug/send (DEBUG only)
Sends a test push to the current viewer’s stored subscriptions.

Requires backend env:
- `SIDDES_VAPID_PRIVATE_KEY`
- `SIDDES_VAPID_SUBJECT` (example: `mailto:you@example.com`)

## VAPID keys
Generate keys (one-time):
```bash
npx web-push generate-vapid-keys
```

Set:
- Frontend `.env.local`:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key>`
- Backend env:
  - `SIDDES_VAPID_PRIVATE_KEY=<Private Key>`
  - `SIDDES_VAPID_SUBJECT=mailto:you@example.com`

## Smoke test (Android/Chromium installed PWA)
1) Open Siddes over HTTPS and install the PWA
2) Open `/siddes-notifications`
3) Enable → Subscribe
4) In dev: press **Test** and confirm you receive a push
