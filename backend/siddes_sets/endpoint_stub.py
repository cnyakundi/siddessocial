"""Sets endpoints (framework-agnostic stubs).

This file defines the *rules* and a simple JSON-friendly response shape.

Ownership rule (non-negotiable):
- Only the owner can view/modify their sets.

Side inheritance rule:
- A Set always belongs to one Side. Posts created "inside" a Set inherit the Side.

History rule:
- Each mutation creates a SetEvent record.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .models_stub import SideId, SetColor
from .store import SetsStore


def list_sets(store: SetsStore, *, owner_id: str, side: Optional[SideId] = None) -> Dict[str, Any]:
    items = store.list(owner_id=owner_id, side=side)
    return {
        "ok": True,
        "status": 200,
        "sets": [
            {
                "id": s.id,
                "owner_id": s.owner_id,
                "side": s.side,
                "label": s.label,
                "color": s.color,
                "members": list(s.members),
                "count": len(s.members),
                "updated_at": s.updated_at,
            }
            for s in items
        ],
    }


def create_set(
    store: SetsStore,
    *,
    owner_id: str,
    side: SideId,
    label: str,
    members: Optional[List[str]] = None,
    color: SetColor = "orange",
) -> Dict[str, Any]:
    name = (label or "").strip()
    if not name:
        return {"ok": False, "status": 400, "error": "empty_label"}

    rec = store.create(owner_id=owner_id, side=side, label=name, color=color, members=members or [])
    return {
        "ok": True,
        "status": 201,
        "set": {
            "id": rec.id,
            "owner_id": rec.owner_id,
            "side": rec.side,
            "label": rec.label,
            "color": rec.color,
            "members": list(rec.members),
            "count": len(rec.members),
            "updated_at": rec.updated_at,
        },
    }


def rename_set(store: SetsStore, *, owner_id: str, set_id: str, label: str) -> Dict[str, Any]:
    name = (label or "").strip()
    if not name:
        return {"ok": False, "status": 400, "error": "empty_label"}

    rec = store.rename(owner_id=owner_id, set_id=set_id, label=name)
    if not rec:
        return {"ok": False, "status": 404, "error": "not_found"}

    return {"ok": True, "status": 200, "set": {"id": rec.id, "label": rec.label, "updated_at": rec.updated_at}}


def add_members(store: SetsStore, *, owner_id: str, set_id: str, members: List[str]) -> Dict[str, Any]:
    rec = store.add_members(owner_id=owner_id, set_id=set_id, members=members)
    if not rec:
        return {"ok": False, "status": 404, "error": "not_found"}
    return {"ok": True, "status": 200, "count": len(rec.members), "members": list(rec.members)}


def remove_members(store: SetsStore, *, owner_id: str, set_id: str, members: List[str]) -> Dict[str, Any]:
    rec = store.remove_members(owner_id=owner_id, set_id=set_id, members=members)
    if not rec:
        return {"ok": False, "status": 404, "error": "not_found"}
    return {"ok": True, "status": 200, "count": len(rec.members), "members": list(rec.members)}


def list_events(store: SetsStore, *, owner_id: str, set_id: str) -> Dict[str, Any]:
    evs = store.events(owner_id=owner_id, set_id=set_id)
    return {
        "ok": True,
        "status": 200,
        "events": [
            {
                "id": e.id,
                "set_id": e.set_id,
                "ts": e.ts,
                "kind": e.kind,
                "actor_id": e.actor_id,
                "payload": e.payload,
            }
            for e in evs
        ],
    }
