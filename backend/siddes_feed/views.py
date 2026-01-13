"""Feed API views (Django REST Framework).

Contract (mirrors frontend expectations):
- Default-safe: unknown viewer => `restricted: true` with empty items.
- Endpoint: GET /api/feed?side=<public|friends|close|work>

Viewer identity (stub/demo):
- Header: x-sd-viewer
- Cookie: sd_viewer
("real" auth will replace this later, but the contract stays the same.)
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role
from siddes_visibility.policy import SideId
from .feed_stub import list_feed


_ALLOWED_SIDES = {"public", "friends", "close", "work"}


def _raw_viewer_from_request(request) -> Optional[str]:
    # Prefer header (cross-origin docker dev), fall back to cookie (same-origin).
    return request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or "anon").strip() or "anon"
    role = resolve_viewer_role(viewer) or "anon"
    return has_viewer, viewer, role


def _restricted_payload(
    has_viewer: bool,
    viewer: str,
    role: str,
    *,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    out: Dict[str, Any] = {"ok": True, "restricted": True, "viewer": viewer if has_viewer else None, "role": role}
    if extra:
        out.update(extra)
    return out


class FeedView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request, *args, **kwargs):
        has_viewer, viewer, role = _viewer_ctx(request)

        side_raw = str(getattr(request, "query_params", {}).get("side") or "public").strip().lower()
        side: SideId = side_raw if side_raw in _ALLOWED_SIDES else "public"  # type: ignore[assignment]

        # Default-safe: unknown viewer => restricted, no content.
        if not has_viewer:
            return Response(
                _restricted_payload(has_viewer, viewer, role, extra={"side": side, "count": 0, "items": []}),
                status=status.HTTP_200_OK,
            )

        data = list_feed(viewer_id=viewer, side=side)
        payload: Dict[str, Any] = {"ok": True, "restricted": False, "viewer": viewer, "role": role}
        payload.update(data)
        return Response(payload, status=status.HTTP_200_OK)
