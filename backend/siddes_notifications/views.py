from __future__ import annotations

import time

from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role

from .models import Notification


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


class NotificationsListView(APIView):
    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(
                {"ok": True, "restricted": True, "viewer": None, "role": role, "count": 0, "items": []},
                status=status.HTTP_200_OK,
            )

        # sd_423_mute: filter notifications from muted actors

        muted_check = None

        try:

            from siddes_safety.policy import is_muted

            muted_check = is_muted

        except Exception:

            muted_check = None


        qs = Notification.objects.filter(viewer_id=viewer).order_by("-created_at")[:50]
        side = str(request.headers.get("x-sd-side") or request.query_params.get("side") or "").strip().lower()
        if side not in ("public", "friends", "close", "work"):
            side = "public"
        qs = qs.filter(side=side)
        items: list[Dict[str, Any]] = []
        for n in qs:
            try:
                if muted_check and muted_check(viewer, str(getattr(n, "actor", "") or "")):
                    continue
            except Exception:
                pass
            items.append(
                {
                    "id": n.id,
                    "actor": n.actor,
                    "type": n.type,
                    "ts": int(float(n.created_at or 0.0) * 1000),
                    "glimpse": n.glimpse,
                    "postId": n.post_id,
                    "postTitle": n.post_title,
                    "read": bool(n.read_at),
                }
            )

        return Response(
            {"ok": True, "restricted": False, "viewer": viewer, "role": role, "count": len(items), "items": items},
            status=status.HTTP_200_OK,
        )


class NotificationsMarkAllReadView(APIView):
    permission_classes: list = []

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        now = float(time.time())
        try:
            side = str(request.headers.get("x-sd-side") or request.query_params.get("side") or "").strip().lower()
            if side not in ("public", "friends", "close", "work"):
                side = "public"
            updated = Notification.objects.filter(viewer_id=viewer, side=side, read_at__isnull=True).update(read_at=now)
        except Exception:
            updated = 0

        return Response({"ok": True, "viewer": viewer, "role": role, "marked": int(updated)}, status=status.HTTP_200_OK)
