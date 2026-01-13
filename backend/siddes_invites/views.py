"""Invites API views (Django REST Framework).

Endpoints:
- GET/POST  /api/invites
- GET/PATCH /api/invites/<id>

Viewer gating:
- Viewer identity comes from DRF auth.
- In DEBUG, a dev viewer can be provided via header/cookie (see drf_auth.py).
- Missing viewer => restricted.

Write rules (stub):
- Create invites: only `viewer=me` (owner) can create (default-safe).
- Accept/reject: only the invite recipient can accept/reject.
- Revoke: only the sender can revoke.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role

from .store_db import DbInvitesStore

_store = DbInvitesStore()


def _raw_viewer_from_request(request) -> Optional[str]:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return str(getattr(user, "id", "") or "").strip() or None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return raw or None


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or "anon").strip() or "anon"
    role = resolve_viewer_role(viewer) or "anon"
    return has_viewer, viewer, role


def _restricted_payload(has_viewer: bool, viewer: str, role: str, *, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {"ok": True, "restricted": True, "viewer": viewer if has_viewer else None, "role": role}
    if extra:
        out.update(extra)
    return out


@method_decorator(csrf_exempt, name="dispatch")
class InvitesView(APIView):
    """GET/POST /api/invites"""

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)

        direction = None
        try:
            direction = str(getattr(request, "query_params", {}).get("direction") or "").strip() or None
        except Exception:
            direction = None

        items = _store.list(viewer_id=viewer, direction=direction)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "items": items}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        # In the stub universe, only the owner viewer can create invites.
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        set_id = str(body.get("setId") or body.get("set_id") or "").strip()
        to_id = str(body.get("to") or body.get("toId") or body.get("to_id") or "").strip()
        side = str(body.get("side") or "friends").strip().lower()
        message = str(body.get("message") or "").strip()[:280]

        if not set_id or not to_id:
            return Response({"ok": False, "restricted": False, "error": "bad_request"}, status=status.HTTP_400_BAD_REQUEST)

        item = _store.create(from_id=viewer, to_id=to_id, set_id=set_id, side=side, message=message)
        if not item:
            return Response({"ok": False, "restricted": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class InviteDetailView(APIView):
    """GET/PATCH /api/invites/<id>"""

    def get(self, request, invite_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"item": None}), status=status.HTTP_200_OK)

        item = _store.get(viewer_id=viewer, invite_id=invite_id)
        if item is None:
            return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": None}, status=status.HTTP_200_OK)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)

    def patch(self, request, invite_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        # Support either: {action:"accept"} or {status:"accepted"}
        action = str(body.get("action") or "").strip().lower()
        if not action:
            action = str(body.get("status") or "").strip().lower()

        if action in ("accepted", "accept"):
            action = "accept"
        elif action in ("rejected", "reject"):
            action = "reject"
        elif action in ("revoked", "revoke"):
            action = "revoke"

        if action not in ("accept", "reject", "revoke"):
            return Response({"ok": False, "restricted": False, "error": "bad_request"}, status=status.HTTP_400_BAD_REQUEST)

        item = _store.apply_action(viewer_id=viewer, invite_id=invite_id, action=action)
        if item is None:
            return Response({"ok": False, "restricted": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        # If viewer is not allowed to apply the action, treat as forbidden.
        if item.get("_forbidden"):
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        item.pop("_forbidden", None)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)
