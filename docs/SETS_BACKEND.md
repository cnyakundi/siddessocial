# Sets backend scaffold (Subsides)
**Updated:** 2026-01-11

Sets are curated sets inside a Side.

Today, the frontend stores Sets in `localStorage` (viewer-private). The *endgame* requires a server-backed model so Sets:
- sync across devices
- can be enforced server-side
- can maintain a reliable history/audit trail

This scaffold adds a framework-agnostic model + store + endpoint stubs, matching the style of `siddes_posts`, `siddes_reply`, and `siddes_inbox`.

## Non-negotiables
1) **Owner-private by default**
   - Only the owner can view/modify their Sets.
   - No cross-owner reads/writes.

2) **Side inheritance**
   - A Set always belongs to exactly one Side (`public|friends|close|work`).
   - Posts created "inside" a Set inherit the Set’s Side (no context collapse).

3) **History**
   - Each mutation creates a SetEvent record.

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
