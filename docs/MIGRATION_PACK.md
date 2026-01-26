# Migration Pack

This file exists so overlay/tooling verification can reliably find the expected docs scaffold.

## What is a Migration Pack?
A Migration Pack is a small, versioned set of changes that upgrades project structure, tooling, and/or conventions
without being tied to a single product feature.

## How we use it in Siddes
- Keep changes small and reversible
- Always include apply-helper instructions
- Run: ./verify_overlays.sh and the relevant scripts/checks/*.sh
- Document outcomes in docs/STATE.md

## Typical contents
- Docs scaffolding updates
- Scripts/checks additions
- One-time codemods
- Deprecation notes and cleanup guidance

## Push backend + subscription storage — sd_741_push_backend_db
Adds backend DB storage + endpoints for PWA push subscriptions, plus frontend proxy routes + UI.

Apply:
- Frontend: NEXT_PUBLIC_VAPID_PUBLIC_KEY
- Backend: SIDDES_VAPID_PRIVATE_KEY, SIDDES_VAPID_SUBJECT

Smoke:
1) Open /siddes-notifications
2) Enable + Subscribe
3) In dev, tap Test (calls /api/push/debug/send)

## Push auto-dispatch on notifications — sd_742_push_auto_dispatch_on_notifications

Siddes will now send real push notifications when it creates DB-backed notifications (mentions/replies/likes/echo).

Requires:
- Backend env: `SIDDES_VAPID_PRIVATE_KEY`, `SIDDES_VAPID_SUBJECT`
- Frontend env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (for subscription)

Optional:
- `SIDDES_PUSH_ON_NOTIFICATIONS_ENABLED=0` to disable auto push.

Smoke:
1) Enable + Subscribe on `/siddes-notifications`
2) Trigger a notification (like/reply/mention on a post)
3) You should receive a push
