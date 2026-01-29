from __future__ import annotations

from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InboxThread

# Typing indicator: ephemeral, privacy-safe, deny-by-default.
# - Only authenticated users
# - Only for threads owned by that viewer (owner_viewer_id = "me_<uid>")
# - Stored in cache/redis with a short TTL
#
# Contract:
#   POST /api/inbox/typing  { threadId, typing?: boolean }
#   GET  /api/inbox/typing?threadId=...
#
# Response:
#   { ok: true, typing: boolean, restricted?: boolean }


def _viewer_for_user_id(uid: int) -> str:
    return f"me_{int(uid)}"


def _pair_key(locked_side: str, uid_a: int, uid_b: int) -> str:
    a = int(uid_a)
    b = int(uid_b)
    lo, hi = (a, b) if a <= b else (b, a)
    side = str(locked_side or "").strip().lower() or "friends"
    return f"dm:{side}:{lo}:{hi}"


def _typing_cache_key(pair_key: str, uid: int) -> str:
    return f"sd_inbox_typing:{pair_key}:{int(uid)}"


class InboxTypingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        thread_id = str(request.query_params.get("threadId") or request.query_params.get("thread_id") or "").strip()
        if not thread_id:
            return Response({"ok": True, "typing": False})

        uid = int(getattr(request.user, "id", 0) or 0)
        if uid <= 0:
            return Response({"ok": True, "restricted": True, "typing": False})

        viewer = _viewer_for_user_id(uid)
        t = (
            InboxThread.objects.filter(id=thread_id, owner_viewer_id=viewer)
            .only("participant_user_id", "locked_side")
            .first()
        )
        if not t:
            return Response({"ok": True, "restricted": True, "typing": False})

        other_raw = str(getattr(t, "participant_user_id", "") or "").strip()
        if not other_raw.isdigit():
            # No stable counterpart id; fail-closed.
            return Response({"ok": True, "typing": False})

        other_uid = int(other_raw)
        pair = _pair_key(str(getattr(t, "locked_side", "") or ""), uid, other_uid)
        key_other = _typing_cache_key(pair, other_uid)

        typing = cache.get(key_other) is not None
        return Response({"ok": True, "typing": bool(typing)})

    def post(self, request):
        data = request.data if hasattr(request, "data") else {}
        thread_id = str((data or {}).get("threadId") or (data or {}).get("thread_id") or "").strip()
        if not thread_id:
            return Response({"ok": True})

        uid = int(getattr(request.user, "id", 0) or 0)
        if uid <= 0:
            return Response({"ok": True, "restricted": True})

        viewer = _viewer_for_user_id(uid)
        t = (
            InboxThread.objects.filter(id=thread_id, owner_viewer_id=viewer)
            .only("participant_user_id", "locked_side")
            .first()
        )
        if not t:
            return Response({"ok": True, "restricted": True})

        other_raw = str(getattr(t, "participant_user_id", "") or "").strip()
        if not other_raw.isdigit():
            # No stable counterpart id; deny-by-default.
            return Response({"ok": True})

        other_uid = int(other_raw)
        pair = _pair_key(str(getattr(t, "locked_side", "") or ""), uid, other_uid)
        key_me = _typing_cache_key(pair, uid)

        typing = bool((data or {}).get("typing", True))
        if typing:
            # TTL: 6 seconds. Client pings at ~1s intervals when typing.
            cache.set(key_me, 1, timeout=6)
        else:
            cache.delete(key_me)

        return Response({"ok": True})
