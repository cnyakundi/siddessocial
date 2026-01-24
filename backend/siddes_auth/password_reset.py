from __future__ import annotations

import hashlib
import os
import secrets
from datetime import timedelta
from typing import Any, Dict, Optional

from django.conf import settings
from django.contrib.auth import get_user_model, login, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt
from siddes_backend.emailing import send_email
from siddes_contacts.normalize import normalize_email

from .models import PasswordResetToken, SiddesProfile

def _session_payload(request):
    """Return session cookie name+value (+expiry hints) for proxy layers."""
    try:
        request.session.save()
    except Exception:
        pass

    name = "sessionid"
    value = ""
    max_age = None
    expires = None

    try:
        sess = getattr(request, "session", None)
        if sess is not None:
            name = str(getattr(sess, "cookie_name", "") or name)
            value = str(getattr(sess, "session_key", "") or value)
            try:
                max_age = int(sess.get_expiry_age())
            except Exception:
                max_age = None
            try:
                dt = sess.get_expiry_date()
                expires = dt.isoformat() if dt is not None else None
            except Exception:
                expires = None
    except Exception:
        pass

    out = {"name": name, "value": value}
    if max_age is not None:
        out["maxAge"] = max_age
    if expires is not None:
        out["expiresAt"] = expires
    return out

def _viewer_id_for_user(user) -> str:
    return f"me_{getattr(user, 'id', '')}"



def _token_hash(raw: str) -> str:
    return hashlib.sha256((raw or "").encode("utf-8")).hexdigest()

# sd_376: revoke other sessions after password reset (account takeover defense)
def _sd_revoke_other_sessions(user, keep_session_key: str = "") -> dict:
    """
    Best-effort: revoke/delete all other active sessions for the user, keeping the current session.
    Does not raise (never blocks primary flow).
    """
    out = {"revoked": 0, "scannedDeleted": 0}
    try:
        from django.contrib.sessions.models import Session
        from django.utils import timezone
        now = timezone.now()

        # Fast path: if UserSession tracking exists, revoke those.
        try:
            from .models import UserSession  # type: ignore
            qs = UserSession.objects.filter(user=user, revoked_at__isnull=True)
            if keep_session_key:
                qs = qs.exclude(session_key=keep_session_key)
            recs = list(qs.all()[:5000])
            for r in recs:
                try:
                    Session.objects.filter(session_key=r.session_key).delete()
                except Exception:
                    pass
                try:
                    r.revoked_at = now
                    r.save(update_fields=["revoked_at"])
                except Exception:
                    pass
                out["revoked"] += 1
        except Exception:
            pass

        # Completeness scan: delete any other Django sessions for this user.
        try:
            for s in Session.objects.filter(expire_date__gt=now).iterator(chunk_size=200):
                try:
                    data = s.get_decoded() or {}
                    uid = str(data.get("_auth_user_id") or "")
                    if uid != str(getattr(user, "id", "")):
                        continue
                    if keep_session_key and s.session_key == keep_session_key:
                        continue
                    s.delete()
                    out["scannedDeleted"] += 1
                except Exception:
                    continue
        except Exception:
            pass
    except Exception:
        pass
    return out


def _ttl_hours() -> int:
    try:
        return int(str(os.environ.get("SIDDES_PASSWORD_RESET_TTL_HOURS", "2")).strip() or "2")
    except Exception:
        return 2


def _cooldown_sec() -> int:
    try:
        return int(str(os.environ.get("SIDDES_PASSWORD_RESET_COOLDOWN_SEC", "60")).strip() or "60")
    except Exception:
        return 60


def _public_app_base() -> str:
    raw = (
        os.environ.get("SIDDES_PUBLIC_APP_BASE")
        or os.environ.get("SD_PUBLIC_APP_BASE")
        or os.environ.get("SIDDES_PUBLIC_WEB_BASE")
        or os.environ.get("SD_PUBLIC_WEB_BASE")
        or ""
    )
    s = str(raw or "").strip().rstrip("/")
    if s:
        if not (s.startswith("http://") or s.startswith("https://")):
            s = "https://" + s
        return s.rstrip("/")

    if getattr(settings, "DEBUG", False):
        return "http://localhost:3000"

    return ""


def create_and_send_password_reset(user, request_id: Optional[str] = None, force: bool = False) -> Dict[str, Any]:
    """Create a single-use, expiring password reset token and email it.

    Safe defaults:
    - If user has no email: do not send.
    - Cooldown to avoid spamming.
    """
    email = normalize_email(str(getattr(user, "email", "") or ""))
    if not email or "@" not in email:
        return {"ok": False, "error": "missing_email"}

    now = timezone.now()

    recent = (
        PasswordResetToken.objects.filter(user=user, used_at__isnull=True, expires_at__gt=now)
        .order_by("-created_at")
        .first()
    )
    cooldown = _cooldown_sec()
    if recent and not force:
        age = int((now - recent.created_at).total_seconds())
        if age < cooldown:
            return {"ok": True, "sent": False, "cooldownRemainingSec": max(0, cooldown - age)}

    raw_token = secrets.token_urlsafe(32)
    token_hash = _token_hash(raw_token)
    expires_at = now + timedelta(hours=_ttl_hours())

    PasswordResetToken.objects.create(
        user=user,
        email=email,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    base = _public_app_base()
    link = f"{base}/reset-password?token={raw_token}" if base else ""

    subject = "Reset your Siddes password"
    lines = [
        "We received a request to reset your Siddes password.",
        "",
        "If you made this request, use the link below to set a new password.",
        "If you did not request a reset, you can ignore this email.",
    ]
    if link:
        lines += ["", f"Reset: {link}"]
    lines += ["", "If you cannot click links, paste this token in the app:", raw_token]
    text = "\n".join(lines) + "\n"

    res = send_email(to=email, subject=subject, text=text, html=None, request_id=request_id)
    if not bool(res.get("ok")):
        return {"ok": False, "error": "email_send_failed", "provider": res.get("provider")}

    return {"ok": True, "sent": True, "provider": res.get("provider")}


@method_decorator(dev_csrf_exempt, name="dispatch")
class PasswordResetRequestView(APIView):
    """POST /api/auth/password/reset/request

    Body: { identifier: email|username } (or { email: ... })

    IMPORTANT: does NOT leak whether account exists.
    """

    throttle_scope = "auth_pw_reset_request"

    def post(self, request):
        body: Dict[str, Any] = request.data or {}
        identifier = str(body.get("identifier") or body.get("email") or "").strip()
        if not identifier:
            return Response({"ok": False, "error": "missing_identifier"}, status=status.HTTP_400_BAD_REQUEST)

        rid = None
        try:
            rid = str(request.headers.get("x-request-id") or "").strip()[:64] or None
        except Exception:
            rid = None

        User = get_user_model()
        user = None

        try:
            if "@" in identifier:
                email = normalize_email(identifier)
                user = User.objects.filter(email__iexact=email).first()
            else:
                user = User.objects.filter(username__iexact=identifier).first()

            if user is not None:
                SiddesProfile.objects.get_or_create(user=user)
                create_and_send_password_reset(user, request_id=rid, force=False)
        except Exception:
            # Do not leak. Logs will show provider failures in server logs.
            pass

        # Always respond generically.
        return Response({"ok": True, "queued": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class PasswordResetConfirmView(APIView):
    """POST /api/auth/password/reset/confirm

    Body: { token, password }

    Also supports GET with token in query params (dev convenience).
    """

    throttle_scope = "auth_pw_reset_confirm"

    def _handle(self, request):
        body: Dict[str, Any] = request.data or {}
        token = str(body.get("token") or "").strip()
        password = str(body.get("password") or "").strip()

        if not token:
            try:
                token = str(getattr(request, "query_params", {}).get("token") or "").strip()
            except Exception:
                token = ""

        if not token:
            return Response({"ok": False, "error": "missing_token"}, status=status.HTTP_400_BAD_REQUEST)
        if not password or len(password) < 8:
            return Response({"ok": False, "error": "weak_password"}, status=status.HTTP_400_BAD_REQUEST)

        h = _token_hash(token)
        rec = PasswordResetToken.objects.select_related("user").filter(token_hash=h).first()
        if not rec:
            return Response({"ok": False, "error": "invalid_token"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if rec.used_at is not None:
            return Response({"ok": False, "error": "token_used"}, status=status.HTTP_400_BAD_REQUEST)
        if rec.expires_at <= now:
            return Response({"ok": False, "error": "token_expired"}, status=status.HTTP_400_BAD_REQUEST)

        user = rec.user

        try:
            validate_password(password, user=user)
        except ValidationError as e:
            return Response(
                {"ok": False, "error": "weak_password", "detail": list(getattr(e, "messages", []) or [])[:3]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save(update_fields=["password"])

        rec.used_at = now
        rec.save(update_fields=["used_at"])

        prof, _ = SiddesProfile.objects.get_or_create(user=user)
        # If they can reset via email, they own the email. Mark verified.
        if not bool(getattr(prof, "email_verified", False)):
            prof.email_verified = True
            prof.email_verified_at = now
            prof.save(update_fields=["email_verified", "email_verified_at", "updated_at"])

        login(request, user)



        # sd_393b: revoke other sessions after password reset


        try:


            request.session.save()


            _cur = str(getattr(getattr(request, 'session', None), 'session_key', '') or '')


        except Exception:


            _cur = ''


        try:


            _sd_revoke_other_sessions(user, keep_session_key=_cur)


        except Exception:


            pass
        # sd_377: ensure session cookie is set (cookie-only auth; no session in JSON)
        try:
            request.session.save()
        except Exception:
            pass
        # Ensure session key exists (cookie set by SessionMiddleware)
        request.session.save()
        out = {
            "ok": True,
            "reset": True,
            "user": {"id": user.id, "username": user.get_username(), "email": getattr(user, "email", "")},
            "viewerId": _viewer_id_for_user(user),
            "emailVerified": bool(getattr(prof, "email_verified", False)),
"onboarding": {
                "completed": bool(getattr(prof, "onboarding_completed", False)),
                "step": getattr(prof, "onboarding_step", "welcome"),
                "contact_sync_done": bool(getattr(prof, "contact_sync_done", False)),
            },
        }
        return Response(out, status=status.HTTP_200_OK)

    def post(self, request):
        return self._handle(request)

    def get(self, request):
        return self._handle(request)


@method_decorator(dev_csrf_exempt, name="dispatch")
class PasswordChangeView(APIView):
    """POST /api/auth/password/change

    Body: { oldPassword, newPassword }

    If user has no usable password (Google-only accounts), oldPassword may be blank.
    """

    throttle_scope = "auth_pw_change"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data or {}
        old_pw = str(body.get("oldPassword") or body.get("old_password") or "").strip()
        new_pw = str(body.get("newPassword") or body.get("new_password") or body.get("password") or "").strip()

        if not new_pw or len(new_pw) < 8:
            return Response({"ok": False, "error": "weak_password"}, status=status.HTTP_400_BAD_REQUEST)

        has_pw = bool(getattr(user, "has_usable_password", lambda: True)())
        if has_pw:
            if not old_pw or not bool(getattr(user, "check_password")(old_pw)):
                return Response({"ok": False, "error": "invalid_old_password"}, status=status.HTTP_400_BAD_REQUEST)
            if old_pw == new_pw:
                return Response({"ok": False, "error": "same_password"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_pw, user=user)
        except ValidationError as e:
            return Response(
                {"ok": False, "error": "weak_password", "detail": list(getattr(e, "messages", []) or [])[:3]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_pw)
        user.save(update_fields=["password"])

        # Keep the current session valid after password change.
        update_session_auth_hash(request, user)



        # sd_393b: optionally revoke other sessions after password change

        logout_others = bool(body.get('logoutOtherSessions') or body.get('logout_other_sessions') or body.get('logoutAll') or body.get('logout_all'))

        if logout_others:

            try:

                _cur = str(getattr(getattr(request, 'session', None), 'session_key', '') or '')

            except Exception:

                _cur = ''

            try:

                _sd_revoke_other_sessions(user, keep_session_key=_cur)

            except Exception:

                pass
        # sd_376: optionally revoke other sessions after password change
        logout_others = bool(body.get('logoutOtherSessions') or body.get('logout_other_sessions') or body.get('logoutAll') or body.get('logout_all'))
        if logout_others:
            try:
                _cur = str(getattr(getattr(request, 'session', None), 'session_key', '') or '')
            except Exception:
                _cur = ''
            try:
                _sd_revoke_other_sessions(user, keep_session_key=_cur)
            except Exception:
                pass
        return Response({"ok": True, "changed": True}, status=status.HTTP_200_OK)
