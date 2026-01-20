from __future__ import annotations

from typing import Optional, Set


def _safe_str(x: object) -> str:
    return str(x or "").strip()


def _aliases(token: str) -> Set[str]:
    t = _safe_str(token)
    if not t:
        return set()
    try:
        from siddes_backend.identity import viewer_aliases  # type: ignore

        out = viewer_aliases(t)
        return {str(a).strip() for a in out if str(a).strip()}
    except Exception:
        return {t}


def normalize_target_token(raw: str | None) -> Optional[str]:
    """Normalize a user token for blocking.

    Accepts:
    - me_123
    - @username
    - username (becomes @username) when safe

    Returns None when invalid.
    """

    s = _safe_str(raw)
    if not s:
        return None

    # Prefer handles for human-facing identity.
    if s.startswith("me_"):
        return s

    if not s.startswith("@"):  # try to treat as username
        # Only allow simple tokens.
        ok = True
        for ch in s:
            if not (ch.isalnum() or ch in "_.-"):
                ok = False
                break
        if not ok:
            return None
        s = "@" + s

    # Normalize handle (lowercase)
    try:
        from siddes_backend.identity import normalize_handle  # type: ignore

        h = normalize_handle(s)
        return h or s.lower()
    except Exception:
        return s.lower()


def is_blocked_pair(viewer_id: str, other_token: str) -> bool:
    """Return True if either side has blocked the other."""

    v = _safe_str(viewer_id)
    o = _safe_str(other_token)
    if not v or not o:
        return False

    try:
        from .models import UserBlock

        v_alias = list(_aliases(v))
        o_alias = list(_aliases(o))
        if not v_alias or not o_alias:
            return False

        # viewer blocked other
        if UserBlock.objects.filter(blocker_id__in=v_alias, blocked_token__in=o_alias).exists():
            return True

        # other blocked viewer
        if UserBlock.objects.filter(blocker_id__in=o_alias, blocked_token__in=v_alias).exists():
            return True

        return False
    except Exception:
        # Fail-open: safety features should not crash the feed.
        return False

def is_muted(viewer_id: str, other_token: str) -> bool:
    """Return True if viewer has muted other_token (one-way).

    Notes:
    - Alias-aware (handles me_ id + @handle mapping).
    - Fail-open: must never crash the feed.
    """

    v = _safe_str(viewer_id)
    o = _safe_str(other_token)
    if not v or not o:
        return False

    try:
        from .models import UserMute

        v_alias = list(_aliases(v))
        o_alias = list(_aliases(o))
        if not v_alias or not o_alias:
            return False

        return bool(UserMute.objects.filter(muter_id__in=v_alias, muted_token__in=o_alias).exists())
    except Exception:
        return False

