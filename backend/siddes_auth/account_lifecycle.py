from __future__ import annotations

import hashlib
import os
import secrets
from datetime import timedelta
from typing import Any, Dict, Optional

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt
from siddes_backend.emailing import send_email
from siddes_backend.identity import viewer_aliases
from siddes_contacts.normalize import normalize_email
from siddes_contacts.tokens import hmac_token
from siddes_contacts.models import ContactIdentityToken, ContactMatchEdge

from .models import SiddesProfile, EmailChangeToken, AccountDeleteToken, UserSession


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _token_hash(raw: str) -> str:
    return hashlib.sha256((raw or "").encode("utf-8")).hexdigest()


def viewer_id_for_user(user) -> str:
    return f"me_{getattr(user, 'id', '')}"


def _session_payload(request) -> Dict[str, str]:
    request.session.save()
    return {"name": "sessionid", "value": request.session.session_key or ""}


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


def _ttl_hours(name: str, default: int) -> int:
    try:
        return int(str(os.environ.get(name, str(default))).strip() or str(default))
    except Exception:
        return default


def _ensure_profile(user) -> SiddesProfile:
    prof, _ = SiddesProfile.objects.get_or_create(user=user)
    return prof


def _ensure_email_identity_token(user, email: str) -> None:
    email_n = normalize_email(email)
    if not email_n:
        return
    token = hmac_token(email_n)
    ContactIdentityToken.objects.get_or_create(
        user=user,
        token=token,
        kind="email",
        defaults={"value_hint": email_n[:3] + "***"},
    )


def _purge_contact_discoverability(user) -> None:
    """Delete contact discoverability tokens + derived edges for this user (best-effort).

    This ensures:
      - Deactivated/deleted accounts cannot be discovered via /api/contacts/match
      - Existing viewer-scoped edges don't keep suggesting a removed account
    """
    try:
        ContactIdentityToken.objects.filter(user=user).delete()
    except Exception:
        pass
    try:
        ContactMatchEdge.objects.filter(viewer=user).delete()
        ContactMatchEdge.objects.filter(matched_user=user).delete()
    except Exception:
        pass


def _revoke_all_sessions_for_user(user) -> None:
    """Best-effort: revoke all Django sessions for this user + mark UserSession rows."""

    now = timezone.now()

    try:
        # Mark our tracked sessions revoked
        UserSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=now)
    except Exception:
        pass

    # Delete rows from django_session for this user.
    try:
        qs = Session.objects.filter(expire_date__gt=now)
        for s in qs.iterator(chunk_size=200):
            try:
                data = s.get_decoded() or {}
                if str(data.get("_auth_user_id") or "") == str(user.id):
                    s.delete()
            except Exception:
                continue
    except Exception:
        pass


@method_decorator(dev_csrf_exempt, name="dispatch")
class EmailChangeRequestView(APIView):
    """POST /api/auth/email/change/request

    Body:
      { "newEmail": "...", "password": "..." (optional) }

    Notes:
    - Requires session.
    - In production, if the user has a usable password, we require password re-entry by default.
      Override with env: SIDDES_EMAIL_CHANGE_REQUIRE_PASSWORD=0
    """

    throttle_scope = "auth_email_change_request"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data or {}
        new_email = normalize_email(str(body.get("newEmail") or body.get("email") or ""))
        password = str(body.get("password") or "")

        if not new_email or "@" not in new_email:
            return Response({"ok": False, "error": "invalid_email"}, status=status.HTTP_400_BAD_REQUEST)

        cur_email = normalize_email(str(getattr(user, "email", "") or ""))
        if cur_email and new_email.lower() == cur_email.lower():
            return Response({"ok": True, "nochange": True}, status=status.HTTP_200_OK)

        # Re-auth (default on in prod)
        require_pw = _truthy(os.environ.get("SIDDES_EMAIL_CHANGE_REQUIRE_PASSWORD", ""))
        if os.environ.get("SIDDES_EMAIL_CHANGE_REQUIRE_PASSWORD") is None:
            require_pw = (not bool(getattr(settings, "DEBUG", False)))

        try:
            has_pw = bool(getattr(user, "has_usable_password", lambda: True)())
        except Exception:
            has_pw = True

        if require_pw and has_pw:
            if not password or not bool(getattr(user, "check_password")(password)):
                return Response({"ok": False, "error": "invalid_password"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
            return Response({"ok": False, "error": "email_taken"}, status=status.HTTP_409_CONFLICT)

        now = timezone.now()
        ttl = _ttl_hours("SIDDES_EMAIL_CHANGE_TTL_HOURS", 2)
        expires_at = now + timedelta(hours=ttl)

        raw = secrets.token_urlsafe(32)
        h = _token_hash(raw)

        rid = None
        try:
            rid = str(request.headers.get("x-request-id") or "").strip()[:64] or None
        except Exception:
            rid = None

        # Single pending token per user — invalidate previous unused ones
        try:
            EmailChangeToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        except Exception:
            pass

        EmailChangeToken.objects.create(user=user, new_email=new_email, token_hash=h, expires_at=expires_at)

        base = _public_app_base()
        link = f"{base}/confirm-email-change?token={raw}" if base else ""

        subject = "Confirm your Siddes email change"
        lines = [
            "You requested to change the email on your Siddes account.",
            "",
            "If you made this request, confirm using the link below.",
            "If you did not request this change, ignore this email and consider changing your password.",
        ]
        if link:
            lines += ["", f"Confirm: {link}"]
        lines += ["", "If you cannot click links, paste this token in the app:", raw]
        text = "\n".join(lines) + "\n"

        res = send_email(to=new_email, subject=subject, text=text, html=None, request_id=rid)
        if not bool(res.get("ok")):
            return Response({"ok": False, "error": "email_send_failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Best-effort: notify old email
        if cur_email and cur_email.lower() != new_email.lower():
            try:
                send_email(
                    to=cur_email,
                    subject="Siddes security alert: email change requested",
                    text=f"An email change to {new_email} was requested for your account. If this wasn't you, change your password.\n",
                    html=None,
                    request_id=rid,
                )
            except Exception:
                pass

        return Response({"ok": True, "sent": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class EmailChangeConfirmView(APIView):
    """POST /api/auth/email/change/confirm

    Body: { "token": "..." }

    Confirms the new email and logs the user in (returns session payload).
    """

    throttle_scope = "auth_email_change_confirm"

    def post(self, request):
        body: Dict[str, Any] = request.data or {}
        token = str(body.get("token") or "").strip()
        if not token:
            return Response({"ok": False, "error": "missing_token"}, status=status.HTTP_400_BAD_REQUEST)

        h = _token_hash(token)
        rec = EmailChangeToken.objects.select_related("user").filter(token_hash=h).first()
        if not rec:
            return Response({"ok": False, "error": "invalid_token"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if rec.used_at is not None:
            return Response({"ok": False, "error": "token_used"}, status=status.HTTP_400_BAD_REQUEST)
        if rec.expires_at <= now:
            return Response({"ok": False, "error": "token_expired"}, status=status.HTTP_400_BAD_REQUEST)

        user = rec.user
        new_email = normalize_email(str(rec.new_email or ""))
        if not new_email:
            return Response({"ok": False, "error": "invalid_email"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
            return Response({"ok": False, "error": "email_taken"}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            # sd_473: revoke old email discoverability tokens (prevents matching by old email)
            try:
                ContactIdentityToken.objects.filter(user=user, kind="email").delete()
            except Exception:
                pass

            user.email = new_email
            user.save(update_fields=["email"])

            prof = _ensure_profile(user)
            prof.email_verified = True
            prof.email_verified_at = now
            prof.save(update_fields=["email_verified", "email_verified_at", "updated_at"])

            _ensure_email_identity_token(user, new_email)

            rec.used_at = now
            rec.save(update_fields=["used_at"])

        login(request, user)

        out = {
            "ok": True,
            "confirmed": True,
            "user": {"id": user.id, "username": user.get_username(), "email": user.email},
            "viewerId": viewer_id_for_user(user),
            "emailVerified": True,
            "session": _session_payload(request),
        }
        return Response(out, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class AccountDeactivateView(APIView):
    """POST /api/auth/account/deactivate

    Disables account immediately and logs out.
    """

    throttle_scope = "auth_account_deactivate"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        now = timezone.now()
        prof = _ensure_profile(user)
        prof.deactivated_at = now
        prof.account_state = "suspended"
        prof.account_state_until = None
        prof.account_state_reason = "self_deactivate"
        prof.account_state_set_by = viewer_id_for_user(user)
        prof.account_state_set_at = now
        prof.save(update_fields=[
            "deactivated_at",
            "account_state",
            "account_state_until",
            "account_state_reason",
            "account_state_set_by",
            "account_state_set_at",
            "updated_at",
        ])

        # Kill sessions and deactivate login
        try:
            user.is_active = False
            user.save(update_fields=["is_active"])
        except Exception:
            pass

        # sd_473: purge contact discoverability tokens/edges for deactivated accounts
        _purge_contact_discoverability(user)

        _revoke_all_sessions_for_user(user)

        try:
            logout(request)
            request.session.flush()
        except Exception:
            pass

        return Response({"ok": True, "deactivated": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class AccountDeleteRequestView(APIView):
    """POST /api/auth/account/delete/request

    Sends a confirmation link to the account's email.
    """

    throttle_scope = "auth_account_delete_request"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        prof = _ensure_profile(user)
        if not bool(getattr(prof, "email_verified", False)):
            return Response({"ok": False, "error": "email_not_verified"}, status=status.HTTP_400_BAD_REQUEST)

        cur_email = normalize_email(str(getattr(user, "email", "") or ""))
        if not cur_email or "@" not in cur_email:
            return Response({"ok": False, "error": "missing_email"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        ttl = _ttl_hours("SIDDES_ACCOUNT_DELETE_TTL_HOURS", 2)
        expires_at = now + timedelta(hours=ttl)

        raw = secrets.token_urlsafe(32)
        h = _token_hash(raw)

        rid = None
        try:
            rid = str(request.headers.get("x-request-id") or "").strip()[:64] or None
        except Exception:
            rid = None

        try:
            AccountDeleteToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        except Exception:
            pass

        AccountDeleteToken.objects.create(user=user, token_hash=h, expires_at=expires_at)

        base = _public_app_base()
        link = f"{base}/confirm-delete?token={raw}" if base else ""

        subject = "Confirm Siddes account deletion"
        lines = [
            "You requested to delete your Siddes account.",
            "",
            "This will deactivate your account immediately.",
            "If you did not request deletion, ignore this email.",
        ]
        if link:
            lines += ["", f"Confirm deletion: {link}"]
        lines += ["", "If you cannot click links, paste this token in the app:", raw]
        text = "\n".join(lines) + "\n"

        res = send_email(to=cur_email, subject=subject, text=text, html=None, request_id=rid)
        if not bool(res.get("ok")):
            return Response({"ok": False, "error": "email_send_failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"ok": True, "sent": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class AccountDeleteConfirmView(APIView):
    """POST /api/auth/account/delete/confirm

    Body: { "token": "..." }

    Soft-delete: scrubs email/name, sets username to deleted_*, disables account.
    """

    throttle_scope = "auth_account_delete_confirm"

    def post(self, request):
        body: Dict[str, Any] = request.data or {}
        token = str(body.get("token") or "").strip()
        if not token:
            return Response({"ok": False, "error": "missing_token"}, status=status.HTTP_400_BAD_REQUEST)

        h = _token_hash(token)
        rec = AccountDeleteToken.objects.select_related("user").filter(token_hash=h).first()
        if not rec:
            return Response({"ok": False, "error": "invalid_token"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if rec.used_at is not None:
            return Response({"ok": False, "error": "token_used"}, status=status.HTTP_400_BAD_REQUEST)
        if rec.expires_at <= now:
            return Response({"ok": False, "error": "token_expired"}, status=status.HTTP_400_BAD_REQUEST)

        user = rec.user
        User = get_user_model()

        # Generate a unique deleted username
        base = f"deleted_{user.id}"
        cand = base
        for i in range(0, 50):
            suffix = secrets.token_hex(2) if i > 0 else secrets.token_hex(2)
            cand = f"{base}_{suffix}"[:24]
            if not User.objects.filter(username__iexact=cand).exclude(id=user.id).exists():
                break
        new_username = cand

        with transaction.atomic():
            try:
                user.username = new_username
                user.email = ""
                try:
                    user.first_name = ""
                    user.last_name = ""
                except Exception:
                    pass
                user.is_active = False
                user.save(update_fields=["username", "email", "is_active", "first_name", "last_name"])
            except Exception:
                # Fallback: at least deactivate.
                user.is_active = False
                user.save(update_fields=["is_active"])

            prof = _ensure_profile(user)
            prof.deleted_at = now
            prof.account_state = "banned"
            prof.account_state_until = None
            prof.account_state_reason = "self_delete"
            prof.account_state_set_by = viewer_id_for_user(user)
            prof.account_state_set_at = now
            prof.save(update_fields=[
                "deleted_at",
                "account_state",
                "account_state_until",
                "account_state_reason",
                "account_state_set_by",
                "account_state_set_at",
                "updated_at",
            ])

            rec.used_at = now
            rec.save(update_fields=["used_at"])

        # sd_473: purge contact discoverability tokens/edges for deleted accounts
        _purge_contact_discoverability(user)

        _revoke_all_sessions_for_user(user)

        try:
            logout(request)
            request.session.flush()
        except Exception:
            pass

        return Response({"ok": True, "deleted": True}, status=status.HTTP_200_OK)


class ExportDataView(APIView):
    """GET /api/auth/export

    Returns JSON export of user's core data.
    """

    throttle_scope = "auth_export"

    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        prof = _ensure_profile(user)
        viewer = viewer_id_for_user(user)
        aliases = list(viewer_aliases(viewer))

        # limits
        try:
            limit = int(str(request.query_params.get("limit") or "1000"))
        except Exception:
            limit = 1000
        limit = max(1, min(limit, 5000))

        export: Dict[str, Any] = {
            "ok": True,
            "exportedAt": timezone.now().isoformat(),
            "user": {
                "id": user.id,
                "username": user.get_username(),
                "email": getattr(user, "email", ""),
                "isActive": bool(getattr(user, "is_active", True)),
            },
            "profile": {
                "emailVerified": bool(getattr(prof, "email_verified", False)),
                "emailVerifiedAt": getattr(prof, "email_verified_at", None).isoformat() if getattr(prof, "email_verified_at", None) else None,
                "onboarding": {
                    "completed": bool(getattr(prof, "onboarding_completed", False)),
                    "step": getattr(prof, "onboarding_step", "welcome"),
                    "contactSyncDone": bool(getattr(prof, "contact_sync_done", False)),
                },
                "locality": {
                    "detectedRegion": str(getattr(prof, "detected_region", "") or ""),
                    "chosenRegion": str(getattr(prof, "chosen_region", "") or ""),
                    "region": str(getattr(prof, "chosen_region", "") or getattr(prof, "detected_region", "") or ""),
                },
                "ageGateConfirmed": bool(getattr(prof, "age_gate_confirmed", False)),
                "ageGateConfirmedAt": getattr(prof, "age_gate_confirmed_at", None).isoformat() if getattr(prof, "age_gate_confirmed_at", None) else None,
                "accountState": getattr(prof, "account_state", "active"),
                "accountStateUntil": getattr(prof, "account_state_until", None).isoformat() if getattr(prof, "account_state_until", None) else None,
                "accountStateReason": getattr(prof, "account_state_reason", ""),
                "deactivatedAt": getattr(prof, "deactivated_at", None).isoformat() if getattr(prof, "deactivated_at", None) else None,
                "deletedAt": getattr(prof, "deleted_at", None).isoformat() if getattr(prof, "deleted_at", None) else None,
            },
            "aliases": aliases,
        }

        # Sets
        try:
            from siddes_sets.models import SiddesSet
            sets = list(SiddesSet.objects.filter(owner_id=viewer).order_by("-updated_at")[:limit].values())
        except Exception:
            sets = []
        export["sets"] = sets

        # Posts + replies
        try:
            from siddes_post.models import Post, Reply
            posts = list(Post.objects.filter(author_id__in=aliases).order_by("-created_at")[:limit].values())
            replies = list(Reply.objects.filter(author_id__in=aliases).order_by("-created_at")[:limit].values())
        except Exception:
            posts = []
            replies = []
        export["posts"] = posts
        export["replies"] = replies

        # Blocks + reports + appeals
        try:
            from siddes_safety.models import UserBlock, UserMute, UserReport, UserAppeal
            blocks = list(UserBlock.objects.filter(blocker_id__in=aliases).order_by("-created_at")[:limit].values())
            mutes = list(UserMute.objects.filter(muter_id__in=aliases).order_by("-created_at")[:limit].values())
            reports = list(UserReport.objects.filter(reporter_id__in=aliases).order_by("-created_at")[:limit].values())
            appeals = list(UserAppeal.objects.filter(appellant_id__in=aliases).order_by("-created_at")[:limit].values())
        except Exception:
            blocks = []
            mutes = []
            reports = []
            appeals = []
        export["blocks"] = blocks
        export["mutes"] = mutes
        export["reports"] = reports
        export["appeals"] = appeals

        resp = Response(export, status=status.HTTP_200_OK)
        resp["Cache-Control"] = "no-store"
        try:
            resp["Content-Disposition"] = f'attachment; filename="siddes_export_user_{user.id}.json"'
        except Exception:
            pass
        return resp
