from __future__ import annotations

import hashlib
import os
import time
from typing import Optional

from django.db import transaction

from siddes_backend.identity import handle_for_viewer_id, normalize_handle

from .models import Notification


# sd_742_push_auto_dispatch_on_notifications


def _safe_str(x: object) -> str:
    return str(x or "").strip()


def _short(s: str, n: int) -> str:
    s = _safe_str(s)
    if len(s) <= n:
        return s
    return s[: max(0, n - 1)].rstrip() + "..."


def _actor_label(actor_id: str) -> str:
    a = _safe_str(actor_id)
    if not a:
        return ""

    # Best effort: me_<id> -> @username
    h = handle_for_viewer_id(a)
    if h:
        return h

    # If the actor is already a handle-like token
    nh = normalize_handle(a)
    if nh:
        return nh

    return a


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _push_on_notifications_enabled() -> bool:
    # Master gate for auto push when notifications are created/refreshed.
    return _truthy(os.environ.get("SIDDES_PUSH_ON_NOTIFICATIONS_ENABLED", "1"))


def _push_body_for_type(t: str) -> str:
    tt = _safe_str(t).lower()
    if tt == "mention":
        return "Mentioned you"
    if tt == "reply":
        return "Replied to your post"
    if tt == "like":
        return "Liked your post"
    if tt == "echo":
        return "Echoed your post"
    return "New activity"


def notify(
    *,
    viewer_id: str,
    side: Optional[str] = None,
    ntype: str,
    actor_id: str,
    glimpse: str = "",
    post_id: Optional[str] = None,
    post_title: Optional[str] = None,
) -> None:
    """Create or refresh a viewer-scoped notification.

    - Deterministic id (upsert): one active row per (viewer_id, type, actor, post_id)
    - If already read, a new event resets read_at to None.
    - Push dispatch is best-effort and never breaks the primary action.
    """

    vid = _safe_str(viewer_id)
    if not vid:
        return

    sid = _safe_str(side) or "public"
    if sid not in ("public", "friends", "close", "work"):
        sid = "public"

    t = _safe_str(ntype)[:16]
    if not t:
        return

    actor = _actor_label(actor_id)
    pid = _safe_str(post_id) or None

    title = _safe_str(post_title) or ""
    g = _safe_str(glimpse) or ""

    # Keep storage small + predictable
    title = _short(title, 80)
    g = _short(g, 220)

    key = f"{vid}|{sid}|{t}|{actor}|{pid or ''}"
    nid = "n_" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]

    now = float(time.time())

    # Determine whether this notification was previously read (so we should re-push).
    prev = None
    try:
        prev = Notification.objects.filter(id=nid).values("read_at").first()
    except Exception:
        prev = None

    prev_was_read = bool(prev) and (prev.get("read_at") is not None)

    defaults = {
        "viewer_id": vid,
        "side": sid,
        "type": t,
        "actor": actor,
        "glimpse": g,
        "post_id": pid,
        "post_title": title or None,
        "created_at": now,
        "read_at": None,
    }

    created = False
    try:
        with transaction.atomic():
            _, created = Notification.objects.update_or_create(id=nid, defaults=defaults)
    except Exception:
        # Notifications must never break the primary action.
        return

    # --- Push dispatch (best-effort) ---
    try:
        if not _push_on_notifications_enabled():
            return

        # Only push if newly created OR it was previously read.
        if not created and not prev_was_read:
            return

        # Build deep link
        url = f"/siddes-post/{pid}" if pid else "/siddes-notifications"

        # Build push content (must include glimpse)
        push_title = actor or "Siddes"
        push_body = _push_body_for_type(t)
        push_glimpse = g or title or push_body
        if len(push_glimpse) < 2:
            push_glimpse = "New activity"

        # Badge = unread notifications count (best-effort)
        badge = None
        try:
            badge = int(Notification.objects.filter(viewer_id=vid, read_at__isnull=True).count())
        except Exception:
            badge = None

        try:
            from siddes_push.payloads import PushPayload  # type: ignore
            from siddes_push.send import send_push_to_viewer_best_effort  # type: ignore
        except Exception:
            return

        
        # sd_743_push_prefs_gate: respect viewer push preferences (best-effort)
        try:
            from siddes_push.models import PushPreferences  # type: ignore
            from siddes_push.prefs import normalize_prefs  # type: ignore

            rec = PushPreferences.objects.filter(viewer_id=vid).values("prefs").first()
            prefs = normalize_prefs((rec or {}).get("prefs") or {}) if rec else normalize_prefs({})

            if not prefs.get("enabled", True):
                return

            tkey = (t or "other").lower()
            if tkey not in ("mention", "reply", "like", "echo"):
                tkey = "other"
            if not bool(prefs.get("types", {}).get(tkey, True)):
                return

            if not bool(prefs.get("sides", {}).get(sid, True)):
                return
        except Exception:
            pass
payload = PushPayload(
            title=push_title,
            body=push_body,
            url=url,
            side=sid,  # type: ignore[arg-type]
            glimpse=push_glimpse,
            icon="/icons/icon-192.png",
        )

        send_push_to_viewer_best_effort(viewer_id=vid, payload=payload, badge=badge)
    except Exception:
        # Never break primary action.
        return
