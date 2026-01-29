from __future__ import annotations

import os
from typing import Optional

# sd_793_inbox_dm_push
#
# Best-effort DM push notifications.
# - Never breaks the primary action (sending a DM)
# - Respects global push enable, DM enable, and viewer push preferences (when available)
#
# Env:
# - SIDDES_PUSH_ENABLED=1 (master, already enforced in siddes_push.send)
# - SIDDES_PUSH_ON_DMS_ENABLED=1 (this feature gate)
#
# Prefs:
# - Uses PushPreferences.enabled + PushPreferences.sides[side]
# - Uses PushPreferences.types.other as the "DM" toggle (no separate dm toggle yet)

def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")

def _push_on_dms_enabled() -> bool:
    return _truthy(os.environ.get("SIDDES_PUSH_ON_DMS_ENABLED", "1"))

def _safe_str(x: object) -> str:
    return str(x or "").strip()

def _short(s: str, n: int) -> str:
    s = _safe_str(s)
    if len(s) <= n:
        return s
    return s[: max(0, n - 1)].rstrip() + "..."

def send_dm_push_best_effort(
    *,
    viewer_id: str,
    side: str,
    thread_id: str,
    actor: str,
    text: str,
    badge: Optional[int] = None,
) -> None:
    """Send a DM push to viewer_id (best-effort)."""
    try:
        if not _push_on_dms_enabled():
            return

        vid = _safe_str(viewer_id)
        if not vid:
            return

        sid = _safe_str(side).lower() or "friends"
        if sid not in ("public", "friends", "close", "work"):
            sid = "friends"

        # sd_743_push_prefs_gate reuse: respect prefs if available.
        try:
            from siddes_push.models import PushPreferences  # type: ignore
            from siddes_push.prefs import normalize_prefs  # type: ignore

            rec = PushPreferences.objects.filter(viewer_id=vid).values("prefs").first()
            prefs = normalize_prefs((rec or {}).get("prefs") or {}) if rec else normalize_prefs({})

            if not prefs.get("enabled", True):
                return
            if not prefs.get("sides", {}).get(sid, True):
                return
            # Use "other" as the DM toggle.
            if not prefs.get("types", {}).get("other", True):
                return
        except Exception:
            pass

        try:
            from siddes_push.payloads import PushPayload  # type: ignore
            from siddes_push.send import send_push_to_viewer_best_effort  # type: ignore
        except Exception:
            return

        title = _short(_safe_str(actor) or "Siddes", 80)
        body = "New message"
        glimpse = _short(_safe_str(text) or body, 220)
        if len(glimpse) < 2:
            glimpse = body

        url = f"/siddes-inbox/{_safe_str(thread_id)}"
        if not url.startswith("/"):
            url = "/siddes-inbox"

        payload = PushPayload(
            title=title,
            body=body,
            url=url,
            side=sid,  # type: ignore[arg-type]
            glimpse=glimpse,
            icon="/icons/icon-192.png",
        )

        send_push_to_viewer_best_effort(viewer_id=vid, payload=payload, badge=badge)
    except Exception:
        return
