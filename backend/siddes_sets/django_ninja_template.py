"""Django Ninja template for Sets (Subsides) APIs.

This file is a TEMPLATE. It is not auto-registered.

Proposed endpoints (v0):
- GET  /api/sets?side=friends
- POST /api/sets
- POST /api/sets/{set_id}/rename
- POST /api/sets/{set_id}/members/add
- POST /api/sets/{set_id}/members/remove
- GET  /api/sets/{set_id}/events

How to use:
1) Copy into your Django project where Ninja routers live.
2) Ensure `siddes_sets` is importable (backend on PYTHONPATH / installed app).
3) Replace `get_owner_id(request)` with your auth logic.
4) Replace `store` with a DB-backed store (or keep in-memory for dev).

Security:
- Sets are owner-private by default.
- Never allow cross-owner reads/writes.
"""

# from ninja import Router, Schema
# from django.http import HttpRequest
#
# from siddes_sets.store import SetsStore
# from siddes_sets.endpoint_stub import list_sets, create_set, rename_set, add_members, remove_members, list_events
#
# router = Router()
# store = SetsStore()
#
# class SetIn(Schema):
#     side: str
#     label: str
#     color: str | None = None
#     members: list[str] | None = None
#
# class RenameIn(Schema):
#     label: str
#
# class MembersIn(Schema):
#     members: list[str]
#
# def get_owner_id(request: HttpRequest) -> str:
#     # Example: return str(request.user.id)
#     return "TODO"
#
# @router.get("/sets")
# def sets_list(request: HttpRequest, side: str | None = None):
#     owner_id = get_owner_id(request)
#     return list_sets(store, owner_id=owner_id, side=side)
#
# @router.post("/sets")
# def sets_create(request: HttpRequest, payload: SetIn):
#     owner_id = get_owner_id(request)
#     return create_set(
#         store,
#         owner_id=owner_id,
#         side=payload.side,
#         label=payload.label,
#         members=payload.members,
#         color=payload.color or "orange",
#     )
#
# @router.post("/sets/{set_id}/rename")
# def sets_rename(request: HttpRequest, set_id: str, payload: RenameIn):
#     return rename_set(store, owner_id=get_owner_id(request), set_id=set_id, label=payload.label)
#
# @router.post("/sets/{set_id}/members/add")
# def sets_add_members(request: HttpRequest, set_id: str, payload: MembersIn):
#     return add_members(store, owner_id=get_owner_id(request), set_id=set_id, members=payload.members)
#
# @router.post("/sets/{set_id}/members/remove")
# def sets_remove_members(request: HttpRequest, set_id: str, payload: MembersIn):
#     return remove_members(store, owner_id=get_owner_id(request), set_id=set_id, members=payload.members)
#
# @router.get("/sets/{set_id}/events")
# def sets_events(request: HttpRequest, set_id: str):
#     return list_events(store, owner_id=get_owner_id(request), set_id=set_id)
