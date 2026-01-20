from __future__ import annotations

import hashlib
import time
from typing import Optional

from django.db import transaction

from siddes_backend.identity import handle_for_viewer_id, normalize_handle

from .models import Notification


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


def notify(*, viewer_id: str, ntype: str, actor_id: str, glimpse: str = "", post_id: Optional[str] = None, post_title: Optional[str] = None) -> None:
    """Create or refresh a viewer-scoped notification.

    - Deterministic id (upsert): one active row per (viewer_id, type, actor, post_id)
    - If already read, a new event resets read_at to None.

    This is EXPLICIT. No Django signals.
    """

    vid = _safe_str(viewer_id)
    if not vid:
        return

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

    key = f"{vid}|{t}|{actor}|{pid or ''}"
    nid = "n_" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]

    now = float(time.time())

    defaults = {
        "viewer_id": vid,
        "type": t,
        "actor": actor,
        "glimpse": g,
        "post_id": pid,
        "post_title": title or None,
        "created_at": now,
        "read_at": None,
    }

    try:
        with transaction.atomic():
            Notification.objects.update_or_create(id=nid, defaults=defaults)
    except Exception:
        # Notifications must never break the primary action.
        return
