from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role

from .api_stub import parse_subscription
from .models import PushSubscription
from .payloads import PushPayload, validate_payload


# sd_741_push_backend_db


def _raw_viewer_from_request(request) -> Optional[str]:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        uid = str(getattr(user, "id", "") or "").strip()
        return f"me_{uid}" if uid else None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return raw or None


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or "anon").strip() or "anon"
    role = resolve_viewer_role(viewer) or "anon"
    return has_viewer, viewer, role


def _json_body(request) -> Dict[str, Any]:
    try:
        data = getattr(request, "data", None)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    try:
        return json.loads((request.body or b"{}").decode("utf-8") or "{}")
    except Exception:
        return {}


def _get_subscription_json(body: Dict[str, Any]) -> Dict[str, Any]:
    sub = body.get("subscription") if isinstance(body, dict) else None
    if isinstance(sub, dict):
        return sub
    return body if isinstance(body, dict) else {}


class PushStatusView(APIView):
    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(
                {"ok": True, "restricted": True, "viewer": None, "role": role, "count": 0},
                status=status.HTTP_200_OK,
            )

        count = PushSubscription.objects.filter(viewer_id=viewer).count()
        return Response(
            {"ok": True, "restricted": False, "viewer": viewer, "role": role, "count": count},
            status=status.HTTP_200_OK,
        )


class PushSubscribeView(APIView):
    permission_classes: list = []

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(
                {"ok": True, "restricted": True, "stored": False, "viewer": None, "role": role},
                status=status.HTTP_200_OK,
            )

        body = _json_body(request)
        sub_json = _get_subscription_json(body)
        try:
            sub = parse_subscription(sub_json)
        except Exception:
            return Response({"ok": False, "error": "invalid_subscription"}, status=status.HTTP_400_BAD_REQUEST)

        endpoint = str(sub.get("endpoint") or "").strip()
        p256dh = str(sub.get("p256dh") or "").strip()
        auth = str(sub.get("auth") or "").strip()
        if not endpoint or not p256dh or not auth:
            return Response({"ok": False, "error": "invalid_subscription"}, status=status.HTTP_400_BAD_REQUEST)

        now = float(time.time())
        ua = str(request.headers.get("user-agent") or "")[:255]

        rec, created = PushSubscription.objects.get_or_create(
            viewer_id=viewer,
            endpoint=endpoint,
            defaults={
                "p256dh": p256dh,
                "auth": auth,
                "raw": sub_json,
                "user_agent": ua,
                "created_at": now,
                "last_seen_at": now,
            },
        )

        if not created:
            rec.p256dh = p256dh
            rec.auth = auth
            rec.raw = sub_json
            rec.user_agent = ua
            rec.last_seen_at = now
            rec.save(update_fields=["p256dh", "auth", "raw", "user_agent", "last_seen_at"])

        return Response(
            {"ok": True, "restricted": False, "stored": True, "created": created, "endpoint": endpoint},
            status=status.HTTP_200_OK,
        )


class PushUnsubscribeView(APIView):
    permission_classes: list = []

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(
                {"ok": True, "restricted": True, "removed": False, "viewer": None, "role": role},
                status=status.HTTP_200_OK,
            )

        body = _json_body(request)
        endpoint = str(body.get("endpoint") or "").strip()

        if not endpoint:
            # Accept a full subscription JSON too.
            sub_json = _get_subscription_json(body)
            try:
                sub = parse_subscription(sub_json)
                endpoint = str(sub.get("endpoint") or "").strip()
            except Exception:
                endpoint = ""

        if not endpoint:
            return Response({"ok": False, "error": "endpoint_required"}, status=status.HTTP_400_BAD_REQUEST)

        deleted, _ = PushSubscription.objects.filter(viewer_id=viewer, endpoint=endpoint).delete()
        return Response(
            {"ok": True, "restricted": False, "removed": bool(deleted), "deleted": int(deleted), "endpoint": endpoint},
            status=status.HTTP_200_OK,
        )


class PushDebugSendView(APIView):
    permission_classes: list = []

    def post(self, request):
        if not getattr(settings, "DEBUG", False):
            return Response({"ok": False, "error": "disabled"}, status=status.HTTP_404_NOT_FOUND)

        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(
                {"ok": True, "restricted": True, "sent": 0, "viewer": None, "role": role},
                status=status.HTTP_200_OK,
            )

        priv = str(os.environ.get("SIDDES_VAPID_PRIVATE_KEY") or "").strip()
        subj = str(os.environ.get("SIDDES_VAPID_SUBJECT") or "").strip()
        if not priv or not subj:
            return Response(
                {"ok": False, "error": "missing_vapid", "need": ["SIDDES_VAPID_PRIVATE_KEY", "SIDDES_VAPID_SUBJECT"]},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            from pywebpush import WebPushException, webpush  # type: ignore
        except Exception:
            return Response({"ok": False, "error": "pywebpush_missing"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        body = _json_body(request)

        title = str(body.get("title") or "Siddes").strip()
        msg = str(body.get("body") or "Test notification").strip()
        url = str(body.get("url") or "/siddes-notifications").strip()
        side = str(body.get("side") or "friends").strip().lower()
        glimpse = str(body.get("glimpse") or msg[:140]).strip()

        icon = str(body.get("icon") or "/icons/icon-192.png").strip() or None
        image = str(body.get("image") or "").strip() or None
        badge = body.get("badge", 1)

        payload = PushPayload(
            title=title,
            body=msg,
            url=url if url.startswith("/") else "/siddes-notifications",
            side=side if side in ("public", "friends", "close", "work") else "friends",
            glimpse=glimpse,
            icon=icon,
            image=image,
        )
        try:
            validate_payload(payload)
        except Exception as e:
            return Response({"ok": False, "error": "invalid_payload", "detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        send_data = payload.__dict__.copy()
        try:
            send_data["badge"] = int(badge) if badge is not None else 1
        except Exception:
            send_data["badge"] = 1

        subs = list(PushSubscription.objects.filter(viewer_id=viewer).order_by("-last_seen_at", "-created_at"))
        sent = 0
        gone = 0
        errors: list = []

        for rec in subs:
            sub_info = rec.raw if isinstance(rec.raw, dict) and rec.raw.get("endpoint") else {
                "endpoint": rec.endpoint,
                "keys": {"p256dh": rec.p256dh, "auth": rec.auth},
            }

            try:
                webpush(
                    subscription_info=sub_info,
                    data=json.dumps(send_data),
                    vapid_private_key=priv,
                    vapid_claims={"sub": subj},
                )
                sent += 1
                rec.last_seen_at = float(time.time())
                rec.save(update_fields=["last_seen_at"])
            except WebPushException as e:  # type: ignore
                code = None
                try:
                    code = getattr(getattr(e, "response", None), "status_code", None)
                except Exception:
                    code = None

                if code in (404, 410):
                    PushSubscription.objects.filter(id=rec.id).delete()
                    gone += 1
                else:
                    errors.append({"endpoint": rec.endpoint[:80], "status": code, "error": str(e)})
            except Exception as e:
                errors.append({"endpoint": rec.endpoint[:80], "status": None, "error": str(e)})

        return Response(
            {
                "ok": True,
                "restricted": False,
                "viewer": viewer,
                "role": role,
                "subscriptions": len(subs),
                "sent": sent,
                "removed_gone": gone,
                "errors": errors[:10],
            },
            status=status.HTTP_200_OK,
        )

# sd_743_push_prefs
from .prefs import normalize_prefs
from .models import PushPreferences

# sd_745_push_prefs_view
class PushPrefsView(APIView):
    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": True, "restricted": True, "prefs": None}, status=status.HTTP_200_OK)

        from .prefs import normalize_prefs
        from .models import PushPreferences

        rec = PushPreferences.objects.filter(viewer_id=viewer).values("prefs").first()
        prefs = normalize_prefs((rec or {}).get("prefs") or {}) if rec else normalize_prefs({})
        return Response({"ok": True, "restricted": False, "prefs": prefs}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": True, "restricted": True, "prefs": None}, status=status.HTTP_200_OK)

        from .prefs import normalize_prefs
        from .models import PushPreferences
        import time

        body = _json_body(request)
        incoming = body.get("prefs") if isinstance(body, dict) else {}
        incoming = incoming if isinstance(incoming, dict) else {}
        prefs = normalize_prefs(incoming)

        now = float(time.time())
        PushPreferences.objects.update_or_create(
            viewer_id=viewer,
            defaults={"prefs": prefs, "updated_at": now},
        )

        return Response({"ok": True, "restricted": False, "prefs": prefs}, status=status.HTTP_200_OK)
