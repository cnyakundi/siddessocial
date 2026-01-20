#!/usr/bin/env bash
set -euo pipefail

# sd_315_password_reset_change_password_apply_helper.sh
# Launch Part 0 / Workstream 0.3
# - Password reset request + confirm (hashed expiring single-use tokens)
# - Change password endpoint (session-required)
# - Minimal frontend pages: /forgot-password + /reset-password
# - Minimal account security page: /siddes-profile/account/password

need_dir() {
  if [[ ! -d "$1" ]]; then
    echo "ERROR: Expected directory not found: $1"
    echo "Run this from your Siddes repo root."
    exit 1
  fi
}

PYBIN="python3"
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  PYBIN="python"
fi

need_dir "frontend"
need_dir "backend"
need_dir "docs"
need_dir "backend/siddes_auth"
need_dir "backend/siddes_backend"
need_dir "frontend/src/app"
need_dir "frontend/src/app/api/auth"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_sd_315_password_reset_${STAMP}"
mkdir -p "$BACKUP_DIR"

backup_if_exists() {
  local f="$1"
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -f "$f" "$BACKUP_DIR/$f"
  fi
}

echo "== sd_315: Password reset + change password =="
echo "Backups: $BACKUP_DIR"

# Back up touched files
backup_if_exists "backend/siddes_auth/models.py"
backup_if_exists "backend/siddes_auth/urls.py"
backup_if_exists "backend/siddes_auth/password_reset.py"
backup_if_exists "backend/siddes_auth/migrations/0003_password_reset.py"
backup_if_exists "backend/siddes_backend/settings.py"
backup_if_exists "docs/STATE.md"
backup_if_exists "docs/PASSWORD_RESET.md"

backup_if_exists "frontend/src/app/api/auth/password/reset/request/route.ts"
backup_if_exists "frontend/src/app/api/auth/password/reset/confirm/route.ts"
backup_if_exists "frontend/src/app/api/auth/password/change/route.ts"

backup_if_exists "frontend/src/app/forgot-password/page.tsx"
backup_if_exists "frontend/src/app/reset-password/page.tsx"
backup_if_exists "frontend/src/app/login/page.tsx"

backup_if_exists "frontend/src/app/siddes-profile/account/page.tsx"
backup_if_exists "frontend/src/app/siddes-profile/account/password/page.tsx"

# ------------------------------------------------------------------------------
# Backend: password_reset.py
# ------------------------------------------------------------------------------
cat > backend/siddes_auth/password_reset.py <<'PY'
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


def _viewer_id_for_user(user) -> str:
    return f"me_{getattr(user, 'id', '')}"


def _session_payload(request) -> Dict[str, str]:
    request.session.save()
    return {"name": "sessionid", "value": request.session.session_key or ""}


def _token_hash(raw: str) -> str:
    return hashlib.sha256((raw or "").encode("utf-8")).hexdigest()


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
    """
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
    """
    POST /api/auth/password/reset/request
    Body: { identifier: email|username }  (or { email: ... })

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
    """
    POST /api/auth/password/reset/confirm
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

        out = {
            "ok": True,
            "reset": True,
            "user": {"id": user.id, "username": user.get_username(), "email": getattr(user, "email", "")},
            "viewerId": _viewer_id_for_user(user),
            "emailVerified": bool(getattr(prof, "email_verified", False)),
            "session": _session_payload(request),
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
    """
    POST /api/auth/password/change
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

        return Response({"ok": True, "changed": True}, status=status.HTTP_200_OK)
PY
echo "OK: wrote backend/siddes_auth/password_reset.py"

# ------------------------------------------------------------------------------
# Backend: models.py (add PasswordResetToken)
# ------------------------------------------------------------------------------
$PYBIN - <<'PY'
import pathlib, sys

p = pathlib.Path("backend/siddes_auth/models.py")
txt = p.read_text(encoding="utf-8")

if "class PasswordResetToken" in txt:
    print("SKIP: PasswordResetToken already present in models.py")
    sys.exit(0)

block = '''
class PasswordResetToken(models.Model):
    """Single-use password reset token (hashed)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="password_reset_tokens")
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]
'''.strip() + "\n"

p.write_text(txt.rstrip() + "\n\n" + block + "\n", encoding="utf-8")
print("OK: patched", str(p))
PY

# ------------------------------------------------------------------------------
# Backend: migration 0003_password_reset.py
# ------------------------------------------------------------------------------
mkdir -p backend/siddes_auth/migrations
cat > backend/siddes_auth/migrations/0003_password_reset.py <<'PY'
from __future__ import annotations

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_auth", "0002_email_verification"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PasswordResetToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254)),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="password_reset_tokens",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [models.Index(fields=["user", "created_at"], name="siddes_auth_pwrt_user_created_at_idx")],
            },
        ),
    ]
PY
echo "OK: wrote backend/siddes_auth/migrations/0003_password_reset.py"

# ------------------------------------------------------------------------------
# Backend: urls.py (wire endpoints)
# ------------------------------------------------------------------------------
$PYBIN - <<'PY'
import pathlib, sys

p = pathlib.Path("backend/siddes_auth/urls.py")
txt = p.read_text(encoding="utf-8")

if "PasswordResetRequestView" in txt:
    print("SKIP: password reset views already wired in urls.py")
    sys.exit(0)

imp_line = "from .email_verification import VerifyConfirmView, VerifyResendView"
add_imp = imp_line + "\nfrom .password_reset import PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView"

if imp_line in txt:
    txt = txt.replace(imp_line, add_imp)
else:
    # Fallback: add import near top
    lines = txt.splitlines()
    out = []
    inserted = False
    for line in lines:
        out.append(line)
        if (not inserted) and line.startswith("from .email_verification"):
            out.append("from .password_reset import PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView")
            inserted = True
    txt = "\n".join(out) + "\n"

needle = '    path("verify/resend", VerifyResendView.as_view()),'
if needle in txt:
    insert = needle + "\n    path(\"password/reset/request\", PasswordResetRequestView.as_view()),\n    path(\"password/reset/confirm\", PasswordResetConfirmView.as_view()),\n    path(\"password/change\", PasswordChangeView.as_view()),"
    txt = txt.replace(needle, insert)
else:
    # Fallback: append before closing bracket
    txt = txt.rstrip().rstrip("]")
    txt += "\n    path(\"password/reset/request\", PasswordResetRequestView.as_view()),\n    path(\"password/reset/confirm\", PasswordResetConfirmView.as_view()),\n    path(\"password/change\", PasswordChangeView.as_view()),\n]\n"

p.write_text(txt, encoding="utf-8")
print("OK: patched", str(p))
PY

# ------------------------------------------------------------------------------
# Backend: settings.py throttles
# ------------------------------------------------------------------------------
$PYBIN - <<'PY'
import pathlib, sys

p = pathlib.Path("backend/siddes_backend/settings.py")
txt = p.read_text(encoding="utf-8")

if "auth_pw_reset_request" in txt or "SIDDES_THROTTLE_AUTH_PW_RESET_REQUEST" in txt:
    print("SKIP: password throttles already present in settings.py")
    sys.exit(0)

anchor = '        "auth_verify_resend": _env("SIDDES_THROTTLE_AUTH_VERIFY_RESEND", "10/hour"),'
insert = anchor + "\n\n        \"auth_pw_reset_request\": _env(\"SIDDES_THROTTLE_AUTH_PW_RESET_REQUEST\", \"5/hour\"),\n        \"auth_pw_reset_confirm\": _env(\"SIDDES_THROTTLE_AUTH_PW_RESET_CONFIRM\", \"30/min\"),\n        \"auth_pw_change\": _env(\"SIDDES_THROTTLE_AUTH_PW_CHANGE\", \"10/min\"),"

if anchor in txt:
    txt = txt.replace(anchor, insert)
else:
    print("WARN: Could not find verify resend throttle anchor; appending near auth throttles.")
    # Append near auth_google if present
    anchor2 = '        "auth_google": _env("SIDDES_THROTTLE_AUTH_GOOGLE", "30/min"),'
    if anchor2 in txt:
        txt = txt.replace(anchor2, anchor2 + "\n\n        \"auth_pw_reset_request\": _env(\"SIDDES_THROTTLE_AUTH_PW_RESET_REQUEST\", \"5/hour\"),\n        \"auth_pw_reset_confirm\": _env(\"SIDDES_THROTTLE_AUTH_PW_RESET_CONFIRM\", \"30/min\"),\n        \"auth_pw_change\": _env(\"SIDDES_THROTTLE_AUTH_PW_CHANGE\", \"10/min\"),")

p.write_text(txt, encoding="utf-8")
print("OK: patched", str(p))
PY

# ------------------------------------------------------------------------------
# Docs: PASSWORD_RESET.md
# ------------------------------------------------------------------------------
cat > docs/PASSWORD_RESET.md <<'MD'
# Siddes - Password reset + change password (Workstream 0.3)

This ships the account recovery essentials:
- Password reset request + confirm (email-based)
- Change password for authenticated users

## Endpoints

### Request reset
`POST /api/auth/password/reset/request`

Body:
```json
{ "identifier": "email-or-username" }
