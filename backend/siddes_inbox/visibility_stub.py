"""Deterministic inbox visibility shim (dev/stub).

Why this exists:
- Siddes rule: Close/Work must never leak server-side.
- In early dev, we don't have a relationship graph yet.
- So we use a deterministic *role* mapping for viewer identity, and filter by Side.

This module intentionally mirrors:
- `frontend/src/lib/server/inboxVisibility.ts`
- `docs/INBOX_VISIBILITY_STUB.md`

Important:
- Missing/empty viewer stays "unknown" (None) and should yield `restricted: true`.
- A *present* but unrecognized viewer string is normalized to the safest role: `anon`.
"""

from __future__ import annotations

from typing import List, Literal, Optional


ViewerRole = Literal["anon", "friends", "close", "work", "me"]
SideId = Literal["public", "friends", "close", "work"]


def resolve_viewer_role(raw: str | None) -> Optional[ViewerRole]:
    """Resolve a raw viewer string into a deterministic role.

    Returns:
    - None if raw is missing/empty (unknown viewer)
    - One of: anon|friends|close|work|me otherwise
    """

    v = str(raw or "").strip()
    if not v:
        return None

    v = v.lower()

    if v == "me" or v.startswith("me_"):
        return "me"

    if v == "friends" or v == "friend" or v.startswith("fr_"):
        return "friends"

    if v == "close" or v.startswith("cl_"):
        return "close"

    if v == "work" or v == "coworker" or v.startswith("wk_"):
        return "work"

    if v == "anon" or v == "anonymous":
        return "anon"

    # Safest fallback: treat unknown viewer strings as anonymous.
    return "anon"


def allowed_sides_for_role(role: ViewerRole) -> List[SideId]:
    if role == "me":
        return ["public", "friends", "close", "work"]
    if role == "friends":
        return ["public", "friends"]
    if role == "close":
        return ["public", "friends", "close"]
    if role == "work":
        return ["public", "work"]
    return ["public"]


def role_can_view(role: ViewerRole, side: SideId) -> bool:
    return side in set(allowed_sides_for_role(role))
