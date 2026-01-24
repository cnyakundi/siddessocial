from __future__ import annotations

import hashlib
import os
import secrets
from datetime import timedelta
from typing import Any, Dict, Optional
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model, login
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

from .models import MagicLinkToken, SiddesProfile


def _token_hash(raw: str) -> str:
    return hashlib.sha256((raw or "").encode("utf-8")).hexdigest()


def _ttl_minutes() -> int:
    try:
        return int(str(os.environ.get("SIDDES_MAGIC_LINK_TTL_MINUTES", "15")).strip() or "15")
    except Exception:
        return 15


def _resend_cooldown_sec() -> int:
    try:
        return int(str(os.environ.get("SIDDES_MAGIC_LINK_RESEND_COOLDOWN_SEC", "60")).strip() or "60")
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


def _safe_next_path(raw: str | None) -> str:
    """Only allow same-site relative paths (prevents open redirects)."""
    s = str(raw or "").strip()
    if not s:
        return ""
    if not s.startswith("/"):
        return ""
    if s.startswith("//"):
        return ""
    if "\\" in s:
        return ""
    if "\r" in s or "\n" in s:
        return ""
    return s


def _session_payload(request) -> Dict[str, Any]:
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

    out: Dict[str, Any] = {"name": name, "value": value}
    if max_age is not None:
        out["maxAge"] = max_age
    if expires is not None:
        out["expiresAt"] = expires
    return out


def _viewer_id_for_user(user) -> str:
    return f"me_{getattr(user, 'id', '')}"


def _min_age() -> int:
    try:
        return max(0, int(str(os.environ.get("SIDDES_MIN_AGE", "13")).strip() or "13"))
    except Exception:
        return 13


def _locality_payload(prof: SiddesProfile) -> Dict[str, Any]:
    det = str(getattr(prof, "detected_region", "") or "").strip().upper()
    cho = str(getattr(prof, "chosen_region", "") or "").strip().upper()
    eff = cho or det
    return {"detectedRegion": det, "chosenRegion": cho, "region": eff}


def _ensure_profile(user) -> SiddesProfile:
    prof, _ = SiddesProfile.objects.get_or_create(user=user)
    return prof


@method_decorator(dev_csrf_exempt, name="dispatch")
class MagicLinkRequestView(APIView):
    """Request a one-time sign-in link via email.

    Privacy posture:
    - Does not reveal whether an account exists for the email.
    """

    throttle_scope = "auth_magic_request"

    def post(self, request):
        body: Dict[str, Any] = request.data or {}
        email_raw = str(body.get("email") or "").strip()
        email = normalize_email(email_raw) or ""
        next_path = _safe_next_path(str(body.get("next") or "").strip())

        if not email or "@" not in email:
            return Response({"ok": False, "error": "invalid_email"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()

        # Always claim success (prevents enumeration).
        out: Dict[str, Any] = {
            "ok": True,
            "message": "If an account exists for that email, we'll send a one-time sign-in link.",
        }

        if not user:
            return Response(out, status=status.HTTP_200_OK)

        now = timezone.now()
        cooldown = _resend_cooldown_sec()
        recent = (
            MagicLinkToken.objects.filter(user=user, used_at__isnull=True, expires_at__gt=now)
            .order_by("-created_at")
            .first()
        )
        if recent:
            age = int((now - recent.created_at).total_seconds())
            if age < cooldown:
                # Respect cooldown (do not send again). Still respond OK.
                if getattr(settings, "DEBUG", False):
                    out["cooldownRemainingSec"] = max(0, cooldown - age)
                return Response(out, status=status.HTTP_200_OK)

        raw_token = secrets.token_urlsafe(32)
        token_hash = _token_hash(raw_token)
        expires_at = now + timedelta(minutes=_ttl_minutes())

        MagicLinkToken.objects.create(
            user=user,
            email=email,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        base = _public_app_base()
        link = f"{base}/magic?token={raw_token}" if base else ""
        if link and next_path:
            link = link + "&next=" + quote(next_path, safe="")

        subject = "Your Siddes sign-in link"
        lines = [
            "Here is your one-time sign-in link for Siddes.",
            "",
        ]
        if link:
            lines += [f"Sign in: {link}", ""]
        lines += [
            "This link expires soon and can only be used once.",
            "",
            "If you cannot click links, paste this token in the app:",
            raw_token,
            "",
            "If you did not request this, you can ignore this email.",
        ]
        text = "\n".join(lines) + "\n"

        res = send_email(
            to=email,
            subject=subject,
            text=text,
            html=None,
            request_id=request.headers.get("x-request-id"),
        )

        if not bool(res.get("ok")):
            # In production, surface a real error; dev usually uses console provider.
            return Response({"ok": False, "error": "email_send_failed", "provider": res.get("provider")}, status=500)

        # Dev convenience: return token/link so local testing doesn't require email wiring.
        if getattr(settings, "DEBUG", False):
            out["debugToken"] = raw_token
            if link:
                out["debugLink"] = link

        return Response(out, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class MagicLinkConsumeView(APIView):
    """Consume a magic-link token, log the user in, and create a session."""

    throttle_scope = "auth_magic_consume"

    def post(self, request):
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
        rec = MagicLinkToken.objects.select_related("user").filter(token_hash=h).first()
        if not rec:
            return Response({"ok": False, "error": "invalid_token"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if rec.used_at is not None:
            return Response({"ok": False, "error": "token_used"}, status=status.HTTP_400_BAD_REQUEST)
        if rec.expires_at <= now:
            return Response({"ok": False, "error": "token_expired"}, status=status.HTTP_400_BAD_REQUEST)

        user = rec.user

        # Mark used before login (single-use).
        rec.used_at = now
        rec.save(update_fields=["used_at"])

        prof = _ensure_profile(user)

        # Clicking the link proves email control.
        if not bool(getattr(prof, "email_verified", False)):
            prof.email_verified = True
            prof.email_verified_at = now
            prof.save(update_fields=["email_verified", "email_verified_at", "updated_at"])

        # sd_472: create contact identity token after verified (enables contacts match discoverability)
        try:
            email_n = normalize_email(str(getattr(user, "email", "") or ""))
            if email_n:
                tok = hmac_token(email_n)
                ContactIdentityToken.objects.filter(user=user, kind="email").exclude(token=tok).delete()
                ContactIdentityToken.objects.get_or_create(
                    user=user,
                    token=tok,
                    kind="email",
                    defaults={"value_hint": email_n[:3] + "***"},
                )
        except Exception:
            pass

        login(request, user)
        try:
            request.session.save()
        except Exception:
            pass

        out: Dict[str, Any] = {
            "ok": True,
            "user": {"id": user.id, "username": user.get_username(), "email": getattr(user, "email", "")},
            "viewerId": _viewer_id_for_user(user),
            "emailVerified": True,
            "ageGateConfirmed": bool(getattr(prof, "age_gate_confirmed", False)),
            "minAge": _min_age(),
            "locality": _locality_payload(prof),
            "isStaff": bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)),
            "onboarding": {
                "completed": bool(getattr(prof, "onboarding_completed", False)),
                "step": getattr(prof, "onboarding_step", "welcome"),
                "contact_sync_done": bool(getattr(prof, "contact_sync_done", False)),
            },
            "session": _session_payload(request),
        }
        return Response(out, status=status.HTTP_200_OK)
