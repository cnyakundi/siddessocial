# Reply Endpoint — Django Wiring Pack
**Updated:** 2026-01-09

This pack lets any new LLM/dev pick up your repo and wire replies into Django without you re-explaining context.

---

## Goal
Implement:

`POST /api/post/<id>/reply`

with:
- **server-side visibility enforcement**
- optional **idempotency** (client_key)
- optional **hide existence** behavior (return 404 instead of 403 for forbidden)

---

## Core logic you must reuse
- `backend/siddes_reply/endpoint_stub.py::create_reply`
- `backend/siddes_post/detail_stub.py::get_post_detail`
- `backend/siddes_visibility/policy.py::can_view_post`

You do **not** reinvent these rules inside the view.

---

## Option A: Django Ninja
Template:
- `backend/siddes_reply/django_ninja_template.py`

Steps:
1) Add a router and register it in your Ninja API root.
2) Replace `get_viewer_id(request)` with your auth identity.
3) Replace `ReplyStore()` with a DB-backed implementation (later).
4) Decide whether to return **404** on forbidden (`hide_existence=True` recommended).

---

## Option B: DRF (APIView)
Template:
- `backend/siddes_reply/drf_template.py`

Same steps as above, but DRF Response objects.

---

## Idempotency rule (recommended)
When offline queue flush retries, it may send duplicate replies.
Use a `client_key` (e.g., the queue item id) to dedupe:
- store `client_key` with reply
- if the same key is received again, return the existing reply (200/201)

Not required for v0 demos, but required for real reliability.

---

## Visibility rule (non-negotiable)
Replies must be blocked if viewer cannot see the post:
- Friends/Close/Work membership enforced server-side
- Prefer returning 404 for forbidden to avoid leaking existence

---

## Done criteria
- Unauthorized user cannot create reply on Friends/Close/Work post
- Authorized user can
- No raw contacts required; unrelated to contacts matching
