# Backend Reply Endpoint Wiring Guide
**Updated:** 2026-01-09

This doc explains how to implement replies in Django while enforcing Siddes visibility.

---

## Endpoint
`POST /api/post/<id>/reply`

Inputs:
- viewer_id from auth
- post_id from path
- body: { "text": "..." }

---

## Security (non-negotiable)
1) **Visibility check first**:
   - load post
   - enforce `can_view_post` for viewer
   - if forbidden, return 403 or (better) 404 to avoid leaking existence

2) Rate limit:
- per user
- per post
- per minute

3) Idempotency:
- accept optional client_key to dedupe retries (offline queue flush)

---

## Reference implementation
- `backend/siddes_reply/endpoint_stub.py` uses:
  - `siddes_post.detail_stub.get_post_detail` for visibility
  - `ReplyStore` (in-memory demo)

---

## Tests
```bash
python3 scripts/dev/reply_demo.py --selftest
```
