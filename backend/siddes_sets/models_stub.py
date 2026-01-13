"""Set model stub (framework-agnostic).

Siddes terminology:
- Side: Public / Friends / Close / Work
- Set: a "room" inside a Side (viewer/owner curated)

In real Django this becomes (rough sketch):
- Set (id uuid, owner FK, side, label, color, created_at, updated_at)
- SetMember (set FK, member_user FK OR member_handle string)
- SetEvent (audit log): set FK, kind, ts, actor, payload JSON

This file deliberately keeps the model tiny + explicit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional


SideId = Literal["public", "friends", "close", "work"]
SetColor = Literal["orange", "purple", "rose", "slate", "emerald"]


@dataclass
class SetRecord:
    id: str
    owner_id: str
    side: SideId
    label: str
    color: SetColor
    members: List[str]
    created_at: float
    updated_at: float


SetEventKind = Literal["create", "rename", "members_added", "members_removed"]


@dataclass
class SetEventRecord:
    id: str
    set_id: str
    ts: float
    kind: SetEventKind
    actor_id: str
    payload: Dict[str, object]
