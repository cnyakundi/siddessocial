from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role
from siddes_visibility.policy import VisibilityContext, can_view_post, Post as VPost
from siddes_feed.mock_db import MOCK_POSTS, RELATIONSHIPS, POST_CONTENT

from .runtime_store import POST_STORE, REPLY_STORE
from .trust_gates import enabled as trust_gates_enabled, enforce_public_write_gates, normalize_trust_level

_ALLOWED_SIDES = {"public", "friends", "close", "work"}


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


def _trust_level(request, *, role: str) -> int:
    fallback = 0
    if role == "me":
        fallback = 3
    elif role in ("work", "close"):
        fallback = 2
    elif role == "friends":
        fallback = 1

    raw = request.headers.get("x-sd-trust") or getattr(request, "COOKIES", {}).get("sd_trust")
    return normalize_trust_level(raw, fallback)


def _visibility_ctx(viewer_id: str, author_id: str) -> VisibilityContext:
    rel = RELATIONSHIPS.get(author_id) or {"friends": set(), "close": set(), "work": set()}
    return VisibilityContext(
        viewer_id=viewer_id,
        author_id=author_id,
        author_friends=set(rel.get("friends") or set()),
        author_close=set(rel.get("close") or set()),
        author_work=set(rel.get("work") or set()),
    )


def _find_mock_post(post_id: str) -> Optional[VPost]:
    for p in MOCK_POSTS:
        if p.id == post_id:
            return p
    return None


def _feed_post_from_mock(p: VPost) -> Dict[str, Any]:
    c = POST_CONTENT.get(p.id, {})
    author = str(c.get("author") or p.author_id)
    text = str(c.get("text") or "")
    return {
        "id": p.id,
        "author": author,
        "handle": f"@{p.author_id}",
        "time": "now",
        "content": text,
        "kind": "text",
        "signals": 0,
    }


def _feed_post_from_record(rec) -> Dict[str, Any]:
    author_id = str(getattr(rec, "author_id", "") or "")
    author = "Founder" if author_id == "me" else author_id
    handle = "@founder" if author_id == "me" else f"@{author_id or 'anon'}"
    out: Dict[str, Any] = {
        "id": rec.id,
        "author": author,
        "handle": handle,
        "time": "now",
        "content": rec.text,
        "kind": "text",
        "signals": 0,
    }
    if getattr(rec, "set_id", None):
        out["setId"] = rec.set_id
    if getattr(rec, "urgent", False):
        out["urgent"] = True
    if getattr(rec, "side", "") == "public":
        out["trustLevel"] = 3 if author_id == "me" else 1
    return out


@method_decorator(csrf_exempt, name="dispatch")
class PostCreateView(APIView):
    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        side = str(body.get("side") or "public").strip().lower()
        if side not in _ALLOWED_SIDES:
            side = "public"
        text = str(body.get("text") or "").strip()
        set_id = str(body.get("setId") or body.get("set_id") or "").strip() or None
        urgent = bool(body.get("urgent")) if "urgent" in body else False
        client_key = str(body.get("client_key") or body.get("clientKey") or "").strip() or None

        if not text:
            return Response({"ok": False, "error": "empty_text"}, status=status.HTTP_400_BAD_REQUEST)

        if trust_gates_enabled() and side == "public":
            trust = _trust_level(request, role=role)
            gate = enforce_public_write_gates(viewer_id=viewer, trust_level=trust, text=text, kind="post")
            if not gate.get("ok"):
                st = int(gate.get("status") or 403)
                payload: Dict[str, Any] = {"ok": False, "restricted": st == 401, "error": gate.get("error")}
                if gate.get("retry_after_ms") is not None:
                    payload["retry_after_ms"] = gate.get("retry_after_ms")
                if gate.get("min_trust") is not None:
                    payload["min_trust"] = gate.get("min_trust")
                return Response(payload, status=st)

        rec = POST_STORE.create(author_id=viewer, side=side, text=text, set_id=set_id, urgent=urgent, client_key=client_key)
        return Response({"ok": True, "status": 201, "post": _feed_post_from_record(rec), "side": side}, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name="dispatch")
class PostDetailView(APIView):
    def get(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        rec = POST_STORE.get(post_id)
        if rec is not None:
            if not can_view_post(rec.side, _visibility_ctx(viewer, rec.author_id)):
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            return Response({"ok": True, "post": _feed_post_from_record(rec), "side": rec.side}, status=status.HTTP_200_OK)

        mp = _find_mock_post(post_id)
        if not mp:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not can_view_post(mp.side, _visibility_ctx(viewer, mp.author_id)):
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "post": _feed_post_from_mock(mp), "side": mp.side}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class PostRepliesView(APIView):
    def get(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        rec = POST_STORE.get(post_id)
        if rec is not None:
            if not can_view_post(rec.side, _visibility_ctx(viewer, rec.author_id)):
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            mp = _find_mock_post(post_id)
            if not mp or not can_view_post(mp.side, _visibility_ctx(viewer, mp.author_id)):
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        replies = REPLY_STORE.list_for_post(post_id)
        out = [{"id": r.id, "postId": r.post_id, "text": r.text, "createdAt": int(float(r.created_at) * 1000), "clientKey": r.client_key} for r in replies]
        return Response({"ok": True, "postId": post_id, "count": len(out), "replies": out}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class PostReplyCreateView(APIView):
    def post(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        text = str(body.get("text") or "").strip()
        client_key = str(body.get("client_key") or body.get("clientKey") or "").strip() or None

        if not text:
            return Response({"ok": False, "error": "empty_text"}, status=status.HTTP_400_BAD_REQUEST)

        side: Optional[str] = None
        author_id: Optional[str] = None
        rec = POST_STORE.get(post_id)
        if rec is not None:
            side, author_id = str(rec.side), str(rec.author_id)
        else:
            mp = _find_mock_post(post_id)
            if not mp:
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            side, author_id = str(mp.side), str(mp.author_id)

        if not can_view_post(side, _visibility_ctx(viewer, author_id)):  # type: ignore[arg-type]
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if side != "public" and role != "me":
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if trust_gates_enabled() and side == "public":
            trust = _trust_level(request, role=role)
            gate = enforce_public_write_gates(viewer_id=viewer, trust_level=trust, text=text, kind="reply")
            if not gate.get("ok"):
                st = int(gate.get("status") or 403)
                payload: Dict[str, Any] = {"ok": False, "restricted": st == 401, "error": gate.get("error")}
                if gate.get("retry_after_ms") is not None:
                    payload["retry_after_ms"] = gate.get("retry_after_ms")
                if gate.get("min_trust") is not None:
                    payload["min_trust"] = gate.get("min_trust")
                return Response(payload, status=st)

        try:

            r = REPLY_STORE.create(post_id=post_id, author_id=viewer, text=text, client_key=client_key)

        except ValueError as e:

            # DB store enforces FK integrity; if the post isn't in DB, do not crash.

            msg = str(e)

            if 'post_not_found' in msg:

                return Response({'ok': False, 'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

            return Response({'ok': False, 'error': 'server_error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {"ok": True, "status": 201, "reply": {"id": r.id, "post_id": post_id, "text": r.text, "client_key": client_key, "created_at": int(float(r.created_at) * 1000)}},
            status=status.HTTP_201_CREATED,
        )
