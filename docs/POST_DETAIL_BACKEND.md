# Backend Post Detail Wiring Guide
**Updated:** 2026-01-09

Endpoint:
`GET /api/post/<id>`

Inputs:
- viewer from auth
- post_id from path

Steps:
1) Load post (side + author)
2) Load relationship membership sets (author->viewer)
3) Apply `can_view_post` from `siddes_visibility.policy`
4) If forbidden: return 403 (or 404 to avoid leaking existence)
5) If ok: return post detail payload

Reference implementation:
- `backend/siddes_post/detail_stub.py`

Selftest:
```bash
python3 scripts/dev/post_detail_demo.py --selftest
```
