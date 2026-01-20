from __future__ import annotations

import os
import re
from typing import Any, Dict, Optional, Tuple

from django.contrib.auth import authenticate, login, logout, get_user_model
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from siddes_backend.csrf import dev_csrf_exempt
from siddes_backend.throttles import SiddesScopedRateThrottle, SiddesLoginIdentifierThrottle
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_contacts.tokens import hmac_token
from siddes_contacts.normalize import normalize_email
from siddes_contacts.models import ContactIdentityToken
from siddes_sets.models import SiddesSet, SiddesSetMember
from .models import SiddesProfile
from .email_verification import create_and_send_email_verification
from .username_policy import validate_username_or_error

# Google verification (requires google-auth + requests)
try:
    from google.oauth2 import id_token  # type: ignore
    from google.auth.transport.requests import Request as GoogleRequest  # type: ignore
except Exception:  # pragma: no cover
    id_token = None
    GoogleRequest = None

_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")



# sd_371b: login timing equalization (reduce account enumeration via timing)
# We intentionally perform a password hash check on failed logins so
# requests for non-existent users cost roughly the same as wrong-password.
_SD_DUMMY_PW_HASH = make_password("not_the_password")

def _sd_slowdown_failed_login(password: str) -> None:
    try:
        check_password(password or "", _SD_DUMMY_PW_HASH)
    except Exception:
        pass

def viewer_id_for_user(user) -> str:
    # v0 convention: keep resolve_viewer_role() happy (treat as "me")
    return f"me_{user.id}"


def _ensure_profile(user) -> SiddesProfile:
    prof, _ = SiddesProfile.objects.get_or_create(user=user)
    return prof

# sd_399: locality helpers (coarse, privacy-respecting)
# Country is used for defaults only (localization/safety/perf). Never a hard lock.
_GEO_HEADER_CANDIDATES = (
    ("CF-IPCountry", "CF-IPCountry"),
    ("X-Vercel-IP-Country", "X-Vercel-IP-Country"),
    ("CloudFront-Viewer-Country", "CloudFront-Viewer-Country"),
    ("X-Geo-Country", "X-Geo-Country"),
    ("X-AppEngine-Country", "X-AppEngine-Country"),
)


def _min_age() -> int:
    try:
        return max(0, int(str(os.environ.get("SIDDES_MIN_AGE", "13")).strip() or "13"))
    except Exception:
        return 13


def _detect_country_code(request) -> Tuple[str, str]:
    """Return (country_code, source_header) best-effort."""
    try:
        hdrs = getattr(request, "headers", None)
    except Exception:
        hdrs = None
    if not hdrs:
        return ("", "")

    for name, key in _GEO_HEADER_CANDIDATES:
        try:
            v = hdrs.get(key)
        except Exception:
            v = None
        code = str(v or "").strip().upper()
        if not code:
            continue
        # Some providers use XX/T1 for unknown/tor
        if code in ("XX", "T1"):
            continue
        if len(code) == 2 and code.isalpha():
            return (code, name)

    return ("", "")


def _maybe_record_detected_region(prof: SiddesProfile, request) -> None:
    try:
        code, src = _detect_country_code(request)
        if not code:
            return
        cur = str(getattr(prof, "detected_region", "") or "").strip().upper()
        cur_src = str(getattr(prof, "detected_region_source", "") or "").strip()
        if cur == code and cur_src == src:
            return
        prof.detected_region = code
        prof.detected_region_source = src
        prof.save(update_fields=["detected_region", "detected_region_source", "updated_at"])
    except Exception:
        return


def _effective_region(prof: SiddesProfile) -> str:
    chosen = str(getattr(prof, "chosen_region", "") or "").strip().upper()
    if chosen:
        return chosen
    return str(getattr(prof, "detected_region", "") or "").strip().upper()


def _locality_payload(prof: SiddesProfile) -> Dict[str, Any]:
    det = str(getattr(prof, "detected_region", "") or "").strip().upper()
    cho = str(getattr(prof, "chosen_region", "") or "").strip().upper()
    eff = _effective_region(prof)
    return {"detectedRegion": det, "chosenRegion": cho, "region": eff}


def _ensure_age_gate(prof: SiddesProfile) -> None:
    try:
        if bool(getattr(prof, "age_gate_confirmed", False)):
            return
        prof.age_gate_confirmed = True
        prof.age_gate_confirmed_at = timezone.now()
        prof.save(update_fields=["age_gate_confirmed", "age_gate_confirmed_at", "updated_at"])
    except Exception:
        return



def _ensure_email_token(user, email: str) -> None:
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


def _bootstrap_default_sets(user) -> None:
    """Auto-create a few Sets so the app feels alive immediately."""
    owner = viewer_id_for_user(user)

    defaults = [
        dict(id=f"seed_{owner}_friends_closefriends", owner_id=owner, side="friends", label="Close Friends", color="emerald", members=[owner], count=0),
        dict(id=f"seed_{owner}_friends_gym", owner_id=owner, side="friends", label="Gym Crew", color="emerald", members=[owner], count=0),
        dict(id=f"seed_{owner}_close_family", owner_id=owner, side="close", label="Family", color="rose", members=[owner], count=0),
        dict(id=f"seed_{owner}_work_team", owner_id=owner, side="work", label="Team", color="slate", members=[owner], count=0),
    ]
    for s in defaults:
        obj, _ = SiddesSet.objects.update_or_create(id=s["id"], defaults=s)
        # sd_366: best-effort membership row sync
        try:
            mems = s.get("members") if isinstance(s.get("members"), list) else []
            for m in mems:
                mid = str(m or "").strip()
                if not mid:
                    continue
                if mid.startswith("@"): mid = "@" + mid[1:].strip().lower()
                SiddesSetMember.objects.get_or_create(set=obj, member_id=mid)
        except Exception:
            pass



@method_decorator(dev_csrf_exempt, name="dispatch")
class SignupView(APIView):
    throttle_scope = "auth_signup"
    def post(self, request):
        body: Dict[str, Any] = request.data or {}
        email = str(body.get("email") or "").strip().lower()
        raw_username = str(body.get("username") or "").strip()
        username, uerr = validate_username_or_error(raw_username)
        password = str(body.get("password") or "")
        age_confirmed = bool(body.get("ageConfirmed") or body.get("age_confirmed") or False)

        if not email or "@" not in email:
            return Response({"ok": False, "error": "invalid_email"}, status=status.HTTP_400_BAD_REQUEST)
        if uerr:
            return Response({"ok": False, "error": uerr}, status=status.HTTP_400_BAD_REQUEST)
        if not password or len(password) < 8:
            return Response({"ok": False, "error": "weak_password"}, status=status.HTTP_400_BAD_REQUEST)


        try:
            validate_password(password)
        except ValidationError:
            return Response({"ok": False, "error": "weak_password"}, status=status.HTTP_400_BAD_REQUEST)
        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            return Response({"ok": False, "error": "signup_unavailable"}, status=status.HTTP_409_CONFLICT)
        if User.objects.filter(email__iexact=email).exists():
            return Response({"ok": False, "error": "signup_unavailable"}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            user = User.objects.create_user(username=username, email=email, password=password)
            prof = _ensure_profile(user)
            if age_confirmed:
                _ensure_age_gate(prof)
            _maybe_record_detected_region(prof, request)
            _ensure_email_token(user, email)
            _bootstrap_default_sets(user)

        # sd_399: google locality record
        try:
            _maybe_record_detected_region(user.siddes_profile, request)
        except Exception:
            pass

        login(request, user)
        # Ensure session key exists (cookie set by SessionMiddleware)
        request.session.save()

        # 0.2: send verification email (signup must succeed even if email is not configured yet)
        try:
            create_and_send_email_verification(user, request_id=request.headers.get("x-request-id"))
        except Exception:
            pass

        out = {
            "ok": True,
            "user": {"id": user.id, "username": user.username, "email": user.email},
            "viewerId": viewer_id_for_user(user),
            "emailVerified": bool(getattr(user.siddes_profile, "email_verified", False)),
            "ageGateConfirmed": bool(getattr(user.siddes_profile, "age_gate_confirmed", False)),
            "minAge": _min_age(),
            "locality": _locality_payload(user.siddes_profile),
                "isStaff": bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)),
            "onboarding": {"completed": user.siddes_profile.onboarding_completed, "step": user.siddes_profile.onboarding_step, "contact_sync_done": user.siddes_profile.contact_sync_done},
        }
        return Response(out, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class LoginView(APIView):
    throttle_scope = "auth_login"
    throttle_classes = (SiddesScopedRateThrottle, SiddesLoginIdentifierThrottle)
    def post(self, request):
        body: Dict[str, Any] = request.data or {}
        identifier = str(body.get("identifier") or "").strip()
        password = str(body.get("password") or "")

        if not identifier or not password:
            return Response({"ok": False, "error": "invalid_credentials"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()

        username = identifier
        if username.startswith("@"):
            username = username[1:]
        if "@" in identifier:
            u = User.objects.filter(email__iexact=identifier).first()
            if not u:
                _sd_slowdown_failed_login(password)
                return Response({"ok": False, "error": "invalid_credentials"}, status=status.HTTP_401_UNAUTHORIZED)
            username = u.get_username()

        if "@" not in identifier:
            u2 = User.objects.filter(username__iexact=username).first()
            if u2:
                username = u2.get_username()

        user = authenticate(request, username=username, password=password)
        if not user:
            _sd_slowdown_failed_login(password)
            return Response({"ok": False, "error": "invalid_credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        prof = _ensure_profile(user)
        _maybe_record_detected_region(prof, request)
        login(request, user)
        # Ensure session key exists (cookie set by SessionMiddleware)
        request.session.save()

        out = {
            "ok": True,
            "user": {"id": user.id, "username": user.username, "email": user.email},
            "viewerId": viewer_id_for_user(user),
            "emailVerified": bool(getattr(user.siddes_profile, "email_verified", False)),
            "ageGateConfirmed": bool(getattr(user.siddes_profile, "age_gate_confirmed", False)),
            "minAge": _min_age(),
            "locality": _locality_payload(user.siddes_profile),
            "isStaff": bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)),
            "onboarding": {"completed": user.siddes_profile.onboarding_completed, "step": user.siddes_profile.onboarding_step, "contact_sync_done": user.siddes_profile.contact_sync_done},
        }
        return Response(out, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"ok": True}, status=status.HTTP_200_OK)


class MeView(APIView):
    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": True, "authenticated": False}, status=status.HTTP_200_OK)

        prof = _ensure_profile(user)
        _maybe_record_detected_region(prof, request)

        return Response(
            {
                "ok": True,
                "authenticated": True,
                "user": {"id": user.id, "username": user.username, "email": user.email},
                "viewerId": viewer_id_for_user(user),
                "emailVerified": bool(getattr(user.siddes_profile, "email_verified", False)),
            "ageGateConfirmed": bool(getattr(user.siddes_profile, "age_gate_confirmed", False)),
            "minAge": _min_age(),
            "locality": _locality_payload(user.siddes_profile),
                "onboarding": {"completed": user.siddes_profile.onboarding_completed, "step": user.siddes_profile.onboarding_step, "contact_sync_done": user.siddes_profile.contact_sync_done},
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(dev_csrf_exempt, name="dispatch")
class GoogleAuthView(APIView):
    """Sign in with Google using an ID token (Google Identity Services)."""

    throttle_scope = "auth_google"

    def post(self, request):
        if id_token is None or GoogleRequest is None:
            return Response({"ok": False, "error": "google_auth_not_installed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        body: Dict[str, Any] = request.data or {}
        credential = str(body.get("credential") or "").strip()
        if not credential:
            return Response({"ok": False, "error": "missing_credential"}, status=status.HTTP_400_BAD_REQUEST)

        client_id = str(os.environ.get("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
        if not client_id:
            return Response({"ok": False, "error": "missing_google_client_id"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            info = id_token.verify_oauth2_token(credential, GoogleRequest(), client_id)
        except Exception:
            return Response({"ok": False, "error": "invalid_google_token"}, status=status.HTTP_401_UNAUTHORIZED)

        email = str(info.get("email") or "").strip().lower()
        email_verified = bool(info.get("email_verified"))
        sub = str(info.get("sub") or "").strip()

        if not email or "@" not in email or not email_verified or not sub:
            return Response({"ok": False, "error": "google_email_unverified"}, status=status.HTTP_401_UNAUTHORIZED)

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        created = False

        if not user:
            # Generate a safe unique username; user can change later in onboarding.
            base_raw = re.sub(r"[^a-z0-9_]", "_", email.split("@")[0].lower())
            base_raw = base_raw.strip("_")[:12] or "sider"
            base, berr = validate_username_or_error(base_raw)
            if berr:
                base = "sider"

            cand = base
            n = 0
            while User.objects.filter(username__iexact=cand).exists():
                n += 1
                cand = f"{base}_{n}"
                cand = cand[:24].strip("_")
                cand2, cerr = validate_username_or_error(cand)
                if cerr:
                    cand = f"sider_{sub[-6:]}"[:24].strip("_")
                    break
                cand = cand2
                if n >= 999:
                    cand = f"sider_{sub[-6:]}"[:24].strip("_")
                    break

            with transaction.atomic():
                user = User.objects.create_user(username=cand, email=email, password=None)
                _ensure_profile(user)
                _ensure_email_token(user, email)
                _bootstrap_default_sets(user)
                created = True
        else:
            _ensure_profile(user)
            _ensure_email_token(user, email)

        # Google email is already verified by Google; mark local email verified.
        try:
            prof = _ensure_profile(user)
            if not getattr(prof, "email_verified", False):
                prof.email_verified = True
                prof.email_verified_at = timezone.now()
                prof.save(update_fields=["email_verified", "email_verified_at", "updated_at"])
        except Exception:
            pass

        login(request, user)
        # Ensure session key exists (cookie set by SessionMiddleware)
        request.session.save()

        out = {
            "ok": True,
            "created": created,
            "user": {"id": user.id, "username": user.username, "email": user.email},
            "viewerId": viewer_id_for_user(user),
            "emailVerified": bool(getattr(user.siddes_profile, "email_verified", False)),
            "ageGateConfirmed": bool(getattr(user.siddes_profile, "age_gate_confirmed", False)),
            "minAge": _min_age(),
            "locality": _locality_payload(user.siddes_profile),
            "isStaff": bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)),
            "onboarding": {"completed": user.siddes_profile.onboarding_completed, "step": user.siddes_profile.onboarding_step, "contact_sync_done": user.siddes_profile.contact_sync_done},
        }
        return Response(out, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class OnboardingCompleteView(APIView):
    """Mark onboarding as completed."""  # Siddes-native, minimal friction.

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        prof = _ensure_profile(user)

        # sd_399: require age gate before onboarding completion
        if not bool(getattr(prof, "age_gate_confirmed", False)):
            return Response({"ok": False, "error": "age_gate_required", "minAge": _min_age()}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data or {}

        contact_sync_done = bool(body.get("contact_sync_done"))
        if contact_sync_done:
            prof.contact_sync_done = True

        prof.onboarding_completed = True
        prof.onboarding_step = "done"
        prof.save(update_fields=["onboarding_completed", "onboarding_step", "contact_sync_done", "updated_at"])

        return Response(
            {
                "ok": True,
                "onboarding": {
                    "completed": True,
                    "step": prof.onboarding_step,
                    "contact_sync_done": prof.contact_sync_done,
                },
            },
            status=status.HTTP_200_OK,
        )




# ---------------------------------------------------------------------------
# Locality (sd_399)
# ---------------------------------------------------------------------------


@method_decorator(dev_csrf_exempt, name="dispatch")
class RegionView(APIView):
    """GET/POST /api/auth/region

    - GET: returns detected + chosen + effective region
    - POST: set/clear chosen region (2-letter country code)

    Privacy: coarse country only; used for defaults, never a hard lock.
    """

    throttle_scope = "auth_region"

    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        prof = _ensure_profile(user)
        _maybe_record_detected_region(prof, request)
        return Response({"ok": True, "locality": _locality_payload(prof)}, status=status.HTTP_200_OK)

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        prof = _ensure_profile(user)
        body: Dict[str, Any] = request.data or {}
        region = str(body.get("region") or body.get("chosenRegion") or "").strip().upper()

        if not region:
            prof.chosen_region = ""
            prof.chosen_region_set_at = None
            prof.save(update_fields=["chosen_region", "chosen_region_set_at", "updated_at"])
            _maybe_record_detected_region(prof, request)
            return Response({"ok": True, "cleared": True, "locality": _locality_payload(prof)}, status=status.HTTP_200_OK)

        if len(region) != 2 or (not region.isalpha()):
            return Response({"ok": False, "error": "invalid_region"}, status=status.HTTP_400_BAD_REQUEST)

        prof.chosen_region = region
        prof.chosen_region_set_at = timezone.now()
        prof.save(update_fields=["chosen_region", "chosen_region_set_at", "updated_at"])
        _maybe_record_detected_region(prof, request)

        return Response({"ok": True, "locality": _locality_payload(prof)}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class AgeGateConfirmView(APIView):
    """POST /api/auth/age/confirm

    Minimal v0: user confirms they meet the minimum age requirement.
    """

    throttle_scope = "auth_age_gate"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        prof = _ensure_profile(user)
        _ensure_age_gate(prof)
        return Response({"ok": True, "ageGateConfirmed": True, "minAge": _min_age()}, status=status.HTTP_200_OK)
