"""Invites API views (Django REST Framework).

Endpoints:
- GET/POST  /api/invites
- GET/PATCH /api/invites/<id>

Viewer gating:
- Viewer identity comes from DRF auth.
- In DEBUG, a dev viewer can be provided via header/cookie (see drf_auth.py).
- Missing viewer => restricted.

Write rules (v0):
- Create invites: only `viewer=me` (owner) can create (default-safe).
- Accept/reject: only the invite recipient can accept/reject.
- Revoke: only the sender can revoke.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.utils.decorators import method_decorator
from siddes_backend.csrf import dev_csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role

from .store_db import DbInvitesStore

_store = DbInvitesStore()


def _raw_viewer_from_request(request) -> Optional[str]:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        uid = str(getattr(user, "id", "") or "").strip()
        return f"me_{uid}" if uid else None

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


@method_decorator(dev_csrf_exempt, name="dispatch")
class InvitesView(APIView):
    """GET/POST /api/invites"""

    throttle_scope = "invites_list"

    def get_throttles(self):
        # Method-specific throttle scopes.
        # POST (create) is more expensive than GET (list).
        if getattr(self, "request", None) is not None and self.request.method == "POST":
            self.throttle_scope = "invites_create"
        else:
            self.throttle_scope = "invites_list"
        return super().get_throttles()

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


@method_decorator(dev_csrf_exempt, name="dispatch")
class InviteDetailView(APIView):
    """GET/PATCH /api/invites/<id>"""

    throttle_scope = "invites_detail"

    def get_throttles(self):
        # Method-specific throttle scopes.
        # PATCH (accept/reject/revoke) is more expensive than GET (read).
        if getattr(self, "request", None) is not None and self.request.method == "PATCH":
            self.throttle_scope = "invites_action"
        else:
            self.throttle_scope = "invites_detail"
        return super().get_throttles()

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


# --- Invite Links (sd_708) ---
from .store_links_db import DbInviteLinksStore  # noqa: E402

_links_store = DbInviteLinksStore()


@method_decorator(dev_csrf_exempt, name="dispatch")
class SetInviteLinksView(APIView):
    """GET/POST /api/sets/<id>/invite-links (owner-only)."""

    throttle_scope = "invites_links"

    def get(self, request, set_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        items = _links_store.list_for_set(owner_id=viewer, set_id=set_id)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "items": items}, status=status.HTTP_200_OK)

    def post(self, request, set_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        max_uses = body.get("maxUses") if "maxUses" in body else body.get("max_uses")
        expires_days = body.get("expiresDays") if "expiresDays" in body else body.get("expires_days")

        item = _links_store.create_for_set(owner_id=viewer, set_id=set_id, max_uses=max_uses, expires_days=expires_days)
        if not item:
            return Response({"ok": False, "restricted": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class SetInviteLinkRevokeView(APIView):
    """POST /api/sets/<id>/invite-links/<token>/revoke (owner-only)."""

    throttle_scope = "invites_links_revoke"

    def post(self, request, set_id: str, token: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        item = _links_store.revoke(owner_id=viewer, set_id=set_id, token=token)
        if not item:
            return Response({"ok": False, "restricted": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class InviteLinkPublicView(APIView):
    """GET /api/invite-links/<token> (public)."""

    throttle_scope = "invites_links_public"

    def get(self, request, token: str):
        valid, item, reason = _links_store.public_get(token=token)
        return Response({"ok": True, "valid": bool(valid), "reason": reason, "item": item}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class InviteLinkAcceptView(APIView):
    """POST /api/invite-links/<token>/accept (auth required)."""

    throttle_scope = "invites_links_accept"

    def post(self, request, token: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        ok, payload, reason = _links_store.accept(token=token, viewer_id=viewer)
        if not ok or not payload:
            return Response({"ok": False, "restricted": False, "error": reason}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, **payload}, status=status.HTTP_200_OK)
