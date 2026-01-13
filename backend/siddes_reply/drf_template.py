"""Django REST Framework template for POST /api/post/<id>/reply

This file is a TEMPLATE. It is not auto-registered.

How to use:
1) Copy into your Django project.
2) Replace `get_viewer_id` with auth logic.
3) Replace in-memory store with DB-backed store.

Security:
- Always enforce visibility.
- Prefer hide_existence=True (404 on forbidden) to avoid leaking private post existence.

"""

# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
#
# from siddes_reply.store import ReplyStore
# from siddes_reply.endpoint_stub import create_reply
#
# store = ReplyStore()
#
# def get_viewer_id(request) -> str:
#     return str(request.user.id)
#
# class ReplyView(APIView):
#     def post(self, request, post_id: str):
#         text = (request.data.get("text") or "").strip()
#         client_key = request.data.get("client_key")
#         out = create_reply(
#             store,
#             viewer_id=get_viewer_id(request),
#             post_id=post_id,
#             text=text,
#             client_key=client_key,
#             hide_existence=True,
#         )
#
#         if out["ok"]:
#             return Response(out, status=status.HTTP_201_CREATED)
#
#         if out["status"] == 400:
#             return Response(out, status=status.HTTP_400_BAD_REQUEST)
#         if out["status"] == 404:
#             return Response(out, status=status.HTTP_404_NOT_FOUND)
#         return Response(out, status=status.HTTP_403_FORBIDDEN)
