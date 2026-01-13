"""In-memory Sets store (dev/demo).

This is not the final persistence layer.
The goal is to lock down the *contract* + *rules* early:
- Sets are owned (no cross-user writes)
- Sets belong to a Side (inherit meaning)
- A small audit log exists (history)

In Django, this will be backed by ORM models.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import replace
from typing import Dict, List, Optional

from .models_stub import SetRecord, SetEventRecord, SetEventKind, SideId, SetColor


class SetsStore:
    def __init__(self) -> None:
        self._sets: Dict[str, SetRecord] = {}
        self._events: Dict[str, List[SetEventRecord]] = {}

    def _new_id(self, prefix: str) -> str:
        return f"{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}"

    def _log(self, *, set_id: str, kind: SetEventKind, actor_id: str, payload: Optional[dict] = None) -> None:
        ev = SetEventRecord(
            id=self._new_id("sev"),
            set_id=set_id,
            ts=time.time(),
            kind=kind,
            actor_id=actor_id,
            payload=payload or {},
        )
        self._events.setdefault(set_id, []).append(ev)

    def create(
        self,
        *,
        owner_id: str,
        side: SideId,
        label: str,
        color: SetColor = "orange",
        members: Optional[List[str]] = None,
    ) -> SetRecord:
        now = time.time()
        set_id = self._new_id("set")
        rec = SetRecord(
            id=set_id,
            owner_id=owner_id,
            side=side,
            label=label,
            color=color,
            members=sorted(list({*(members or [])})),
            created_at=now,
            updated_at=now,
        )
        self._sets[set_id] = rec
        self._events[set_id] = []
        self._log(set_id=set_id, kind="create", actor_id=owner_id, payload={"label": label, "side": side})
        return rec

    def get(self, set_id: str) -> Optional[SetRecord]:
        return self._sets.get(set_id)

    def list(self, *, owner_id: str, side: Optional[SideId] = None) -> List[SetRecord]:
        out = [s for s in self._sets.values() if s.owner_id == owner_id]
        if side:
            out = [s for s in out if s.side == side]
        return sorted(out, key=lambda s: s.updated_at, reverse=True)

    def rename(self, *, owner_id: str, set_id: str, label: str) -> Optional[SetRecord]:
        cur = self._sets.get(set_id)
        if not cur or cur.owner_id != owner_id:
            return None
        now = time.time()
        nxt = replace(cur, label=label, updated_at=now)
        self._sets[set_id] = nxt
        self._log(set_id=set_id, kind="rename", actor_id=owner_id, payload={"label": label})
        return nxt

    def add_members(self, *, owner_id: str, set_id: str, members: List[str]) -> Optional[SetRecord]:
        cur = self._sets.get(set_id)
        if not cur or cur.owner_id != owner_id:
            return None
        add = [m for m in members if isinstance(m, str) and m]
        merged = sorted(list(set(cur.members).union(add)))
        now = time.time()
        nxt = replace(cur, members=merged, updated_at=now)
        self._sets[set_id] = nxt
        if add:
            self._log(set_id=set_id, kind="members_added", actor_id=owner_id, payload={"members": add})
        return nxt

    def remove_members(self, *, owner_id: str, set_id: str, members: List[str]) -> Optional[SetRecord]:
        cur = self._sets.get(set_id)
        if not cur or cur.owner_id != owner_id:
            return None
        rm = set([m for m in members if isinstance(m, str) and m])
        kept = [m for m in cur.members if m not in rm]
        now = time.time()
        nxt = replace(cur, members=kept, updated_at=now)
        self._sets[set_id] = nxt
        if rm:
            self._log(set_id=set_id, kind="members_removed", actor_id=owner_id, payload={"members": sorted(list(rm))})
        return nxt

    def events(self, *, owner_id: str, set_id: str) -> List[SetEventRecord]:
        cur = self._sets.get(set_id)
        if not cur or cur.owner_id != owner_id:
            return []
        return list(self._events.get(set_id) or [])

    def total(self) -> int:
        return len(self._sets)
