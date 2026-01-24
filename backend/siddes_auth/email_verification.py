from __future__ import annotations

import hashlib
import os
import secrets
from datetime import timedelta
from typing import Any, Dict, Optional

from django.conf import settings
from django.contrib.auth import login
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt
from siddes_backend.emailing import send_email

from siddes_contacts.normalize import normalize_email
from siddes_contacts.tokens import hmac_token
from siddes_contacts.models import ContactIdentityToken

from .models import EmailVerificationToken, SiddesProfile

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


def _ttl_hours() -> int:
    try:
        return int(str(os.environ.get("SIDDES_EMAIL_VERIFY_TTL_HOURS", "24")).strip() or "24")
    except Exception:
        return 24


def _resend_cooldown_sec() -> int:
    try:
        return int(str(os.environ.get("SIDDES_EMAIL_VERIFY_RESEND_COOLDOWN_SEC", "60")).strip() or "60")
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
        # If scheme is missing, default to https
        if not (s.startswith("http://") or s.startswith("https://")):
            s = "https://" + s
        return s.rstrip("/")

    if getattr(settings, "DEBUG", False):
        return "http://localhost:3000"

    return ""


def create_and_send_email_verification(user, request_id: Optional[str] = None, force: bool = False) -> Dict[str, Any]:
    """Create (or reuse) a verification token and email it to the user.

    Safe defaults:
    - If already verified: no-op
    - If within cooldown: do not send again
    """

    prof, _ = SiddesProfile.objects.get_or_create(user=user)

    if bool(getattr(prof, "email_verified", False)):
        return {"ok": True, "alreadyVerified": True, "sent": False}

    email = str(getattr(user, "email", "") or "").strip()
    if not email or "@" not in email:
        return {"ok": False, "error": "missing_email"}

    now = timezone.now()

    # Cooldown: if a recent unused token exists, avoid spamming.
    cooldown = _resend_cooldown_sec()
    recent = (
        EmailVerificationToken.objects.filter(user=user, used_at__isnull=True, expires_at__gt=now)
        .order_by("-created_at")
        .first()
    )
    if recent and not force:
        age = int((now - recent.created_at).total_seconds())
        if age < cooldown:
            return {"ok": True, "sent": False, "cooldownRemainingSec": max(0, cooldown - age)}

    raw_token = secrets.token_urlsafe(32)
    token_hash = _token_hash(raw_token)
    expires_at = now + timedelta(hours=_ttl_hours())

    EmailVerificationToken.objects.create(
        user=user,
        email=email,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    base = _public_app_base()
    link = f"{base}/verify-email?token={raw_token}" if base else ""

    subject = "Verify your email for Siddes"
    lines = [
        "Welcome to Siddes.",
        "",
        "Please verify your email to keep your account safe.",
    ]
    if link:
        lines += ["", f"Verify: {link}"]
    lines += ["", "If you cannot click links, paste this token in the app:", raw_token]

    text = "\n".join(lines) + "\n"

    res = send_email(to=email, subject=subject, text=text, html=None, request_id=request_id)
    if not bool(res.get("ok")):
        return {"ok": False, "error": "email_send_failed", "provider": res.get("provider")}

    return {"ok": True, "sent": True, "provider": res.get("provider")}


@method_decorator(dev_csrf_exempt, name="dispatch")
class VerifyConfirmView(APIView):
    """Confirm email verification via token."""

    throttle_scope = "auth_verify_confirm"

    def _handle(self, request):
        token = ""
        try:
            token = str((request.data or {}).get("token") or "").strip()
        except Exception:
            token = ""

        if not token:
            try:
                token = str(getattr(request, "query_params", {}).get("token") or "").strip()
            except Exception:
                token = ""

        if not token:
            return Response({"ok": False, "error": "missing_token"}, status=status.HTTP_400_BAD_REQUEST)

        h = _token_hash(token)
        rec = EmailVerificationToken.objects.select_related("user").filter(token_hash=h).first()
        if not rec:
            return Response({"ok": False, "error": "invalid_token"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if rec.used_at is not None:
            return Response({"ok": False, "error": "token_used"}, status=status.HTTP_400_BAD_REQUEST)
        if rec.expires_at <= now:
            return Response({"ok": False, "error": "token_expired"}, status=status.HTTP_400_BAD_REQUEST)

        user = rec.user
        prof, _ = SiddesProfile.objects.get_or_create(user=user)

        if not bool(getattr(prof, "email_verified", False)):
            prof.email_verified = True
            prof.email_verified_at = now
            prof.save(update_fields=["email_verified", "email_verified_at", "updated_at"])

        # sd_472: create contact identity token on verify (enables contacts match discoverability)
        try:
            email_n = normalize_email(str(getattr(user, "email", "") or ""))
            if email_n:
                tok = hmac_token(email_n)
                # sd_473: revoke any stale email tokens (legacy safety)
                ContactIdentityToken.objects.filter(user=user, kind="email").exclude(token=tok).delete()
                ContactIdentityToken.objects.get_or_create(
                    user=user,
                    token=tok,
                    kind="email",
                    defaults={"value_hint": email_n[:3] + "***"},
                )
        except Exception:
            pass

        rec.used_at = now
        rec.save(update_fields=["used_at"])

        # Log the user in (sets session cookie). Safe even if already authed.
        login(request, user)

        # sd_377: ensure session cookie is set (cookie-only auth; no session in JSON)
        try:
            request.session.save()
        except Exception:
            pass
        # Ensure session key exists (cookie set by SessionMiddleware)
        request.session.save()
        out = {
            "ok": True,
            "verified": True,
            "user": {"id": user.id, "username": user.get_username(), "email": getattr(user, "email", "")},
            "viewerId": _viewer_id_for_user(user),
            "emailVerified": True,
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
class VerifyResendView(APIView):
    """Resend verification email (requires session)."""

    throttle_scope = "auth_verify_resend"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        rid = None
        try:
            rid = str(request.headers.get("x-request-id") or "").strip()[:64] or None
        except Exception:
            rid = None

        res = create_and_send_email_verification(user, request_id=rid, force=False)
        status_code = status.HTTP_200_OK if bool(res.get("ok")) else status.HTTP_400_BAD_REQUEST
        return Response(res, status=status_code)
