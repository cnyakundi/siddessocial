# Circles backend scaffold (Subsides)
**Updated:** 2026-01-11

Circles are curated sets inside a Side.

Today, the frontend stores Circles in `localStorage` (viewer-private). The *endgame* requires a server-backed model so Circles:
- sync across devices
- can be enforced server-side
- can maintain a reliable history/audit trail

This scaffold adds a framework-agnostic model + store + endpoint stubs, matching the style of `siddes_posts`, `siddes_reply`, and `siddes_inbox`.

## Non-negotiables
1) **Owner-private by default**
   - Only the owner can view/modify their Circles.
   - No cross-owner reads/writes.

2) **Side inheritance**
   - A Circle always belongs to exactly one Side (`public|friends|close|work`).
   - Posts created "inside" a Circle inherit the Circle’s Side (no context collapse).

3) **History**
   - Each mutation creates a CircleEvent record.

## Reference implementation
- `backend/siddes_sets/models_stub.py`
- `backend/siddes_sets/store.py`
- `backend/siddes_sets/endpoint_stub.py`

## Dev selftest
```bash
python3 scripts/dev/sets_demo.py --selftest
```

## Django wiring templates
- Ninja: `backend/siddes_sets/django_ninja_template.py`
- DRF: `backend/siddes_sets/drf_template.py`

## Circle membership normalization (sd_366)

At scale, JSONField membership is hard to index for fast visibility checks.
We now maintain a normalized membership table: `SiddesSetMember(set_id, member_id)` with indexes.

Rules:
- `SiddesSet.members` remains for API payload parity.
- Server-side read checks prefer `SiddesSetMember` and fall back to JSON only when needed (pre-migration safety).

After applying sd_366:
```bash
# VS Code terminal (backend container)
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate
```

