# Backend Feed Wiring Guide
**Updated:** 2026-01-09

This doc explains how to implement the feed endpoint in Django using the visibility policy.

---

## Endpoint
`GET /api/feed?side=<public|friends|close|work>`

Inputs:
- viewer_id from auth
- side from query param

---

## Steps (v0)
1) Validate `side`
2) Query posts where `side = side`
3) Apply visibility policy (prefer ORM filters):
   - friends: join friendships
   - close: join close list
   - work: join work list
4) Serialize posts for frontend

---

## Reference implementation
See:
- `backend/siddes_feed/feed_stub.py`
- `backend/siddes_visibility/policy.py`

---

## Tests
Run:
```bash
python3 scripts/dev/feed_demo.py --selftest
```
