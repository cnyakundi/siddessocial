"""DB-backed Sets store (Django ORM).

This store speaks the same *JSON shapes* as the Next.js Sets API stubs.

Why this exists:
- The frontend can flip to Django via `NEXT_PUBLIC_API_BASE`.
- Endpoints remain default-safe and owner-private.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.db import models, transaction

from .models import SiddesSet, SiddesSetEvent, SideId, SetColor, SetEventKind


VALID_SIDES = {"public", "friends", "close", "work"}
VALID_COLORS = {"orange", "purple", "blue", "emerald", "rose", "slate"}


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}_{now_ms()}_{uuid.uuid4().hex[:8]}"


def slugify(s: str) -> str:
    return (
        str(s or "")
        .lower()
        .strip()
        .replace("'", "")
        .replace('"', "")
        .replace("/", "-")
        .replace("\\", "-")
    )


def clean_side(raw: Any) -> str:
    v = str(raw or "").strip().lower()
    return v if v in VALID_SIDES else "friends"


def clean_color(raw: Any) -> str:
    v = str(raw or "").strip().lower()
    return v if v in VALID_COLORS else "emerald"


def clean_members(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        return []
    out: List[str] = []
    for m in raw:
        s = str(m).strip()
        if not s:
            continue
        out.append(s)
    return out


def set_to_item(s: SiddesSet) -> Dict[str, Any]:
    members = s.members if isinstance(s.members, list) else []
    members = [str(m) for m in members if isinstance(m, (str, int, float))]
    return {
        "id": s.id,
        "side": str(s.side),
        "label": str(s.label),
        "color": str(s.color),
        "members": members,
        "count": int(s.count or 0),
    }


def event_to_item(e: SiddesSetEvent) -> Dict[str, Any]:
    data = e.data if isinstance(e.data, dict) else {}
    out: Dict[str, Any] = {
        "id": e.id,
        "setId": e.set_id,
        "kind": str(e.kind),
        "ts": int(e.ts_ms),
        "by": str(e.by),
    }
    if data:
        out["data"] = data
    return out


class DbSetsStore:
    """Database-backed Sets store with a small deterministic seed."""

    def _is_seed_owner(self, owner_id: str) -> bool:
        """Only seed for the canonical dev owner.

        Without this, any arbitrary viewer string (e.g. "@jordan") would
        get seeded Sets the first time they hit the list endpoint, which makes
        invite-based membership testing confusing.
        """

        v = str(owner_id or "").strip().lower()
        return v == "me" or v.startswith("me_")

    def ensure_seed(self, owner_id: str) -> None:
        """Seed a couple of Sets for a new owner (dev friendliness).

        We only seed when the owner has zero sets.
        """

        if not owner_id:
            return

        # Only seed for the canonical owner.
        if not self._is_seed_owner(owner_id):
            return

        if SiddesSet.objects.filter(owner_id=owner_id).exists():
            return

        t = now_ms()

        with transaction.atomic():
            # Create a couple of deterministic defaults.
            defaults: List[Tuple[str, str, str, List[str]]] = [
                ("gym", "friends", "Gym Squad", ["@marc_us", "@sara_j"]),
                ("weekend", "friends", "Weekend Crew", ["@marc_us", "@elena"]),
            ]

            for set_id, side, label, members in defaults:
                # Avoid collisions if something created one of these ids earlier.
                sid = set_id
                if SiddesSet.objects.filter(id=sid).exists():
                    sid = f"{set_id}-{uuid.uuid4().hex[:4]}"

                s = SiddesSet.objects.create(
                    id=sid,
                    owner_id=owner_id,
                    side=side,
                    label=label,
                    color=clean_color(label),
                    members=members,
                    count=0,
                )

                SiddesSetEvent.objects.create(
                    id=new_id("se"),
                    set=s,
                    ts_ms=t,
                    kind=SetEventKind.CREATED,
                    by=owner_id,
                    data={"label": label, "side": side},
                )

    def list(self, *, owner_id: str, side: Optional[str] = None) -> List[Dict[str, Any]]:
        """List Sets visible to the viewer.

        Visibility rule (stub v0):
        - The owner can see their own sets.
        - Any viewer can see sets where they are explicitly listed as a member.

        Writes (create/update) remain owner-only and are enforced in views.
        """

        viewer_id = str(owner_id or "").strip()
        if not viewer_id:
            return []

        # Seed only for the canonical owner.
        self.ensure_seed(viewer_id)

        try:
            qs = SiddesSet.objects.filter(models.Q(owner_id=viewer_id) | models.Q(members__contains=[viewer_id]))
            if side and side in VALID_SIDES:
                qs = qs.filter(side=side)
            qs = qs.order_by("-updated_at")
            return [set_to_item(s) for s in qs]
        except Exception:
            # Backend compatibility fallback (dev only): do a python filter.
            own = list(SiddesSet.objects.filter(owner_id=viewer_id))
            extra: List[SiddesSet] = []
            for s in SiddesSet.objects.all():
                if s.owner_id == viewer_id:
                    continue
                members = s.members if isinstance(s.members, list) else []
                mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}
                if viewer_id in mem:
                    extra.append(s)

            all_visible = own + extra
            if side and side in VALID_SIDES:
                all_visible = [s for s in all_visible if str(s.side) == side]
            all_visible.sort(key=lambda s: s.updated_at, reverse=True)
            return [set_to_item(s) for s in all_visible]

    def get(self, *, owner_id: str, set_id: str) -> Optional[Dict[str, Any]]:
        viewer_id = str(owner_id or "").strip()
        if not viewer_id or not set_id:
            return None

        self.ensure_seed(viewer_id)

        try:
            s = SiddesSet.objects.get(id=set_id)
        except SiddesSet.DoesNotExist:
            return None

        members = s.members if isinstance(s.members, list) else []
        mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}

        if s.owner_id != viewer_id and viewer_id not in mem:
            return None

        return set_to_item(s)

    def create(self, *, owner_id: str, side: str, label: str, members: List[str], color: Optional[str] = None) -> Dict[str, Any]:
        t = now_ms()
        side = clean_side(side)
        label = str(label or "Untitled")
        members = clean_members(members)
        color_v = clean_color(color or label)

        base = slugify(label) or "set"
        sid = f"{base}-{uuid.uuid4().hex[:6]}"

        with transaction.atomic():
            s = SiddesSet.objects.create(
                id=sid,
                owner_id=owner_id,
                side=side,
                label=label,
                color=color_v,
                members=members,
                count=0,
            )

            SiddesSetEvent.objects.create(
                id=new_id("se"),
                set=s,
                ts_ms=t,
                kind=SetEventKind.CREATED,
                by=owner_id,
                data={"label": label, "side": side},
            )

        return set_to_item(s)

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
        if not set_id:
            return None

        try:
            s = SiddesSet.objects.get(id=set_id, owner_id=owner_id)
        except SiddesSet.DoesNotExist:
            return None

        t = now_ms()
        events: List[SiddesSetEvent] = []

        with transaction.atomic():
            # Label
            if isinstance(patch.get("label"), str) and patch.get("label", "").strip() and patch["label"] != s.label:
                prev = s.label
                s.label = patch["label"]
                events.append(
                    SiddesSetEvent(
                        id=new_id("se"),
                        set=s,
                        ts_ms=t,
                        kind=SetEventKind.RENAMED,
                        by=owner_id,
                        data={"from": prev, "to": s.label},
                    )
                )

            # Members
            if "members" in patch and isinstance(patch.get("members"), list):
                prev = s.members if isinstance(s.members, list) else []
                nxt = clean_members(patch.get("members"))
                if prev != nxt:
                    s.members = nxt
                    events.append(
                        SiddesSetEvent(
                            id=new_id("se"),
                            set=s,
                            ts_ms=t,
                            kind=SetEventKind.MEMBERS_UPDATED,
                            by=owner_id,
                            data={"from": prev, "to": nxt},
                        )
                    )

            # Side
            if isinstance(patch.get("side"), str):
                nxt_side = clean_side(patch.get("side"))
                if nxt_side != s.side:
                    prev = s.side
                    s.side = nxt_side
                    events.append(
                        SiddesSetEvent(
                            id=new_id("se"),
                            set=s,
                            ts_ms=t,
                            kind=SetEventKind.MOVED_SIDE,
                            by=owner_id,
                            data={"from": prev, "to": nxt_side},
                        )
                    )

            # Color
            if isinstance(patch.get("color"), str) and patch.get("color", "").strip():
                nxt_color = clean_color(patch.get("color"))
                if nxt_color != s.color:
                    prev = s.color
                    s.color = nxt_color
                    events.append(
                        SiddesSetEvent(
                            id=new_id("se"),
                            set=s,
                            ts_ms=t,
                            kind=SetEventKind.RECOLORED,
                            by=owner_id,
                            data={"from": prev, "to": nxt_color},
                        )
                    )

            s.save()

            if events:
                SiddesSetEvent.objects.bulk_create(events)

        return set_to_item(s)

    def events(self, *, owner_id: str, set_id: str) -> List[Dict[str, Any]]:
        viewer_id = str(owner_id or "").strip()
        if not viewer_id or not set_id:
            return []

        self.ensure_seed(viewer_id)

        try:
            s = SiddesSet.objects.get(id=set_id)
        except SiddesSet.DoesNotExist:
            return []

        members = s.members if isinstance(s.members, list) else []
        mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}
        if s.owner_id != viewer_id and viewer_id not in mem:
            return []

        qs = SiddesSetEvent.objects.filter(set=s).order_by("-ts_ms")
        return [event_to_item(e) for e in qs]
