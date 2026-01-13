# Backend Create Post Wiring Guide
**Updated:** 2026-01-09

Endpoint:
`POST /api/post`

Inputs:
- author from auth
- body: side, text, set_id, urgent, client_key

Non-negotiables:
- enforce posting permission server-side (user allowed sides)
- idempotency via client_key to dedupe offline flush retries

Reference:
- `backend/siddes_posts/endpoint_stub.py`

Selftest:
```bash
python3 scripts/dev/posts_create_demo.py --selftest
```
