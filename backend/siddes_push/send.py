from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional

from django.conf import settings

from siddes_backend.abuse_limits import enforce_bucket_limit

from .models import PushSubscription
from .payloads import PushPayload, validate_payload


# sd_742_push_auto_dispatch


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _push_enabled() -> bool:
    # Master gate for any automatic push sending.
    return _truthy(os.environ.get("SIDDES_PUSH_ENABLED", "1"))


def _vapid_keys() -> tuple[str, str] | None:
    priv = str(os.environ.get("SIDDES_VAPID_PRIVATE_KEY") or "").strip()
    subj = str(os.environ.get("SIDDES_VAPID_SUBJECT") or "").strip()
    if not priv or not subj:
        return None
    return priv, subj


def _rate_limit_ok(viewer_id: str) -> bool:
    # Prevent push storms (best-effort).
    try:
        per_min = int(os.environ.get("SIDDES_PUSH_MAX_PER_MIN", "8"))
    except Exception:
        per_min = 8

    try:
        r = enforce_bucket_limit(scope="push_send:m", parts=[str(viewer_id)], limit=int(per_min), window_s=60)
        return bool(r.ok)
    except Exception:
        return True


def send_push_to_viewer_best_effort(*, viewer_id: str, payload: PushPayload, badge: Optional[int] = None) -> Dict[str, Any]:
    """Send a push payload to all subscriptions for a viewer (best-effort).

    - Requires env: SIDDES_VAPID_PRIVATE_KEY + SIDDES_VAPID_SUBJECT
    - Removes gone subscriptions (404/410)
    - Never raises
    """

    vid = str(viewer_id or "").strip()
    if not vid:
        return {"ok": True, "sent": 0, "reason": "no_viewer"}

    if not _push_enabled():
        return {"ok": True, "sent": 0, "reason": "disabled"}

    if not _rate_limit_ok(vid):
        return {"ok": True, "sent": 0, "reason": "rate_limited"}

    keys = _vapid_keys()
    if not keys:
        return {"ok": True, "sent": 0, "reason": "missing_vapid"}

    try:
        validate_payload(payload)
    except Exception:
        return {"ok": False, "sent": 0, "reason": "invalid_payload"}

    try:
        from pywebpush import WebPushException, webpush  # type: ignore
    except Exception:
        return {"ok": True, "sent": 0, "reason": "pywebpush_missing"}

    priv, subj = keys

    # Optional badge (supported browsers only). Keep it integer-ish.
    send_data: Dict[str, Any] = dict(payload.__dict__)
    if badge is not None:
        try:
            send_data["badge"] = int(badge)
        except Exception:
            send_data["badge"] = 1

    subs = list(PushSubscription.objects.filter(viewer_id=vid).order_by("-last_seen_at", "-created_at"))

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
            try:
                rec.last_seen_at = float(time.time())
                rec.save(update_fields=["last_seen_at"])
            except Exception:
                pass
        except WebPushException as e:  # type: ignore
            code = None
            try:
                code = getattr(getattr(e, "response", None), "status_code", None)
            except Exception:
                code = None

            if code in (404, 410):
                try:
                    PushSubscription.objects.filter(id=rec.id).delete()
                except Exception:
                    pass
                gone += 1
            else:
                errors.append({"endpoint": rec.endpoint[:80], "status": code, "error": str(e)})
        except Exception as e:
            errors.append({"endpoint": rec.endpoint[:80], "status": None, "error": str(e)})

    return {"ok": True, "subscriptions": len(subs), "sent": sent, "removed_gone": gone, "errors": errors[:5]}
