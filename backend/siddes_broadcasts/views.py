from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.utils.decorators import method_decorator
from siddes_backend.csrf import dev_csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role

from .models import BroadcastMember

from .store_db import STORE


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
class BroadcastsView(APIView):
    """GET/POST /api/broadcasts"""

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)

        tab = str(request.query_params.get("tab") or "following")
        q = str(request.query_params.get("q") or "").strip() or None
        category = str(request.query_params.get("category") or "").strip() or None

        items = STORE.list(viewer_id=viewer, tab=tab, q=q, category=category)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "tab": tab, "count": len(items), "items": items}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        name = str(body.get("name") or body.get("label") or "Untitled").strip() or "Untitled"
        handle = str(body.get("handle") or "").strip()
        category = str(body.get("category") or "").strip()
        desc = str(body.get("desc") or "").strip()
        pinned_rules = str(body.get("pinned_rules") or body.get("pinnedRules") or "").strip()

        try:
            item = STORE.create(owner_id=viewer, name=name, handle=handle, category=category, desc=desc, pinned_rules=pinned_rules)
        except ValueError as e:
            msg = str(e)
            if "bad_handle" in msg:
                return Response({"ok": False, "error": "bad_handle"}, status=status.HTTP_400_BAD_REQUEST)
            if "integrity" in msg:
                return Response({"ok": False, "error": "handle_taken"}, status=status.HTTP_409_CONFLICT)
            return Response({"ok": False, "error": "create_failed"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_201_CREATED)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastDetailView(APIView):
    """GET /api/broadcasts/<id>"""

    def get(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"item": None}), status=status.HTTP_200_OK)

        item = STORE.get(viewer_id=viewer, broadcast_id=broadcast_id)
        if not item:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastFollowView(APIView):
    def post(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            item = STORE.follow(viewer_id=viewer, broadcast_id=broadcast_id)
        except ValueError:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastUnfollowView(APIView):
    def post(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            item = STORE.unfollow(viewer_id=viewer, broadcast_id=broadcast_id)
        except ValueError:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastNotifyView(APIView):
    def post(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        mode = str(body.get("mode") or "off")
        muted = bool(body.get("muted"))

        try:
            item = STORE.set_notify(viewer_id=viewer, broadcast_id=broadcast_id, mode=mode, muted=muted)
        except ValueError:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastPostsView(APIView):
    """GET /api/broadcasts/<id>/posts"""

    def get(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)

        limit_raw = request.query_params.get("limit")
        before_raw = request.query_params.get("before")

        try:
            limit = int(limit_raw) if limit_raw is not None else 30
        except Exception:
            limit = 30

        before: Optional[float] = None
        try:
            if before_raw is not None and str(before_raw).strip():
                before = float(str(before_raw).strip()) / 1000.0
        except Exception:
            before = None

        try:
            items = STORE.list_posts(viewer_id=viewer, broadcast_id=broadcast_id, limit=limit, before=before)
        except ValueError:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "broadcastId": broadcast_id, "count": len(items), "items": items}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastFeedView(APIView):
    """GET /api/broadcasts/feed - posts from broadcasts you follow."""

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)

        limit_raw = request.query_params.get("limit")
        before_raw = request.query_params.get("before")

        try:
            limit = int(limit_raw) if limit_raw is not None else 30
        except Exception:
            limit = 30

        before = None
        try:
            if before_raw is not None and str(before_raw).strip():
                before = float(str(before_raw).strip()) / 1000.0
        except Exception:
            before = None

        items = STORE.feed(viewer_id=viewer, limit=limit, before=before)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "count": len(items), "items": items}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastUnreadView(APIView):
    """GET /api/broadcasts/unread - broadcasts with unread updates (dots, not counts)."""

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": [], "hasUnread": False}), status=status.HTTP_200_OK)

        items = STORE.list_unread(viewer_id=viewer, limit=50)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "hasUnread": bool(items), "count": len(items), "items": items}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastSeenView(APIView):
    """POST /api/broadcasts/<id>/seen - mark a broadcast as seen for unread dots."""

    def post(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        STORE.mark_seen(viewer_id=viewer, broadcast_id=broadcast_id)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "broadcastId": broadcast_id}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BroadcastWritersView(APIView):
    """GET/POST/DELETE /api/broadcasts/<id>/writers

    - GET: owner/writer can view the team
    - POST: owner adds a writer (by viewerId string)
    - DELETE: owner removes a writer (by viewerId string)
    """

    def get(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        # Owner/writer only
        can_view = BroadcastMember.objects.filter(broadcast_id=str(broadcast_id), viewer_id=str(viewer), role__in=["owner", "writer"]).exists()
        if not can_view:
            return Response({"ok": False, "restricted": False, "error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        team = STORE.list_writers(viewer_id=viewer, broadcast_id=broadcast_id)
        return Response({"ok": True, "broadcastId": broadcast_id, "items": team}, status=status.HTTP_200_OK)

    def post(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data or {}
        writer_id = str(data.get("viewerId") or "").strip()
        if not writer_id:
            return Response({"ok": False, "error": "viewerId_required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            STORE.add_writer(owner_viewer_id=viewer, broadcast_id=broadcast_id, writer_viewer_id=writer_id)
        except PermissionError:
            return Response({"ok": False, "error": "owner_required"}, status=status.HTTP_403_FORBIDDEN)

        team = STORE.list_writers(viewer_id=viewer, broadcast_id=broadcast_id)
        return Response({"ok": True, "broadcastId": broadcast_id, "items": team}, status=status.HTTP_200_OK)

    def delete(self, request, broadcast_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data or {}
        writer_id = str(data.get("viewerId") or "").strip()
        if not writer_id:
            return Response({"ok": False, "error": "viewerId_required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            STORE.remove_writer(owner_viewer_id=viewer, broadcast_id=broadcast_id, writer_viewer_id=writer_id)
        except PermissionError:
            return Response({"ok": False, "error": "owner_required"}, status=status.HTTP_403_FORBIDDEN)

        team = STORE.list_writers(viewer_id=viewer, broadcast_id=broadcast_id)
        return Response({"ok": True, "broadcastId": broadcast_id, "items": team}, status=status.HTTP_200_OK)

