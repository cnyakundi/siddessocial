# Siddes — Auth (DEV placeholder → production-grade)

Siddes is built with a **default-safe** security posture:
- If the server cannot confidently identify and authorize a viewer, endpoints respond with
  `restricted: true` and **do not leak** private data.

## Current state (DEV)
In local development (`DJANGO_DEBUG=1`), the backend supports a lightweight viewer identity:
- Header: `x-sd-viewer: <id>`
- Cookie: `sd_viewer=<id>`

This exists purely to keep the beginner experience smooth while we build real auth.

## Production direction
When `DJANGO_DEBUG=0`, **dev viewer identity is ignored**.
Production must use real authentication (session/JWT/keys).

Implementation:
- `backend/siddes_backend/drf_auth.py` contains `DevHeaderViewerAuthentication`
  (active only in DEV).
- `backend/siddes_inbox/views.py:get_viewer_id()` refuses to trust `x-sd-viewer` / `sd_viewer`
  when `DEBUG=False`.
