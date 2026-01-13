
---

## 7) Local dev wiring (Next API stubs)
This repo includes Next.js API stubs for rapid iteration:
- GET `/api/push/vapid`
- POST `/api/push/subscribe`
- POST `/api/push/unsubscribe`

These are demo-only and do not persist subscriptions. Real storage belongs in your backend.

To enable the Subscribe button:
- set `VAPID_PUBLIC_KEY` (or `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) to a base64url VAPID public key
- generate keys with: `npx web-push generate-vapid-keys`
