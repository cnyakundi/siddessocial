"""Endpoint stubs for push backend.

This module is framework-agnostic and documents required behaviors.

Endpoints (conceptual):
- GET /api/push/vapid -> public key (handled in Next for now; backend later)
- POST /api/push/subscribe -> store subscription by endpoint
- POST /api/push/unsubscribe -> remove subscription
- POST /api/push/send -> send payload to a user's subscriptions (admin/internal)

Real implementation should:
- authenticate user on subscribe/unsubscribe
- validate subscription JSON shape
- use a webpush library (pywebpush) to send notifications
"""

from __future__ import annotations

from typing import Any, Dict

from .payloads import PushPayload, validate_payload
from .store import PushStore


def parse_subscription(raw: Dict[str, Any]) -> Dict[str, str]:
    """Extract endpoint + keys from a PushSubscription JSON."""
    endpoint = raw.get("endpoint")
    keys = (raw.get("keys") or {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not endpoint or not p256dh or not auth:
        raise ValueError("invalid subscription")
    return {"endpoint": endpoint, "p256dh": p256dh, "auth": auth}


def subscribe(store: PushStore, user_id: str, subscription_json: Dict[str, Any]) -> Dict[str, Any]:
    sub = parse_subscription(subscription_json)
    rec = store.upsert(user_id, sub["endpoint"], sub["p256dh"], sub["auth"], subscription_json)
    return {"ok": True, "stored": True, "endpoint": rec.endpoint}


def unsubscribe(store: PushStore, user_id: str, endpoint: str) -> Dict[str, Any]:
    removed = store.remove(user_id, endpoint)
    return {"ok": True, "removed": removed}


def send(store: PushStore, user_id: str, payload: PushPayload) -> Dict[str, Any]:
    validate_payload(payload)
    subs = store.list_for_user(user_id)

    # Real send would call pywebpush for each subscription.
    # Here we just return what would have been sent.
    return {
        "ok": True,
        "subscriptions": len(subs),
        "payload": payload.__dict__,
    }
