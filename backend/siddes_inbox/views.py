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
from siddes_backend.csrf import dev_csrf_exempt
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .endpoint_stub import get_thread, list_threads, send_message, set_locked_side
from .store_devnull import DevNullInboxStore
from .store_db import DbInboxStore
from .store_memory import InMemoryInboxStore

from siddes_safety.policy import is_blocked_pair


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


SIDE_IDS = ("public", "friends", "close", "work")

# sd_398: inbox blocks enforcement (hard stop: no view, no DM)


def _restricted_meta_payload() -> dict[str, Any]:
    return {"ok": True, "restricted": True, "meta": None}


def _restricted_send_payload() -> dict[str, Any]:
    return {"ok": True, "restricted": True, "message": None, "meta": None}


def _restricted_thread_payload() -> dict[str, Any]:
    return {
        "ok": True,
        "restricted": True,
        "thread": None,
        "meta": None,
        "messages": [],
        "messagesHasMore": False,
        "messagesNextCursor": None,
    }


def _other_token_from_thread_payload(thread_obj: Any) -> Optional[str]:
    try:
        t = thread_obj or {}
        if not isinstance(t, dict):
            return None
        p = t.get("participant") or {}
        if not isinstance(p, dict):
            return None
        tok = str(p.get("handle") or p.get("userId") or "").strip()
        return tok or None
    except Exception:
        return None


def _counterparty_token_for_thread_id(thread_id: str) -> Optional[str]:
    """Best-effort: look up the DB thread snapshot and return other party token.

    Memory-store threads may not exist in DB; fail-open in that case.
    """
    try:
        from .models import InboxThread  # local import (db store only)
        t = InboxThread.objects.filter(id=str(thread_id)).first()
        if not t:
            return None
        tok = str(getattr(t, "participant_handle", "") or "").strip()
        if tok:
            return tok
        tok2 = str(getattr(t, "participant_user_id", "") or "").strip()
        return tok2 or None
    except Exception:
        return None


def _filter_blocked_threads_payload(viewer_id: Optional[str], payload: Any) -> Any:
    try:
        if not viewer_id or not isinstance(payload, dict) or payload.get("restricted"):
            return payload
        items = payload.get("items")
        if not isinstance(items, list) or not items:
            return payload

        kept = []
        for it in items:
            tok = None
            try:
                if isinstance(it, dict):
                    p = it.get("participant")
                    if isinstance(p, dict):
                        tok = str(p.get("handle") or p.get("userId") or "").strip() or None
            except Exception:
                tok = None

            if tok and is_blocked_pair(str(viewer_id), str(tok)):
                continue
            kept.append(it)

        out = dict(payload)
        out["items"] = kept
        return out
    except Exception:
        return payload


def _restrict_blocked_thread_payload(viewer_id: Optional[str], payload: Any) -> Any:
    try:
        if not viewer_id or not isinstance(payload, dict) or payload.get("restricted"):
            return payload
        tok = _other_token_from_thread_payload(payload.get("thread"))
        if tok and is_blocked_pair(str(viewer_id), str(tok)):
            return _restricted_thread_payload()
        return payload
    except Exception:
        return payload


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



IS_DEBUG = getattr(settings, "DEBUG", False)
ALLOW_MEMORY = (str(os.environ.get("SIDDES_ALLOW_MEMORY_STORES", "")).strip() == "1") and bool(IS_DEBUG)

# World-ready default: DB-backed inbox store.
# Memory/demo inbox is allowed ONLY when DEBUG=True and SIDDES_ALLOW_MEMORY_STORES=1.
if ALLOW_MEMORY:
    mem = InMemoryInboxStore()
    try:
        mem.seed_demo()
    except Exception:
        pass
    store = mem
else:
    store = DbInboxStore()



def get_viewer_id(request) -> Optional[str]:
    # Resolve viewer id (default-safe).
    #
    # Priority:
    # 1) DRF authenticated user (Session/JWT/etc) -> me_<django_user_id>
    # 2) DEV-only header/cookie identity (settings.DEBUG=True)
    #
    # PROD safety:
    # - Never trust dev headers/cookies when DEBUG=False.

    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        uid = str(getattr(user, "id", "") or "").strip()
        return f"me_{uid}" if uid else None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return raw or None



def _clamp_int(raw: Any, *, default: int, min_v: int, max_v: int) -> int:
    try:
        v = int(raw)
    except Exception:
        return default
    return max(min_v, min(max_v, v))


@method_decorator(dev_csrf_exempt, name="dispatch")
class InboxThreadsView(APIView):
    """GET /api/inbox/threads"""

    throttle_scope = "inbox_threads"

    def get(self, request):
        side = request.query_params.get("side")
        limit = _clamp_int(request.query_params.get("limit"), default=20, min_v=1, max_v=50)
        cursor = request.query_params.get("cursor")

        if side and side not in SIDE_IDS:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)
        viewer_id = get_viewer_id(request)

        data = list_threads(
            store,
            viewer_id=viewer_id,
            side=side if side else None,
            limit=limit,
            cursor=cursor if cursor else None,
        )
        data = _filter_blocked_threads_payload(viewer_id, data)
        return Response(data, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
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
        viewer_id = get_viewer_id(request)

        data = get_thread(
            store,
            viewer_id=viewer_id,
            thread_id=thread_id,
            limit=limit,
            cursor=cursor if cursor else None,
        )
        data = _restrict_blocked_thread_payload(viewer_id, data)
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, thread_id: str):
        viewer = get_viewer_id(request)
        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        # sd_398: Blocks must hard-stop inbox access.
        other_token = _counterparty_token_for_thread_id(thread_id)
        if viewer and other_token and is_blocked_pair(str(viewer), str(other_token)):
            # Hide existence details: behave like restricted.
            if body.get("setLockedSide") is not None:
                return Response(_restricted_meta_payload(), status=status.HTTP_200_OK)
            return Response(_restricted_send_payload(), status=status.HTTP_200_OK)


        if body.get("setLockedSide") is not None:
            side = str(body.get("setLockedSide") or "").strip()
            if side not in SIDE_IDS:
                return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

            data = set_locked_side(store, viewer_id=viewer, thread_id=thread_id, side=side)  # type: ignore[arg-type]
            return Response(data, status=status.HTTP_200_OK)

        raw_text = str(body.get("text") or "")
        text = raw_text.strip()
        if not text:
            # Contract: 400 + ok:false
            return Response({"ok": False, "error": "missing_text"}, status=status.HTTP_400_BAD_REQUEST)

        # sd_360: server-side message size limits (prevents DoS/DB bloat)
        max_len = 2000
        if len(text) > max_len:
            return Response({"ok": False, "error": "too_long", "max": max_len}, status=status.HTTP_400_BAD_REQUEST)

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


@method_decorator(dev_csrf_exempt, name="dispatch")
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


@method_decorator(dev_csrf_exempt, name="dispatch")
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
