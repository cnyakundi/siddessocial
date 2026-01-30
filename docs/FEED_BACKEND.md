# Backend Feed Wiring Guide
**Updated:** 2026-01-09

This doc explains how to implement the feed endpoint in Django using the visibility policy.

---

## Endpoint
`GET /api/feed?side=<public|friends|close|work>`

Optional query params:
- limit: int (1..200)
- cursor: opaque (returned as nextCursor)

Response extras:
- nextCursor: string|null
- hasMore: boolean
- serverTs: float

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

---

## DB-backed dev data (sd_157)

To use real DB-backed posts in the Feed:

1) Circle `SD_POST_STORE=auto` in `ops/docker/.env` (or copy from `.env.example`).
2) Run:

```bash
bash scripts/dev/seed_demo_universe.sh
```

This seeds:
- Circles (Friends/Close/Work)
- Posts across Sides (mostly authored by `me` so visibility is stable)
- A sample reply

In DB mode, `backend/siddes_feed/feed_stub.py` **does not mix** demo mock posts by default.
