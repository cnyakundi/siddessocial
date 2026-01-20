from __future__ import annotations

from typing import Any, Dict, Optional

from django.contrib.auth import logout
from django.contrib.sessions.models import Session
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt

from .models import UserSession


def _iso(dt) -> Optional[str]:
    if not dt:
        return None
    try:
        return dt.isoformat()
    except Exception:
        return None


@method_decorator(dev_csrf_exempt, name="dispatch")
class SessionsListView(APIView):
    throttle_scope = "auth_sessions_list"

    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        cur_key = ""
        try:
            cur_key = str(getattr(request, "session", None).session_key or "")
        except Exception:
            cur_key = ""

        rows = (
            UserSession.objects.filter(user=user)
            .order_by("-last_seen_at")
            .all()[:50]
        )

        sessions = []
        for r in rows:
            sessions.append(
                {
                    "id": r.id,
                    "current": bool(cur_key and r.session_key == cur_key),
                    "createdAt": _iso(r.created_at),
                    "lastSeenAt": _iso(r.last_seen_at),
                    "ip": r.ip or "",
                    "userAgent": (r.user_agent or "")[:256],
                    "revokedAt": _iso(r.revoked_at),
                }
            )

        return Response({"ok": True, "sessions": sessions}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class SessionsRevokeView(APIView):
    throttle_scope = "auth_sessions_revoke"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data or {}
        sid = body.get("id")
        try:
            sid_int = int(sid)
        except Exception:
            return Response({"ok": False, "error": "invalid_id"}, status=status.HTTP_400_BAD_REQUEST)

        rec = UserSession.objects.filter(user=user, id=sid_int).first()
        if not rec:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        cur_key = ""
        try:
            cur_key = str(getattr(request, "session", None).session_key or "")
        except Exception:
            cur_key = ""

        now = timezone.now()

        # If revoking current session, log out and flush.
        if cur_key and rec.session_key == cur_key:
            try:
                Session.objects.filter(session_key=rec.session_key).delete()
            except Exception:
                pass
            rec.revoked_at = now
            rec.save(update_fields=["revoked_at"])
            try:
                logout(request)
                request.session.flush()
            except Exception:
                pass
            return Response({"ok": True, "revoked": True, "loggedOut": True}, status=status.HTTP_200_OK)

        # Revoke other device
        try:
            Session.objects.filter(session_key=rec.session_key).delete()
        except Exception:
            pass

        rec.revoked_at = now
        rec.save(update_fields=["revoked_at"])

        return Response({"ok": True, "revoked": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class SessionsLogoutAllView(APIView):
    """
    POST /api/auth/sessions/logout_all
    Body (optional): { includeCurrent: false }
    Default: logs out OTHER sessions, keeps current session alive.
    """
    throttle_scope = "auth_sessions_logout_all"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data or {}
        include_current = bool(body.get("includeCurrent", False))

        cur_key = ""
        try:
            cur_key = str(getattr(request, "session", None).session_key or "")
        except Exception:
            cur_key = ""

        now = timezone.now()

        # Revoke from our tracking table (fast path)
        qs = UserSession.objects.filter(user=user, revoked_at__isnull=True)
        if cur_key and not include_current:
            qs = qs.exclude(session_key=cur_key)

        recs = list(qs.all())
        revoked_count = 0
        for r in recs:
            try:
                Session.objects.filter(session_key=r.session_key).delete()
            except Exception:
                pass
            r.revoked_at = now
            r.save(update_fields=["revoked_at"])
            revoked_count += 1

        # Best-effort: also scan django sessions table (completeness for sessions not yet tracked)
        scanned_deleted = 0
        try:
            for s in Session.objects.filter(expire_date__gt=now).iterator(chunk_size=200):
                try:
                    data = s.get_decoded() or {}
                    uid = str(data.get("_auth_user_id") or "")
                    if uid == str(user.id):
                        if cur_key and not include_current and s.session_key == cur_key:
                            continue
                        s.delete()
                        scanned_deleted += 1
                except Exception:
                    continue
        except Exception:
            pass

        logged_out = False
        if include_current:
            try:
                logout(request)
                request.session.flush()
                logged_out = True
            except Exception:
                logged_out = False

        return Response(
            {"ok": True, "revoked": revoked_count, "scannedDeleted": scanned_deleted, "loggedOut": logged_out},
            status=status.HTTP_200_OK,
        )
