"""In-memory Sets store for Django API (dev fallback).

Why this exists:
- When Django is running but migrations haven't been applied yet, we still want
  the `/api/sets/*` endpoints to behave in a default-safe way without throwing
  500s.

This store matches the Next.js stub contract (items/item/events shapes).

Note: This is NOT the long-term persistence layer.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .store_db import VALID_COLORS, VALID_SIDES, clean_color, clean_members, clean_side, now_ms, slugify


ViewerState = Dict[str, Any]


_BY_OWNER: Dict[str, ViewerState] = {}


def _ensure(owner_id: str) -> ViewerState:
    owner = (owner_id or "").strip() or "anon"
    if owner not in _BY_OWNER:
        _BY_OWNER[owner] = {"sets": {}, "events": []}
        _seed(owner)
    return _BY_OWNER[owner]


def _seed(owner_id: str) -> None:
    st = _BY_OWNER.get(owner_id)
    if not st:
        return

    if st["sets"]:
        return

    t = now_ms()
    defaults: List[Tuple[str, str, str, List[str], str]] = [
        ("gym", "friends", "Gym Squad", ["@marc_us", "@sara_j"], "orange"),
        ("weekend", "friends", "Weekend Crew", ["@marc_us", "@elena"], "purple"),
    ]

    for sid, side, label, members, color in defaults:
        st["sets"][sid] = {
            "id": sid,
            "side": side,
            "label": label,
            "color": color,
            "members": members,
            "count": 0,
            "createdAt": t,
            "updatedAt": t,
        }
        st["events"].append(
            {
                "id": f"se_{t}_{uuid.uuid4().hex[:6]}",
                "setId": sid,
                "kind": "created",
                "ts": t,
                "by": owner_id,
                "data": {"label": label, "side": side},
            }
        )


def _touch(st: ViewerState, sid: str) -> None:
    s = st["sets"].get(sid)
    if s:
        s["updatedAt"] = now_ms()


def _new_set_id(label: str) -> str:
    base = slugify(label) or "set"
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _event_id() -> str:
    return f"se_{now_ms()}_{uuid.uuid4().hex[:6]}"


class InMemoryApiSetsStore:
    def list(self, *, owner_id: str, side: Optional[str] = None) -> List[Dict[str, Any]]:
        st = _ensure(owner_id)
        items = list(st["sets"].values())
        if side and side in VALID_SIDES:
            items = [s for s in items if s.get("side") == side]
        items.sort(key=lambda s: int(s.get("updatedAt") or 0), reverse=True)
        return [
            {
                "id": s["id"],
                "side": clean_side(s.get("side")),
                "label": str(s.get("label") or ""),
                "color": clean_color(s.get("color")),
                "members": list(s.get("members") or []),
                "count": int(s.get("count") or 0),
            }
            for s in items
        ]

    def get(self, *, owner_id: str, set_id: str) -> Optional[Dict[str, Any]]:
        st = _ensure(owner_id)
        s = st["sets"].get(set_id)
        if not s:
            return None
        return {
            "id": s["id"],
            "side": clean_side(s.get("side")),
            "label": str(s.get("label") or ""),
            "color": clean_color(s.get("color")),
            "members": list(s.get("members") or []),
            "count": int(s.get("count") or 0),
        }

    def create(self, *, owner_id: str, side: str, label: str, members: List[str], color: Optional[str] = None) -> Dict[str, Any]:
        st = _ensure(owner_id)
        t = now_ms()

        side_v = clean_side(side)
        label_v = str(label or "Untitled")
        members_v = clean_members(members)
        color_v = clean_color(color or label_v)

        sid = _new_set_id(label_v)

        st["sets"][sid] = {
            "id": sid,
            "side": side_v,
            "label": label_v,
            "color": color_v,
            "members": members_v,
            "count": 0,
            "createdAt": t,
            "updatedAt": t,
        }

        st["events"].append(
            {
                "id": _event_id(),
                "setId": sid,
                "kind": "created",
                "ts": t,
                "by": owner_id,
                "data": {"label": label_v, "side": side_v},
            }
        )

        return {
            "id": sid,
            "side": side_v,
            "label": label_v,
            "color": color_v,
            "members": members_v,
            "count": 0,
        }

    def bulk_create(self, *, owner_id: str, inputs: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for i in inputs:
            out.append(
                self.create(
                    owner_id=owner_id,
                    side=clean_side(i.get("side")),
                    label=str(i.get("label") or "Untitled"),
                    members=clean_members(i.get("members")),
                    color=str(i.get("color") or "") or None,
                )
            )
        return out

    def update(self, *, owner_id: str, set_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        st = _ensure(owner_id)
        s = st["sets"].get(set_id)
        if not s:
            return None

        t = now_ms()

        # label
        if isinstance(patch.get("label"), str) and patch.get("label", "").strip() and patch["label"] != s.get("label"):
            prev = s.get("label")
            s["label"] = patch["label"]
            st["events"].append({"id": _event_id(), "setId": set_id, "kind": "renamed", "ts": t, "by": owner_id, "data": {"from": prev, "to": s["label"]}})

        # members
        if "members" in patch and isinstance(patch.get("members"), list):
            prev = list(s.get("members") or [])
            nxt = clean_members(patch.get("members"))
            if prev != nxt:
                s["members"] = nxt
                st["events"].append({"id": _event_id(), "setId": set_id, "kind": "members_updated", "ts": t, "by": owner_id, "data": {"from": prev, "to": nxt}})

        # side
        if isinstance(patch.get("side"), str):
            nxt_side = clean_side(patch.get("side"))
            if nxt_side != s.get("side"):
                prev = s.get("side")
                s["side"] = nxt_side
                st["events"].append({"id": _event_id(), "setId": set_id, "kind": "moved_side", "ts": t, "by": owner_id, "data": {"from": prev, "to": nxt_side}})

        # color
        if isinstance(patch.get("color"), str) and patch.get("color", "").strip():
            nxt_color = clean_color(patch.get("color"))
            if nxt_color != s.get("color"):
                prev = s.get("color")
                s["color"] = nxt_color
                st["events"].append({"id": _event_id(), "setId": set_id, "kind": "recolored", "ts": t, "by": owner_id, "data": {"from": prev, "to": nxt_color}})

        _touch(st, set_id)

        return {
            "id": s["id"],
            "side": clean_side(s.get("side")),
            "label": str(s.get("label") or ""),
            "color": clean_color(s.get("color")),
            "members": list(s.get("members") or []),
            "count": int(s.get("count") or 0),
        }


    def delete(self, *, owner_id: str, set_id: str) -> bool:
        st = _ensure(owner_id)
        if not set_id or set_id not in st["sets"]:
            return False
        # Remove set
        del st["sets"][set_id]
        # Remove events for this set
        st["events"] = [e for e in st["events"] if e.get("setId") != set_id]
        # Add a lightweight deletion event (dev-only)
        st["events"].append({"id": _event_id(), "setId": set_id, "kind": "deleted", "ts": now_ms(), "by": owner_id, "data": {}})
        return True


    def delete(self, *, owner_id: str, set_id: str) -> bool:
        st = _ensure(owner_id)
        if not set_id or set_id not in st["sets"]:
            return False
        # Remove set
        del st["sets"][set_id]
        # Remove events for this set
        st["events"] = [e for e in st["events"] if e.get("setId") != set_id]
        # Add a lightweight deletion event (dev-only)
        st["events"].append({"id": _event_id(), "setId": set_id, "kind": "deleted", "ts": now_ms(), "by": owner_id, "data": {}})
        return True

    def events(self, *, owner_id: str, set_id: str) -> List[Dict[str, Any]]:
        st = _ensure(owner_id)
        if set_id not in st["sets"]:
            return []
        items = [e for e in st["events"] if e.get("setId") == set_id]
        items.sort(key=lambda e: int(e.get("ts") or 0), reverse=True)
        out: List[Dict[str, Any]] = []
        for e in items:
            x: Dict[str, Any] = {
                "id": str(e.get("id")),
                "setId": str(e.get("setId")),
                "kind": str(e.get("kind")),
                "ts": int(e.get("ts")),
                "by": str(e.get("by")) if e.get("by") else owner_id,
            }
            if isinstance(e.get("data"), dict) and e.get("data"):
                x["data"] = e.get("data")
            out.append(x)
        return out
