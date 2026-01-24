from __future__ import annotations

from typing import Any, Dict, Set

from django.apps import apps
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


def _mask_email(email: str) -> str:
    e = (email or "").strip()
    if not e or "@" not in e:
        return ""
    local, domain = e.split("@", 1)
    local = local.strip()
    domain = domain.strip()
    if not local:
        return f"***@{domain}"
    prefix = local[:2]
    return f"{prefix}***@{domain}"


def _mask_phone(phone: str) -> str:
    p = (phone or "").strip()
    if not p:
        return ""
    # Keep +CCC and last 2 digits if possible
    last2 = p[-2:] if len(p) >= 2 else p
    if p.startswith("+") and len(p) >= 6:
        return p[:4] + "****" + last2
    if len(p) >= 6:
        return p[:2] + "****" + last2
    return "****"


def _try_get_model(model_name: str):
    try:
        return apps.get_model("siddes_auth", model_name)
    except Exception:
        return None


def _provider_set_for_user(user) -> Set[str]:
    providers: Set[str] = set()

    # Support a few possible model names used across overlays.
    for model_name in ("OAuthIdentity", "ExternalIdentity", "SocialIdentity", "AuthIdentity"):
        M = _try_get_model(model_name)
        if not M:
            continue
        try:
            fields = {f.name for f in M._meta.fields}
            qs = M.objects.filter(user=user)
            if "provider" in fields:
                providers |= set(qs.values_list("provider", flat=True))
            elif "kind" in fields:
                providers |= set(qs.values_list("kind", flat=True))
        except Exception:
            continue

    return {str(p or "").strip().lower() for p in providers if str(p or "").strip()}


class ConnectedAuthMethodsView(APIView):
    # Read-only: expose what sign-in methods are connected to the current account.

    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        prof = getattr(user, "siddes_profile", None)

        email = str(getattr(user, "email", "") or "").strip()
        email_verified = bool(getattr(prof, "email_verified", False)) if prof else False
        try:
            has_password = bool(user.has_usable_password())
        except Exception:
            has_password = False

        providers = _provider_set_for_user(user)

        # Passkeys: optional model; return count if available.
        passkey_count = 0
        Passkey = _try_get_model("PasskeyCredential")
        if Passkey:
            try:
                passkey_count = int(Passkey.objects.filter(user=user).count())
            except Exception:
                passkey_count = 0

        # Phone: if provider identity is stored under 'phone' or 'sms'
        phone_connected = ("phone" in providers) or ("sms" in providers) or ("otp" in providers)

        # Magic link is email-based; it's available if email exists.
        magic_enabled = bool(email)

        out: Dict[str, Any] = {
            "ok": True,
            "authenticated": True,
            "methods": {
                "password": {"enabled": has_password},
                "email": {"exists": bool(email), "verified": email_verified, "hint": _mask_email(email)},
                "magicLink": {"enabled": magic_enabled},
                "passkeys": {"count": passkey_count},
                "google": {"connected": ("google" in providers)},
                "apple": {"connected": ("apple" in providers)},
                "phone": {"connected": phone_connected, "hint": ""},
            },
        }
        return Response(out, status=status.HTTP_200_OK)
