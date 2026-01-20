from __future__ import annotations

from django.contrib.auth import logout
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone

from .models import UserSession


class UserSessionCaptureMiddleware:
    """
    Track user sessions for device/session management.

    - Inserts/updates a UserSession row for authenticated requests.
    - If a session is marked revoked, logs the user out (deny-by-default).
    - Updates last_seen_at at most once per 60 seconds to reduce DB writes.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Pre: if session is revoked, force logout before view executes
        try:
            user = getattr(request, "user", None)
            session = getattr(request, "session", None)
            session_key = str(getattr(session, "session_key", "") or "")
            if user and getattr(user, "is_authenticated", False) and session_key:
                rec = UserSession.objects.filter(session_key=session_key).first()
                if rec and rec.revoked_at is not None:
                    try:
                        logout(request)
                        request.session.flush()
                    except Exception:
                        pass
        except (OperationalError, ProgrammingError):
            # migrations not applied yet
            pass
        except Exception:
            pass

        response = self.get_response(request)

        # Post: record usage (best-effort)
        try:
            user = importing_user = getattr(request, "user", None)
            session = getattr(request, "session", None)
            session_key = str(getattr(session, "session_key", "") or "")
            if not user or not getattr(user, "is_authenticated", False) or not session_key:
                return response

            now = timezone.now()

            ip = ""
            try:
                xff = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
                ip = xff or str(request.META.get("REMOTE_ADDR") or "").strip()
            except Exception:
                ip = ""

            ua = ""
            try:
                ua = str(request.META.get("HTTP_USER_AGENT") or "")[:256]
            except Exception:
                ua = ""

            rec = UserSession.objects.filter(session_key=session_key).first()
            if rec:
                # Update at most once per 60s
                try:
                    age = (now - (rec.last_seen_at or now)).total_seconds()
                except Exception:
                    age = 61
                if age >= 60:
                    rec.last_seen_at = now
                    if ip:
                        rec.ip = ip
                    if ua:
                        rec.user_agent = ua
                    rec.save(update_fields=["last_seen_at", "ip", "user_agent"])
            else:
                UserSession.objects.create(
                    user=user,
                    session_key=session_key,
                    last_seen_at=now,
                    ip=ip or "",
                    user_agent=ua or "",
                )
        except (OperationalError, ProgrammingError):
            # migrations not applied yet
            pass
        except Exception:
            pass

        return response
