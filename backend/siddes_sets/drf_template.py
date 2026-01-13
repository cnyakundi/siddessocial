"""Django REST Framework template for Sets (Subsides) APIs.

This file is a TEMPLATE. It is not auto-registered.

How to use:
1) Copy into your Django project.
2) Replace `get_owner_id` with auth logic.
3) Replace in-memory store with DB-backed store.

Security:
- Sets are owner-private by default.
- Never allow cross-owner reads/writes.
"""

# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
#
# from siddes_sets.store import SetsStore
# from siddes_sets.endpoint_stub import list_sets, create_set, rename_set, add_members, remove_members, list_events
#
# store = SetsStore()
#
# def get_owner_id(request) -> str:
#     return str(request.user.id)
#
# class SetsView(APIView):
#     def get(self, request):
#         side = request.query_params.get("side")
#         out = list_sets(store, owner_id=get_owner_id(request), side=side)
#         return Response(out, status=status.HTTP_200_OK)
#
#     def post(self, request):
#         side = (request.data.get("side") or "friends")
#         label = (request.data.get("label") or "").strip()
#         color = request.data.get("color") or "orange"
#         members = request.data.get("members") or []
#
#         out = create_set(
#             store,
#             owner_id=get_owner_id(request),
#             side=side,
#             label=label,
#             members=members,
#             color=color,
#         )
#         if out.get("ok"):
#             return Response(out, status=status.HTTP_201_CREATED)
#         return Response(out, status=status.HTTP_400_BAD_REQUEST)
#
# class SetRenameView(APIView):
#     def post(self, request, set_id: str):
#         label = (request.data.get("label") or "").strip()
#         out = rename_set(store, owner_id=get_owner_id(request), set_id=set_id, label=label)
#         if out.get("ok"):
#             return Response(out, status=status.HTTP_200_OK)
#         if out.get("status") == 404:
#             return Response(out, status=status.HTTP_404_NOT_FOUND)
#         return Response(out, status=status.HTTP_400_BAD_REQUEST)
#
# class SetMembersView(APIView):
#     def post(self, request, set_id: str, action: str):
#         members = request.data.get("members") or []
#         fn = add_members if action == "add" else remove_members
#         out = fn(store, owner_id=get_owner_id(request), set_id=set_id, members=members)
#         if out.get("ok"):
#             return Response(out, status=status.HTTP_200_OK)
#         return Response(out, status=status.HTTP_404_NOT_FOUND)
#
# class SetEventsView(APIView):
#     def get(self, request, set_id: str):
#         out = list_events(store, owner_id=get_owner_id(request), set_id=set_id)
#         return Response(out, status=status.HTTP_200_OK)
