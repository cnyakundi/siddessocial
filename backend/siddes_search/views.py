from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role
from siddes_post.models import Post


_ALLOWED_SIDES = {"public", "friends", "close", "work"}


def _raw_viewer_from_request(request) -> Optional[str]:
    """Return a viewer id string or None (default-safe).

    Priority:
    1) Real auth (Session): me_<django_user_id>
    2) DEV-only stub identity: x-sd-viewer header or sd_viewer cookie
    3) PROD safety: ignore dev identity when DEBUG=False
    """

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


def _clean_q(raw: str) -> str:
    q = str(raw or "").strip()
    if q.startswith("@"):  # allow handle style
        q = q[1:]
    return q.strip()


class SearchUsersView(APIView):
    permission_classes: list = []
    throttle_scope = "search_users"

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"count": 0, "items": []}), status=status.HTTP_200_OK)

        q = _clean_q(str(getattr(request, "query_params", {}).get("q") or ""))
        qn = q.lower()

        lim_raw = str(getattr(request, "query_params", {}).get("limit") or "").strip()
        try:
            lim = int(lim_raw) if lim_raw else 20
        except Exception:
            lim = 20
        if lim < 1:
            lim = 1
        if lim > 30:
            lim = 30

        if len(qn) < 2:
            return Response({"ok": True, "restricted": False, "q": q, "count": 0, "items": []}, status=status.HTTP_200_OK)

        User = get_user_model()

        # Prefix search first; fallback to contains for better discovery.
        rows = list(User.objects.filter(username__istartswith=qn).order_by("username")[:lim])
        if len(rows) < min(lim, 8):
            more = list(User.objects.filter(username__icontains=qn).exclude(id__in=[u.id for u in rows]).order_by("username")[: max(0, lim - len(rows))])
            rows.extend(more)

        items = []
        for u in rows:
            uname = str(getattr(u, "username", "") or "").strip()
            if not uname:
                continue
            items.append(
                {
                    "id": int(getattr(u, "id", 0) or 0),
                    "username": uname,
                    "handle": "@" + uname,
                    "isStaff": bool(getattr(u, "is_staff", False) or getattr(u, "is_superuser", False)),
                }
            )

        return Response({"ok": True, "restricted": False, "q": q, "count": len(items), "items": items}, status=status.HTTP_200_OK)


class SearchPostsView(APIView):
    permission_classes: list = []
    throttle_scope = "search_posts"

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"count": 0, "items": []}), status=status.HTTP_200_OK)

        q = _clean_q(str(getattr(request, "query_params", {}).get("q") or ""))
        qt = q.strip()

        lim_raw = str(getattr(request, "query_params", {}).get("limit") or "").strip()
        try:
            lim = int(lim_raw) if lim_raw else 50
        except Exception:
            lim = 50
        if lim < 1:
            lim = 1
        if lim > 80:
            lim = 80

        if len(qt) < 2:
            return Response({"ok": True, "restricted": False, "q": q, "count": 0, "items": [], "serverTs": time.time()}, status=status.HTTP_200_OK)

        qs = Post.objects.filter(side="public", is_hidden=False, text__icontains=qt).order_by("-created_at")
        # sd_422_user_hide: exclude posts the viewer hid
        try:
            from siddes_safety.models import UserHiddenPost  # type: ignore
            qs = qs.exclude(id__in=UserHiddenPost.objects.filter(viewer_id=viewer).values("post_id"))
        except Exception:
            pass
        qs = qs[:lim]
        recs = list(qs)

        # sd_423_mute: exclude muted authors
        try:
            from siddes_safety.policy import is_muted
            recs = [r for r in recs if not is_muted(viewer, str(getattr(r, "author_id", "") or ""))]
        except Exception:
            pass

        post_ids = [str(getattr(r, "id", "") or "").strip() for r in recs if str(getattr(r, "id", "") or "").strip()]

        try:
            # Reuse feed hydration to match PostCard contract.
            from siddes_feed.feed_stub import _bulk_engagement, _bulk_echo, _hydrate_from_record

            like_counts, reply_counts, liked_ids = _bulk_engagement(viewer, post_ids)
            echo_counts, echoed_ids = _bulk_echo(viewer, post_ids, "public", recs)

            items = []
            for r in recs:
                pid = str(getattr(r, "id", "") or "").strip()
                items.append(
                    _hydrate_from_record(
                        r,
                        viewer_id=viewer,
                        like_count=int(like_counts.get(pid, 0) or 0),
                        reply_count=int(reply_counts.get(pid, 0) or 0),
                        liked=(pid in liked_ids),
                        echo_count=int(echo_counts.get(pid, 0) or 0),
                        echoed=(pid in echoed_ids),
                    )
                )
        except Exception:
            # Fail soft: return minimal shape.
            items = []
            for r in recs:
                items.append(
                    {
                        "id": str(getattr(r, "id", "") or ""),
                        "author": str(getattr(r, "author_id", "") or ""),
                        "handle": "@" + str(getattr(r, "author_id", "") or "").lstrip("@"),
                        "time": "",
                        "content": str(getattr(r, "text", "") or ""),
                        "kind": "text",
                        "likeCount": 0,
                        "replyCount": 0,
                        "echoCount": 0,
                        "liked": False,
                        "echoed": False,
                        "canEdit": False,
                        "canDelete": False,
                    }
                )

        return Response({"ok": True, "restricted": False, "q": q, "count": len(items), "items": items, "serverTs": time.time()}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes: list = []
    throttle_scope = "search_users"

    def get(self, request, username: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"user": None}), status=status.HTTP_200_OK)

        raw = str(username or "").strip()
        if raw.startswith("@"): raw = raw[1:]
        uname = raw.strip().lower()
        if not uname:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        User = get_user_model()
        u = User.objects.filter(username__iexact=uname).first()
        if not u:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        out = {
            "id": int(getattr(u, "id", 0) or 0),
            "username": str(getattr(u, "username", "") or "").strip(),
            "handle": "@" + str(getattr(u, "username", "") or "").strip(),
            "isStaff": bool(getattr(u, "is_staff", False) or getattr(u, "is_superuser", False)),
        }
        return Response({"ok": True, "restricted": False, "user": out}, status=status.HTTP_200_OK)


class UserPublicPostsView(APIView):
    permission_classes: list = []
    throttle_scope = "search_posts"

    def get(self, request, username: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role, extra={"count": 0, "items": []}), status=status.HTTP_200_OK)

        raw = str(username or "").strip()
        if raw.startswith("@"): raw = raw[1:]
        uname = raw.strip().lower()
        if not uname:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        User = get_user_model()
        u = User.objects.filter(username__iexact=uname).first()
        if not u:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        # Posts store author_id as viewer token: me_<user.id>
        author_token = f"me_{int(getattr(u, 'id', 0) or 0)}"

        lim_raw = str(getattr(request, "query_params", {}).get("limit") or "").strip()
        try:
            lim = int(lim_raw) if lim_raw else 50
        except Exception:
            lim = 50
        if lim < 1:
            lim = 1
        if lim > 80:
            lim = 80

        qs = Post.objects.filter(side="public", is_hidden=False, author_id=author_token).order_by("-created_at")
        # sd_422_user_hide: exclude posts the viewer hid
        try:
            from siddes_safety.models import UserHiddenPost  # type: ignore
            qs = qs.exclude(id__in=UserHiddenPost.objects.filter(viewer_id=viewer).values("post_id"))
        except Exception:
            pass
        qs = qs[:lim]
        recs = list(qs)

        post_ids = [str(getattr(r, "id", "") or "").strip() for r in recs if str(getattr(r, "id", "") or "").strip()]

        try:
            from siddes_feed.feed_stub import _bulk_engagement, _bulk_echo, _hydrate_from_record

            like_counts, reply_counts, liked_ids = _bulk_engagement(viewer, post_ids)
            echo_counts, echoed_ids = _bulk_echo(viewer, post_ids, "public", recs)

            items = []
            for r in recs:
                pid = str(getattr(r, "id", "") or "").strip()
                items.append(
                    _hydrate_from_record(
                        r,
                        viewer_id=viewer,
                        like_count=int(like_counts.get(pid, 0) or 0),
                        reply_count=int(reply_counts.get(pid, 0) or 0),
                        liked=(pid in liked_ids),
                        echo_count=int(echo_counts.get(pid, 0) or 0),
                        echoed=(pid in echoed_ids),
                    )
                )
        except Exception:
            items = []
            for r in recs:
                items.append(
                    {
                        "id": str(getattr(r, "id", "") or ""),
                        "author": str(getattr(r, "author_id", "") or ""),
                        "handle": "@" + str(getattr(r, "author_id", "") or "").lstrip("@"),
                        "time": "",
                        "content": str(getattr(r, "text", "") or ""),
                        "kind": "text",
                        "likeCount": 0,
                        "replyCount": 0,
                        "echoCount": 0,
                        "liked": False,
                        "echoed": False,
                        "canEdit": False,
                        "canDelete": False,
                    }
                )

        return Response({"ok": True, "restricted": False, "username": uname, "count": len(items), "items": items, "serverTs": time.time()}, status=status.HTTP_200_OK)
