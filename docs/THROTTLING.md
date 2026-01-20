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
## Contacts scopes (sd_358)

| Scope | Used by | Default |
|---|---|---|
| `contacts_match` | `POST /api/contacts/match` | `10/min` |

Env overrides:
- `SIDDES_THROTTLE_CONTACTS_MATCH`


## Rituals scopes (sd_340)

| Scope | Used by | Default |
|---|---|---|
| `ritual_list` | `GET /api/rituals` | `240/min` |
| `ritual_detail` | `GET /api/rituals/:id` | `240/min` |
| `ritual_responses` | `GET /api/rituals/:id/responses` | `240/min` |
| `ritual_create` | `POST /api/rituals` | `20/min` |
| `ritual_ignite` | `POST /api/rituals/:id/ignite` | `120/min` |
| `ritual_respond` | `POST /api/rituals/:id/respond` (private contexts) | `60/min` |
| `ritual_public_answer` | `POST /api/rituals/:id/respond` (Public Town Hall) | `20/min` |

Env overrides:
- `SIDDES_THROTTLE_RITUAL_LIST`
- `SIDDES_THROTTLE_RITUAL_DETAIL`
- `SIDDES_THROTTLE_RITUAL_RESPONSES`
- `SIDDES_THROTTLE_RITUAL_CREATE`
- `SIDDES_THROTTLE_RITUAL_IGNITE`
- `SIDDES_THROTTLE_RITUAL_RESPOND`
- `SIDDES_THROTTLE_RITUAL_PUBLIC_ANSWER`
## Contacts scopes (sd_359)

| Scope | Used by | Default |
|---|---|---|
| `contacts_suggestions` | `GET /api/contacts/suggestions` | `30/min` |

Env overrides:
- `SIDDES_THROTTLE_CONTACTS_SUGGESTIONS`

