"""Inbox API views (Django REST Framework).

Goals:
- Match `docs/INBOX_BACKEND_CONTRACT.md` exactly.
- Stay **default-safe**: if a viewer can't be confidently authenticated/authorized,
  return `restricted: true` with no content.

Implementation note:
- We do NOT use Django Ninja. DRF is the official API layer.
- We exempt these endpoints from Django's CSRF middleware because the API will
  ultimately be token/session-authenticated at the application layer (not via
  CSRF-protected form posts). This keeps dev flow working for beginners.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .endpoint_stub import get_thread, list_threads, send_message, set_locked_side
from .store_devnull import DevNullInboxStore
from .store_db import DbInboxStore
from .store_memory import InMemoryInboxStore


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


SIDE_IDS = ("public", "friends", "close", "work")

def _db_ready() -> bool:
    """Best-effort check: is the DB reachable and are Inbox tables migrated?

    Purpose (sd_123): support `SD_INBOX_STORE=auto`.

    We keep this intentionally forgiving:
    - If the DB is down, we fall back to the in-memory store.
    - If migrations haven't been applied yet, we also fall back.
    """

    try:
        from django.db import connections

        conn = connections["default"]
        conn.ensure_connection()

        # Touch a known inbox table to confirm migrations are applied.
        from .models import InboxThread

        InboxThread.objects.using(conn.alias).all()[:1].exists()
        return True
    except Exception:
        return False


STORE_MODE = os.environ.get("SD_INBOX_STORE", "memory").strip().lower()
USE_AUTO = STORE_MODE in ("auto", "smart")
DUALWRITE_DB = _truthy(os.environ.get("SD_INBOX_DUALWRITE_DB", "0"))

AUTO_DB_READY = _db_ready() if USE_AUTO else False
USE_MEMORY = STORE_MODE in ("memory", "inmemory") or (USE_AUTO and not AUTO_DB_READY)
USE_DB = STORE_MODE in ("db", "database", "postgres", "pg") or (USE_AUTO and AUTO_DB_READY)

if USE_DB:
    store = DbInboxStore()
elif USE_MEMORY:
    mem = InMemoryInboxStore()
    if DUALWRITE_DB:
        from .store_dualwrite import DualWriteInboxStore

        store = DualWriteInboxStore(primary=mem, shadow_db=DbInboxStore())
    else:
        store = mem
else:
    store = DevNullInboxStore()


# Seed demo content once (dev-only). Safe because viewer auth still gates access.
if USE_MEMORY and getattr(settings, "DEBUG", False):
    try:
        store.seed_demo()
    except Exception:
        # If seeding fails, keep the server alive (dev tolerance)
        pass


def get_viewer_id(request) -> Optional[str]:
    """Resolve the viewer identity for stub/demo mode.

    Priority:
    1) DRF authenticated user (real auth, future) → treated as `me` for now.
    2) DEV-only header/cookie identity (settings.DEBUG=True):
       - Header `x-sd-viewer`
       - Cookie `sd_viewer`

    Note: the legacy `?viewer=` query param is **deprecated** and intentionally ignored
    (even in dev) to avoid leaking viewer identities in URLs.

    Default-safe:
    - Return None when the viewer is unknown.
    - Normalize any provided viewer string into a deterministic role:
      anon | friends | close | work | me
    """

    # Prefer real authentication (Session/JWT/etc) when present.
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return "me"

    # Military-grade direction: never trust dev headers/cookies in production.
    if not getattr(settings, "DEBUG", False):
        return None

    from .visibility_stub import resolve_viewer_role

    raw = request.headers.get("x-sd-viewer")
    if raw:
        return resolve_viewer_role(raw)

    # DRF Request delegates to underlying HttpRequest for COOKIES.
    c = getattr(request, "COOKIES", {}).get("sd_viewer")
    if c:
        return resolve_viewer_role(c)

    return None


def _clamp_int(raw: Any, *, default: int, min_v: int, max_v: int) -> int:
    try:
        v = int(raw)
    except Exception:
        return default
    return max(min_v, min(max_v, v))


@method_decorator(csrf_exempt, name="dispatch")
class InboxThreadsView(APIView):
    """GET /api/inbox/threads"""

    throttle_scope = "inbox_threads"

    def get(self, request):
        side = request.query_params.get("side")
        limit = _clamp_int(request.query_params.get("limit"), default=20, min_v=1, max_v=50)
        cursor = request.query_params.get("cursor")

        if side and side not in SIDE_IDS:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

        data = list_threads(
            store,
            viewer_id=get_viewer_id(request),
            side=side if side else None,
            limit=limit,
            cursor=cursor if cursor else None,
        )
        return Response(data, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class InboxThreadView(APIView):
    """GET/POST /api/inbox/thread/:id"""

    throttle_scope = "inbox_thread"

    def get_throttles(self):
        # Method-specific throttle scopes.
        # POST (send/move) is treated as more expensive than GET (read).
        if getattr(self, "request", None) is not None and self.request.method == "POST":
            self.throttle_scope = "inbox_send"
        else:
            self.throttle_scope = "inbox_thread"
        return super().get_throttles()

    def get(self, request, thread_id: str):
        limit = _clamp_int(request.query_params.get("limit"), default=30, min_v=1, max_v=100)
        cursor = request.query_params.get("cursor")

        data = get_thread(
            store,
            viewer_id=get_viewer_id(request),
            thread_id=thread_id,
            limit=limit,
            cursor=cursor if cursor else None,
        )
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, thread_id: str):
        viewer = get_viewer_id(request)
        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        if body.get("setLockedSide") is not None:
            side = str(body.get("setLockedSide") or "").strip()
            if side not in SIDE_IDS:
                return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

            data = set_locked_side(store, viewer_id=viewer, thread_id=thread_id, side=side)  # type: ignore[arg-type]
            return Response(data, status=status.HTTP_200_OK)

        text = str(body.get("text") or "")
        if not text.strip():
            # Contract: 400 + ok:false
            return Response({"ok": False, "error": "missing_text"}, status=status.HTTP_400_BAD_REQUEST)

        client_key = body.get("clientKey") or body.get("client_key")

        try:
            data = send_message(
                store,
                viewer_id=viewer,
                thread_id=thread_id,
                text=text,
                client_key=str(client_key) if client_key is not None else None,
            )
        except ValueError:
            return Response({"ok": False, "error": "missing_text"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(data, status=status.HTTP_200_OK)


def _message_dict(m: Any) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(getattr(m, "id", "")),
        "ts": int(getattr(m, "ts", 0)),
        "from": str(getattr(m, "from_id", "")),
        "text": str(getattr(m, "text", "")),
        "side": str(getattr(m, "side", "")),
        "queued": bool(getattr(m, "queued", False)),
    }
    ck = getattr(m, "client_key", None)
    if ck is not None:
        out["clientKey"] = ck
    return out


def _meta_dict(meta: Any) -> dict[str, Any]:
    return {
        "lockedSide": str(getattr(meta, "locked_side", "")),
        "updatedAt": int(getattr(meta, "updated_at", 0)),
    }


def _debug_enabled() -> bool:
    return _truthy(os.environ.get("DJANGO_DEBUG", "0"))


@method_decorator(csrf_exempt, name="dispatch")
class InboxDebugResetUnreadView(APIView):
    """POST /api/inbox/debug/unread/reset (dev-only)

    Body: { threadId }

    Notes:
    - Only enabled when DJANGO_DEBUG is truthy.
    - Only allowed for viewer=me.
    """

    throttle_scope = "inbox_debug"

    def post(self, request):
        if not _debug_enabled():
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        viewer = get_viewer_id(request)
        if viewer != "me":
            return Response({"ok": False, "error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        thread_id = str(body.get("threadId") or body.get("thread_id") or "").strip()
        if not thread_id:
            return Response({"ok": False, "error": "missing_thread"}, status=status.HTTP_400_BAD_REQUEST)

        fn = getattr(store, "debug_reset_unread", None)
        if not callable(fn):
            return Response({"ok": False, "error": "not_supported"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        try:
            fn(viewer_id=viewer, thread_id=thread_id)
        except KeyError:
            return Response({"ok": False, "error": "unknown_thread"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({"ok": False, "error": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"ok": True}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class InboxDebugIncomingView(APIView):
    """POST /api/inbox/debug/incoming (dev-only)

    Body: { threadId, text }

    Notes:
    - Only enabled when DJANGO_DEBUG is truthy.
    - Only allowed for viewer=me.
    """

    throttle_scope = "inbox_debug"

    def post(self, request):
        if not _debug_enabled():
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        viewer = get_viewer_id(request)
        if viewer != "me":
            return Response({"ok": False, "error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        thread_id = str(body.get("threadId") or body.get("thread_id") or "").strip()
        text = str(body.get("text") or "Incoming (simulated) message").strip()

        if not thread_id:
            return Response({"ok": False, "error": "missing_thread"}, status=status.HTTP_400_BAD_REQUEST)

        fn = getattr(store, "debug_append_incoming", None)
        if not callable(fn):
            return Response({"ok": False, "error": "not_supported"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        try:
            msg, meta = fn(viewer_id=viewer, thread_id=thread_id, text=text)
        except KeyError:
            return Response({"ok": False, "error": "unknown_thread"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({"ok": False, "error": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"ok": True, "message": _message_dict(msg), "meta": _meta_dict(meta)}, status=status.HTTP_200_OK)
