"""Django Ninja template for POST /api/post/{post_id}/reply

This file is a TEMPLATE. It is not auto-registered.

How to use:
1) Copy into your Django project where Ninja routers live.
2) Ensure `siddes_reply` is importable (backend on PYTHONPATH / installed app).
3) Replace `get_viewer_id(request)` with your auth logic.
4) Replace `store` with a DB-backed store (or keep in-memory for dev).

Security:
- Always enforce visibility (create_reply does this via get_post_detail).
- Prefer hide_existence=True (404) for forbidden.

"""

# from ninja import Router, Schema
# from django.http import HttpRequest
#
# from siddes_reply.store import ReplyStore
# from siddes_reply.endpoint_stub import create_reply
#
# router = Router()
# store = ReplyStore()  # replace with DB in production
#
# class ReplyIn(Schema):
#     text: str
#     client_key: str | None = None
#
# def get_viewer_id(request: HttpRequest) -> str:
#     # Example: return str(request.user.id)
#     return "TODO"
#
# @router.post("/post/{post_id}/reply")
# def reply(request: HttpRequest, post_id: str, payload: ReplyIn):
#     viewer_id = get_viewer_id(request)
#     out = create_reply(
#         store,
#         viewer_id=viewer_id,
#         post_id=post_id,
#         text=payload.text,
#         client_key=payload.client_key,
#         hide_existence=True,
#     )
#     # Ninja returns JSON automatically, but you may map status codes:
#     return out
