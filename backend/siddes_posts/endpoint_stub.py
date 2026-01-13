"""Create post endpoint stub with posting permission + idempotency.

Inputs:
- author_id (viewer) from auth
- side
- text
- set_id (optional)
- urgent (optional)
- client_key (optional) for idempotency

Permission model (v0):
- public always allowed
- friends/close/work allowed only if author has membership in that side (self_memberships sets)

In real app:
- membership comes from user profile / org membership / trust levels.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .store import PostStore
from .models_stub import SideId


def can_post(side: SideId, *, author_id: str, self_memberships: dict) -> bool:
    if side == "public":
        return True
    # memberships are sets of side ids the user is allowed to use
    allowed = set(self_memberships.get(author_id) or set())
    return side in allowed


def create_post(
    store: PostStore,
    *,
    author_id: str,
    side: SideId,
    text: str,
    set_id: Optional[str] = None,
    urgent: bool = False,
    client_key: Optional[str] = None,
) -> Dict[str, Any]:
    t = (text or "").strip()
    if not t:
        return {"ok": False, "status": 400, "error": "empty_text"}

    # v0 memberships (mock)
    memberships = {
        # author_id -> allowed sides (besides public)
        author_id: {"friends", "close", "work"},
    }

    if not can_post(side, author_id=author_id, self_memberships=memberships):
        return {"ok": False, "status": 403, "error": "forbidden_side"}

    rec = store.create(
        author_id=author_id,
        side=side,
        text=t,
        set_id=set_id,
        urgent=bool(urgent),
        client_key=client_key,
    )

    return {
        "ok": True,
        "status": 201,
        "post": {
            "id": rec.id,
            "author_id": rec.author_id,
            "side": rec.side,
            "text": rec.text,
            "set_id": rec.set_id,
            "urgent": rec.urgent,
            "client_key": rec.client_key,
            "created_at": rec.created_at,
        },
    }
