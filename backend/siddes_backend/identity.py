"""Identity helpers (sd_243).

Siddes identity has two forms in v0:
- viewer id: me_<django_user_id>  (production session truth)
- handle: @username              (display + UI targeting)

We must treat them as ALIASES for membership checks.
"""

from __future__ import annotations

import re
from typing import Optional, Set

from django.contrib.auth import get_user_model

_VIEWER_RE = re.compile(r"^me_(\d+)$")


def _safe_str(x: object) -> str:
    return str(x or "").strip()


def parse_viewer_user_id(viewer_id: str) -> Optional[int]:
    s = _safe_str(viewer_id)
    m = _VIEWER_RE.match(s)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def normalize_handle(raw: str | None) -> Optional[str]:
    """Normalize a user handle.

    - Accepts "@name" or "name".
    - Lowercases for stable matching.
    - Returns None for non-handle tokens (e.g. me_123).
    """

    s = _safe_str(raw)
    if not s:
        return None

    if s.startswith("me_"):
        return None

    if not s.startswith("@"):
        if re.fullmatch(r"[A-Za-z0-9_.-]+", s):
            s = "@" + s
        else:
            return None

    uname = _safe_str(s[1:])
    if not uname:
        return None

    return "@" + uname.lower()


def handle_for_viewer_id(viewer_id: str) -> Optional[str]:
    """Best-effort: me_<id> -> @username."""

    uid = parse_viewer_user_id(viewer_id)
    if uid is None:
        return None

    try:
        User = get_user_model()
        u = User.objects.get(id=uid)
        uname = _safe_str(getattr(u, "username", ""))
        if not uname:
            return None
        return normalize_handle("@" + uname) or ("@" + uname)
    except Exception:
        return None


def viewer_aliases(viewer_id: str) -> Set[str]:
    """Return identity aliases for a viewer.

    Always includes the input token if non-empty.
    If token is me_<id> and user exists, include @username too.
    If token is a handle, include normalized handle.
    """

    v = _safe_str(viewer_id)
    if not v:
        return set()

    out: Set[str] = set()
    out.add(v)

    if v.startswith("@"):
        h = normalize_handle(v) or v
        out.add(h)
        return out

    h = handle_for_viewer_id(v)
    if h:
        out.add(h)

    return out

def display_for_token(token: str) -> dict:
    """Return a best-effort display dict for an identity token.

    Output keys:
      - id: original token (string)
      - handle: @username when possible
      - name: display name when possible

    Token forms:
      - me_<django_user_id>
      - @username
      - username
      - other opaque ids

    This is best-effort and must NEVER raise.
    """

    t = _safe_str(token)
    if not t:
        return {"id": "", "handle": "@unknown", "name": "Unknown"}

    # viewer id: me_<id>
    uid = parse_viewer_user_id(t)
    if uid is not None:
        try:
            User = get_user_model()
            u = User.objects.filter(id=uid).first()
            if u is None:
                return {"id": t, "handle": f"@user{uid}", "name": f"User {uid}"}

            uname = _safe_str(getattr(u, "username", ""))
            # Django User.get_full_name exists on AbstractUser
            full = ""
            try:
                full = _safe_str(u.get_full_name())
            except Exception:
                full = _safe_str((getattr(u, "first_name", "") or "") + " " + (getattr(u, "last_name", "") or ""))

            name = full or uname or f"User {uid}"
            handle = normalize_handle("@" + uname) if uname else f"@user{uid}"
            return {"id": t, "handle": handle or f"@user{uid}", "name": name}
        except Exception:
            # fall back to best-effort handle
            h = handle_for_viewer_id(t) or "@unknown"
            return {"id": t, "handle": h, "name": t}

    # handle token
    h = normalize_handle(t)
    if h:
        uname = h[1:]
        try:
            User = get_user_model()
            u = User.objects.filter(username__iexact=uname).first()
            if u is not None:
                try:
                    full = _safe_str(u.get_full_name())
                except Exception:
                    full = ""
                name = full or _safe_str(getattr(u, "username", "")) or uname
                return {"id": t, "handle": h, "name": name}
        except Exception:
            pass
        # No user found: still return normalized handle
        return {"id": t, "handle": h, "name": uname or t}

    # plain username-like
    if re.fullmatch(r"[A-Za-z0-9_.-]+", t):
        uname = t
        hh = "@" + uname.lower()
        try:
            User = get_user_model()
            u = User.objects.filter(username__iexact=uname).first()
            if u is not None:
                try:
                    full = _safe_str(u.get_full_name())
                except Exception:
                    full = ""
                name = full or _safe_str(getattr(u, "username", "")) or uname
                return {"id": t, "handle": hh, "name": name}
        except Exception:
            pass
        return {"id": t, "handle": hh, "name": uname}

    # opaque id
    return {"id": t, "handle": "@unknown", "name": t}
