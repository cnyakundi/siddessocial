"""DB-backed Sets store (Django ORM).

This store speaks the same *JSON shapes* as the Next.js Sets API stubs.

Why this exists:
- The frontend can flip to Django via `NEXT_PUBLIC_API_BASE`.
- Endpoints remain default-safe and owner-private.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.conf import settings
from django.db import models, transaction

from siddes_backend.identity import viewer_aliases

from .models import SiddesSet, SiddesSetEvent, SideId, SetColor, SetEventKind, SiddesSetMember


VALID_SIDES = {"public", "friends", "close", "work"}
VALID_COLORS = {"orange", "purple", "blue", "emerald", "rose", "slate"}

# Safety: cap Set members to avoid abuse (single-table list field).
MAX_SET_MEMBERS = 200


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


def _clean_member_handle(raw: Any) -> Optional[str]:
    s = str(raw or "").strip()
    if not s:
        return None

    if s.startswith("@"):
        body = s[1:].strip().lower()
    else:
        body = s.strip().lower()

    # Basic handle body constraints (no spaces, no '@' in emails).
    if len(body) < 2 or len(body) > 32:
        return None

    for ch in body:
        # allow: a-z, 0-9, underscore, dot, hyphen
        if ch.isalnum():
            continue
        if ch in "_-.":
            continue
        return None

    return "@" + body


def clean_members(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        return []
    out: List[str] = []
    seen: set[str] = set()
    for m in raw:
        h = _clean_member_handle(m)
        if not h:
            continue
        if h in seen:
            continue
        seen.add(h)
        out.append(h)
        if len(out) >= MAX_SET_MEMBERS:
            break
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


# sd_366: Normalize Set membership into a join-friendly table.
# We keep SiddesSet.members (JSON) for payload parity, but rely on SetMember for indexed lookups.

def sync_memberships(*, set_id: str, members: List[str]) -> None:
    """Best-effort: ensure SiddesSetMember rows match `members`.

    Safe before migrations are applied: if table doesn't exist yet, we fail silently.
    """

    sid = str(set_id or '').strip()
    if not sid:
        return

    try:
        members_v = clean_members(members)
        SiddesSetMember.objects.filter(set_id=sid).exclude(member_id__in=members_v).delete()
        existing = set(SiddesSetMember.objects.filter(set_id=sid).values_list('member_id', flat=True))
        missing = [m for m in members_v if m not in existing]
        if missing:
            SiddesSetMember.objects.bulk_create(
                [SiddesSetMember(set_id=sid, member_id=m) for m in missing],
                ignore_conflicts=True,
            )
    except Exception:
        return



class DbSetsStore:
    """Database-backed Sets store with an optional dev seed."""

    def _is_seed_owner(self, owner_id: str) -> bool:
        """Only seed for the canonical dev owner.

        Without this, any arbitrary viewer string (e.g. "@jordan") would
        get seeded Sets the first time they hit the list endpoint, which makes
        invite-based membership testing confusing.
        """

        v = str(owner_id or "").strip().lower()
        return v == "me" or v.startswith("me_")

    def ensure_seed(self, owner_id: str) -> None:
        """Seed a couple of Sets for a new owner (dev-only).

        World-safe rule:
        - Never seed when DEBUG=False.
        - Never seed unless SIDDES_SEED_DEFAULT_SETS=1 (explicit opt-in).
        """

        if not owner_id:
            return

        # Production hardening: never seed outside DEBUG.
        try:
            from django.conf import settings  # type: ignore
            import os
            if not getattr(settings, "DEBUG", False):
                return
            if str(os.environ.get("SIDDES_SEED_DEFAULT_SETS", "")).strip() != "1":
                return
        except Exception:
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

                sync_memberships(set_id=s.id, members=members)

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

        # Seed only for the canonical owner, and only when explicitly enabled.
        self.ensure_seed(viewer_id)

        aliases = viewer_aliases(viewer_id)

        try:
            aliases_list = list(aliases) if isinstance(aliases, (set, list, tuple)) else [viewer_id]
            q = models.Q(owner_id__in=aliases_list)

            # sd_366: membership table (fast) with JSON fallback (pre-migration safety).
            try:
                member_set_ids = SiddesSetMember.objects.filter(member_id__in=aliases_list).values_list("set_id", flat=True)
                q |= models.Q(id__in=member_set_ids)
            except Exception:
                for a in aliases_list:
                    q |= models.Q(members__contains=[a])

            qs = SiddesSet.objects.filter(q).distinct()
            if side and side in VALID_SIDES:
                qs = qs.filter(side=side)
            qs = qs.order_by("-updated_at")
            return [set_to_item(s) for s in qs]
        except Exception:
            # Backend compatibility fallback (dev only): do a python filter.
            aliases_list = list(aliases) if isinstance(aliases, (set, list, tuple)) else [viewer_id]
            own = list(SiddesSet.objects.filter(owner_id__in=aliases_list))
            extra: List[SiddesSet] = []
            for s in SiddesSet.objects.all():
                if s.owner_id in aliases:
                    continue
                members = s.members if isinstance(s.members, list) else []
                mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}
                if mem.intersection(set(aliases)):
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

        aliases = viewer_aliases(viewer_id)

        try:
            s = SiddesSet.objects.get(id=set_id)
        except SiddesSet.DoesNotExist:
            return None

        if s.owner_id in aliases:
            return set_to_item(s)

        # sd_366: membership table check (fast) + JSON fallback
        try:
            if SiddesSetMember.objects.filter(set_id=set_id, member_id__in=list(aliases)).exists():
                return set_to_item(s)
        except Exception:
            members = s.members if isinstance(s.members, list) else []
            mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}
            if mem.intersection(aliases):
                return set_to_item(s)

        return None

    def create(
        self,
        *,
        owner_id: str,
        side: str,
        label: str,
        members: List[str],
        color: Optional[str] = None,
    ) -> Dict[str, Any]:
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

            sync_memberships(set_id=s.id, members=members)

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


    def delete(self, *, owner_id: str, set_id: str) -> bool:
        if not set_id:
            return False
        try:
            s = SiddesSet.objects.get(id=set_id, owner_id=owner_id)
        except SiddesSet.DoesNotExist:
            return False
        # Cascades to events.
        s.delete()
        return True


    def delete(self, *, owner_id: str, set_id: str) -> bool:
        if not set_id:
            return False
        try:
            s = SiddesSet.objects.get(id=set_id, owner_id=owner_id)
        except SiddesSet.DoesNotExist:
            return False
        # Cascades to events.
        s.delete()
        return True

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

            # sd_366: Keep membership table in sync with JSON members.
            try:
                if any(getattr(e, "kind", "") == SetEventKind.MEMBERS_UPDATED for e in events):
                    cur = s.members if isinstance(s.members, list) else []
                    sync_memberships(set_id=s.id, members=cur)
            except Exception:
                pass

            if events:
                SiddesSetEvent.objects.bulk_create(events)

        return set_to_item(s)

    def events(self, *, owner_id: str, set_id: str) -> List[Dict[str, Any]]:
        viewer_id = str(owner_id or "").strip()
        if not viewer_id or not set_id:
            return []

        self.ensure_seed(viewer_id)

        aliases = viewer_aliases(viewer_id)

        try:
            s = SiddesSet.objects.get(id=set_id)
        except SiddesSet.DoesNotExist:
            return []

        if s.owner_id not in aliases:
            ok = False
            # sd_366: membership table check (fast) + JSON fallback
            try:
                ok = SiddesSetMember.objects.filter(set_id=set_id, member_id__in=list(aliases)).exists()
            except Exception:
                members = s.members if isinstance(s.members, list) else []
                mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}
                ok = bool(mem.intersection(aliases))

            if not ok:
                return []

        qs = SiddesSetEvent.objects.filter(set=s).order_by("-ts_ms")
        return [event_to_item(e) for e in qs]
