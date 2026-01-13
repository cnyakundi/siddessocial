"""Sets API views (Django REST Framework).

Endpoints mirror the Next.js API stubs:
- GET/POST   /api/sets
- GET/PATCH  /api/sets/<id>
- GET        /api/sets/<id>/events

Viewer gating:
- Viewer identity comes from DRF auth.
- In DEBUG, a dev viewer can be provided via header/cookie (see drf_auth.py).

Access rule (stub v0):
- Writes (POST/PATCH) are owner-only: viewer role must be `me`.
- Reads (GET) are membership-based: a viewer can read Sets they own OR Sets where
  they are explicitly listed as a member.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role

from .store_db import DbSetsStore, VALID_SIDES
from .store_memory_api import InMemoryApiSetsStore


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _db_ready() -> bool:
    """Best-effort check: is DB reachable AND are Sets tables migrated?"""

    try:
        from django.db import connections

        conn = connections["default"]
        conn.ensure_connection()

        from .models import SiddesSet

        SiddesSet.objects.using(conn.alias).all()[:1].exists()
        return True
    except Exception:
        return False


STORE_MODE = os.environ.get("SD_SETS_STORE", "auto").strip().lower()
USE_AUTO = STORE_MODE in ("auto", "smart")
AUTO_DB_READY = _db_ready() if USE_AUTO else False

USE_DB = STORE_MODE in ("db", "database", "postgres", "pg") or (USE_AUTO and AUTO_DB_READY)
USE_MEMORY = STORE_MODE in ("memory", "inmemory") or (USE_AUTO and not AUTO_DB_READY)

# Default: auto -> prefer DB when ready, otherwise memory.
_store = DbSetsStore() if USE_DB else InMemoryApiSetsStore()


def _raw_viewer_from_request(request) -> Optional[str]:
    """Resolve a viewer string.

    Priority:
    1) Authenticated user (real auth or dev header/cookie auth)
    2) (DEBUG only) direct header/cookie fallback

    In production, only real auth should apply.
    """

    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return str(getattr(user, "id", "") or "").strip() or None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return raw or None


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    """Return (has_viewer, viewer_norm, role)."""

    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or "anon").strip() or "anon"
    role = resolve_viewer_role(viewer) or "anon"
    return has_viewer, viewer, role


def _restricted_payload(has_viewer: bool, viewer: str, role: str, *, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "ok": True,
        "restricted": True,
        "viewer": viewer if has_viewer else None,
        "role": role,
    }
    if extra:
        out.update(extra)
    return out


@method_decorator(csrf_exempt, name="dispatch")
class SetsView(APIView):
    """GET/POST /api/sets"""

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)

        # Default-safe: unknown viewer => restricted, empty list.
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)

        side = str(request.query_params.get("side") or "").strip().lower() or None
        if side is not None and side not in VALID_SIDES:
            side = None

        items = _store.list(owner_id=viewer, side=side)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "items": items}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        # Bulk create
        if isinstance(body.get("inputs"), list):
            inputs = [x for x in body.get("inputs") if isinstance(x, dict)]
            items = _store.bulk_create(owner_id=viewer, inputs=inputs)  # type: ignore[arg-type]
            return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "items": items}, status=status.HTTP_200_OK)

        side = str(body.get("side") or "friends")
        label = str(body.get("label") or "Untitled")
        members = body.get("members") if isinstance(body.get("members"), list) else []
        color = body.get("color") if isinstance(body.get("color"), str) else None

        item = _store.create(owner_id=viewer, side=side, label=label, members=members, color=color)  # type: ignore[arg-type]
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class SetDetailView(APIView):
    """GET/PATCH /api/sets/<id>"""

    def get(self, request, set_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"item": None}), status=status.HTTP_200_OK)

        # Membership-based read: only return the item if viewer is owner or member.
        item = _store.get(owner_id=viewer, set_id=set_id)
        if not item:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"item": None}), status=status.HTTP_200_OK)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)

    def patch(self, request, set_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        patch: Dict[str, Any] = {}
        if isinstance(body.get("label"), str):
            patch["label"] = body.get("label")
        if isinstance(body.get("members"), list):
            patch["members"] = body.get("members")
        if isinstance(body.get("side"), str):
            patch["side"] = body.get("side")
        if isinstance(body.get("color"), str):
            patch["color"] = body.get("color")

        item = _store.update(owner_id=viewer, set_id=set_id, patch=patch)
        if not item:
            return Response({"ok": False, "restricted": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "item": item}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class SetEventsView(APIView):
    """GET /api/sets/<id>/events"""

    def get(self, request, set_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)

        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)

        # Avoid existence leaks: only return events if the set is readable.
        item = _store.get(owner_id=viewer, set_id=set_id)
        if not item:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"items": []}), status=status.HTTP_200_OK)

        items = _store.events(owner_id=viewer, set_id=set_id)
        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "items": items}, status=status.HTTP_200_OK)
