# Siddes — API Throttling (DRF)

Siddes uses **Django REST Framework throttling** as a "military-grade" hygiene layer.
It prevents accidental floods and makes abuse expensive.

## How it works

- We use **scoped throttling**: each endpoint declares a `throttle_scope`.
- DRF enforces a per-scope rate (requests per time window).

Implementation:
- `backend/siddes_backend/throttles.py` — `SiddesScopedRateThrottle`
- `backend/siddes_backend/settings.py` — `REST_FRAMEWORK[DEFAULT_THROTTLE_*]`
- `backend/siddes_inbox/views.py` — per-view `throttle_scope`

## Scopes and defaults

These are the default rates (override via env vars):

| Scope | Used by | Default |
|---|---|---|
| `inbox_threads` | `GET /api/inbox/threads` | `120/min` |
| `inbox_thread` | `GET /api/inbox/thread/:id` | `240/min` |
| `inbox_send` | `POST /api/inbox/thread/:id` | `60/min` |
| `inbox_debug` | `/api/inbox/debug/*` (dev only) | `30/min` |

## Environment overrides

Set any of these to tune rates:

- `SIDDES_THROTTLE_INBOX_THREADS` (example: `300/min`)
- `SIDDES_THROTTLE_INBOX_THREAD`
- `SIDDES_THROTTLE_INBOX_SEND`
- `SIDDES_THROTTLE_INBOX_DEBUG`

## Identity used for throttling

- If `request.user.is_authenticated` is true:
  - throttle key uses `user.pk` (real Django user) or `user.id` (DEV `SiddesViewer`).
- Otherwise:
  - throttle key uses client IP (`X-Forwarded-For` / REMOTE_ADDR).

In production, you should use real authentication so throttling is per-user rather than per-IP.
