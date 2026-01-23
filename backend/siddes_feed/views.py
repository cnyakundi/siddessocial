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

import hashlib
import os

from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.core.cache import cache

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role
from siddes_visibility.policy import SideId
from .feed_stub import list_feed


_ALLOWED_SIDES = {"public", "friends", "close", "work"}


def _raw_viewer_from_request(request) -> Optional[str]:
    # Return a viewer id string or None (default-safe).
    #
    # Priority:
    # 1) Real auth (Session/JWT/etc): me_<django_user_id>
    # 2) DEV-only stub identity:
    #    - Header: x-sd-viewer
    #    - Cookie: sd_viewer
    # 3) PROD safety: ignore dev identity when DEBUG=False

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


# --- Feed caching (sd_364) ---
# Cache is server-side only (never edge-cache personalized/private payloads).
# Key includes viewer + role + side + topic + cursor + limit to avoid leaks.

def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _feed_cache_enabled() -> bool:
    # Default ON in dev; safe because keys include viewer and TTL is short.
    return _truthy(os.environ.get("SIDDES_FEED_CACHE_ENABLED", "1"))


def _feed_cache_ttl() -> int:
    raw = os.environ.get("SIDDES_FEED_CACHE_TTL_SECS", "15")
    try:
        ttl = int(str(raw).strip())
    except Exception:
        ttl = 15
    if ttl < 0:
        ttl = 0
    # Hard cap (avoid accidentally caching huge payloads for too long)
    if ttl > 300:
        ttl = 300
    return ttl


def _feed_cache_key(*, viewer: str, role: str, side: str, topic: str | None, set_id: str | None, limit: int, cursor: str | None) -> str:
    raw = f"v1|viewer={viewer}|role={role}|side={side}|topic={topic or ''}|set={set_id or ''}|limit={limit}|cursor={cursor or ''}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"feed:v1:{h}"


class FeedView(APIView):
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

        topic_raw = str(getattr(request, "query_params", {}).get("topic") or "").strip().lower()
        topic = topic_raw or None

        set_raw = str(getattr(request, "query_params", {}).get("set") or "").strip()
        set_id = set_raw or None

        limit_raw = str(getattr(request, "query_params", {}).get("limit") or "").strip()
        cursor_raw = str(getattr(request, "query_params", {}).get("cursor") or "").strip() or None

        try:
            limit = int(limit_raw) if limit_raw else 200
        except Exception:
            limit = 200

        # Clamp (keep old behavior when omitted: defaults to 200)
        if limit < 1:
            limit = 1
        if limit > 200:
            limit = 200

        cache_status = "bypass"
        cache_ttl = _feed_cache_ttl()
        cache_key = None

        if _feed_cache_enabled() and cache_ttl > 0:
            cache_key = _feed_cache_key(
                viewer=viewer,
                role=role,
                side=str(side),
                topic=topic,
                set_id=set_id,
                limit=limit,
                cursor=cursor_raw,
            )
            try:
                cached = cache.get(cache_key)
            except Exception:
                cached = None
                cache_key = None
                cache_status = "bypass"
            if cached is not None:
                payload: Dict[str, Any] = {"ok": True, "restricted": False, "viewer": viewer, "role": role}
                payload.update(cached)
                resp = Response(payload, status=status.HTTP_200_OK)
                resp["X-Siddes-Cache"] = "hit"
                resp["X-Siddes-Cache-Ttl"] = str(cache_ttl)
                return resp
            if cache_key is not None:
                cache_status = "miss"
        data = list_feed(viewer_id=viewer, side=side, topic=topic, limit=limit, cursor=cursor_raw)

        if cache_key is not None and cache_status == "miss":
            try:
                cache.set(cache_key, data, timeout=cache_ttl)
            except Exception:
                cache_status = "bypass"

        payload: Dict[str, Any] = {"ok": True, "restricted": False, "viewer": viewer, "role": role}
        payload.update(data)
        resp = Response(payload, status=status.HTTP_200_OK)
        resp["X-Siddes-Cache"] = cache_status
        if cache_status != "bypass":
            resp["X-Siddes-Cache-Ttl"] = str(cache_ttl)
        return resp
