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

## Automatic push on notifications (sd_742_push_auto_dispatch_on_notifications)

When Siddes creates a notification (reply / like / mention / echo), it can also **send a push** to the viewer’s devices.

How it works:
- `siddes_notifications.service.notify()` upserts the notification row.
- If the row is new (or was previously read), it dispatches a push via `siddes_push.send.send_push_to_viewer_best_effort()`.

Gates / env:
- `SIDDES_PUSH_ON_NOTIFICATIONS_ENABLED=1` (default) — disable to stop auto push
- `SIDDES_PUSH_ENABLED=1` (default) — master push enable/disable
- `SIDDES_PUSH_MAX_PER_MIN=8` (default) — per-viewer rate limit (best-effort)

Deep links:
- If `post_id` exists → `/siddes-post/<post_id>`
- Otherwise → `/siddes-notifications`
