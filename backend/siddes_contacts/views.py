from __future__ import annotations


def _norm_identifiers(raw, *, limit: int = 2000):
    if not isinstance(raw, list):
        return [], "identifiers must be a list"
    out = []
    seen = set()
    for x in raw:
        if not isinstance(x, str):
            continue
        v = x.strip()
        if not v:
            continue
        k = v.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(v)
        if len(out) >= limit:
            break
    if not out:
        return [], "no valid identifiers"
    return out, None


import os

from django.contrib.auth import get_user_model

from django.conf import settings
from django.utils import timezone

from typing import Any, Dict, List

from django.utils.decorators import method_decorator
from siddes_backend.csrf import dev_csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .normalize import normalize_email, normalize_phone
from .tokens import hmac_token
from .models import ContactIdentityToken, ContactMatchEdge


def _viewer_id(user) -> str:
    return f"me_{user.id}"


@method_decorator(dev_csrf_exempt, name="dispatch")
class ContactsMatchView(APIView):
    """POST /api/contacts/match

    v0: Matches identifiers -> existing Siddes users via HMAC tokens.

    sd_357: added optional server-side suggestion seeding.
    sd_358: Local-first: return safe derived hints for on-device clustering.

    Personal context intelligence (who belongs where) should run ON-DEVICE.
    Server-side seeding is therefore OFF by default and must be explicitly enabled.
    """

    # SD_358_CONTACTS_MATCH_THROTTLE
    throttle_scope = "contacts_match"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data or {}
        identifiers = body.get("identifiers")
        if not isinstance(identifiers, list) or not identifiers:
            return Response({"ok": True, "matches": []}, status=status.HTTP_200_OK)

        tokens: List[str] = []
        token_meta: Dict[str, Dict[str, Any]] = {}

        def is_workish_domain(domain: str) -> bool:
            d = str(domain or "").strip().lower()
            if not d or "." not in d:
                return False
            personal = {
                "gmail.com",
                "googlemail.com",
                "yahoo.com",
                "yahoo.co.uk",
                "outlook.com",
                "hotmail.com",
                "live.com",
                "icloud.com",
                "aol.com",
                "proton.me",
                "protonmail.com",
                "zoho.com",
            }
            return d not in personal

        default_region = "KE"
        try:
            prof = getattr(user, "siddes_profile", None)
            dr = str(getattr(prof, "chosen_region", "") or getattr(prof, "detected_region", "") or "").strip().upper()
            if dr and len(dr) == 2 and dr.isalpha():
                default_region = dr
        except Exception:
            pass

        for raw in identifiers[:2000]:
            s = str(raw or "").strip()
            if not s:
                continue
            if len(s) > 256:
                continue
            if "@" in s:
                e = normalize_email(s)
                if e:
                    t = hmac_token(e)
                    tokens.append(t)
                    dom = e.split("@", 1)[1].lower().strip() if "@" in e else ""
                    token_meta[t] = {"kind": "email", "domain": dom, "workish": is_workish_domain(dom)}
            else:
                ph = normalize_phone(s, default_region=default_region) or None
                if ph:
                    t = hmac_token(ph)
                    tokens.append(t)
                    token_meta[t] = {"kind": "phone", "domain": None, "workish": False}

        if not tokens:
            return Response({"ok": True, "matches": []}, status=status.HTTP_200_OK)

        qs = ContactIdentityToken.objects.filter(token__in=tokens, user__is_active=True, user__siddes_profile__email_verified=True, user__siddes_profile__deleted_at__isnull=True, user__siddes_profile__account_state="active").select_related("user").all()

        matches = []
        match_rows = []  # safe, derived rows used only if server seeding is enabled

        seen_users = set()
        for rec in qs[:200]:
            u = rec.user
            uid = _viewer_id(u)
            if uid in seen_users:
                continue
            seen_users.add(uid)

            uname = str(getattr(u, "username", "") or "").strip() or f"user{getattr(u, 'id', '')}"
            handle = "@" + uname.lstrip("@").strip().lower()

            meta = token_meta.get(str(getattr(rec, "token", "") or ""), {})
            hint = {
                "kind": meta.get("kind"),
                "domain": meta.get("domain"),
                "workish": bool(meta.get("workish")),
            }

            # Persist a safe match edge (viewer -> matched user). Never store raw identifiers.
            try:
                ContactMatchEdge.objects.update_or_create(
                    viewer=user,
                    matched_user=u,
                    defaults={
                        "kind": str(hint.get("kind") or "email"),
                        "domain": str(hint.get("domain") or ""),
                        "workish": bool(hint.get("workish")),
                    },
                )
            except Exception:
                pass

            matches.append(
                {
                    "user_id": uid,
                    "handle": handle,
                    "display_name": uname,
                    "hint": hint,
                }
            )

            match_rows.append(
                {
                    "user_id": uid,
                    "handle": handle,
                    "domain": meta.get("domain"),
                    "workish": bool(meta.get("workish")),
                }
            )

        # Optional: seed server-side suggestions (dev/experiments only).
        # Default OFF — Siddes personal context intelligence should run on-device.
        enabled = os.environ.get("SIDDES_ENABLE_SERVER_SUGGESTIONS", "").strip().lower() in {"1", "true", "yes", "on"}
        if enabled:
            try:
                from siddes_ml.seed import seed_from_contact_matches  # type: ignore

                seed_from_contact_matches(viewer_id=_viewer_id(user), match_rows=match_rows, model_version="contacts_match_v0")
            except Exception:
                pass

        return Response({"ok": True, "matches": matches}, status=status.HTTP_200_OK)


class ContactsSuggestionsView(APIView):
    """GET /api/contacts/suggestions

    DB-backed "people you may know" list used to replace frontend MOCK_CONTACTS.
    """

    # SD_359_CONTACTS_SUGGESTIONS_THROTTLE
    throttle_scope = "contacts_suggestions"

    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        # Production-safe suggestions:
        # Return ONLY viewer-scoped contact match edges (no global directory listing).
        items = []
        try:
            edges = (
                ContactMatchEdge.objects.filter(viewer=user, matched_user__is_active=True, matched_user__siddes_profile__email_verified=True, matched_user__siddes_profile__deleted_at__isnull=True, matched_user__siddes_profile__account_state="active")
                .select_related("matched_user")
                .order_by("-last_seen_at")[:80]
            )
            for e in edges:
                u = getattr(e, "matched_user", None)
                uname = str(getattr(u, "username", "") or "").strip() if u else ""
                if not uname:
                    uname = f"user{getattr(u, 'id', '')}" if u else "user"
                items.append(
                    {
                        "id": f"u{getattr(u, 'id', '')}" if u else "",
                        "name": uname,
                        "handle": f"@{uname}",
                        "matched": True,
                        "hint": {"kind": getattr(e, "kind", ""), "domain": getattr(e, "domain", ""), "workish": bool(getattr(e, "workish", False))},
                    }
                )
        except Exception:
            items = []

        # If we have viewer-scoped edges, return them in both dev and prod.
        if items:
            return Response({"ok": True, "items": items}, status=status.HTTP_200_OK)

        # In production, do NOT return a directory-like list of users.
        if not settings.DEBUG:
            return Response({"ok": True, "items": []}, status=status.HTTP_200_OK)

        # DEV-only fallback: small list of other users for demo/testing.
        User = get_user_model()
        qs = User.objects.exclude(id=user.id).order_by("id")[:50]

        items = []
        for u in qs:
            uname = str(getattr(u, "username", "") or "").strip()
            if not uname:
                uname = f"user{getattr(u, 'id', '')}"
            items.append(
                {
                    "id": f"u{getattr(u, 'id', '')}",
                    "name": uname,
                    "handle": f"@{uname}",
                    "matched": True,
                }
            )

        return Response({"ok": True, "items": items}, status=status.HTTP_200_OK)
