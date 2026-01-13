"""DB-backed Invites store (Django ORM).

JSON shapes are designed to be easy for the Next.js UI stubs to consume.

Endpoints are default-safe:
- Unknown viewer => restricted.
- A viewer can only see invites where they are either the sender or the recipient.

Acceptance behaviour (DEV stub):
- When the recipient accepts an invite, we add the recipient handle to the Set's
  members list (owned by the sender) and emit a Sets history event.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional

from django.db import transaction

from siddes_sets.models import SetEventKind, SiddesSet, SiddesSetEvent

from .models import SiddesInvite, VALID_SIDES, VALID_STATUSES


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}_{now_ms()}_{uuid.uuid4().hex[:8]}"


def clean_side(raw: Any) -> str:
    v = str(raw or "").strip().lower()
    return v if v in VALID_SIDES else "friends"


def clean_status(raw: Any) -> str:
    v = str(raw or "").strip().lower()
    return v if v in VALID_STATUSES else "pending"


def invite_to_item(inv: SiddesInvite) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": inv.id,
        "setId": str(inv.set_id),
        # sd_141c: snapshot Set label at invite creation time.
        **({"setLabel": str(inv.set_label)} if getattr(inv, "set_label", "") else {}),
        "side": str(inv.side),
        "from": str(inv.from_id),
        "to": str(inv.to_id),
        "status": str(inv.status),
        "message": str(inv.message or ""),
        "createdAt": int(inv.created_at.timestamp() * 1000),
        "updatedAt": int(inv.updated_at.timestamp() * 1000),
    }
    return out


class DbInvitesStore:
    # Backwards-compatible method names used by views.py
    def list(self, *, viewer_id: str, direction: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.list_for_viewer(viewer_id=viewer_id, direction=direction)

    def get(self, *, viewer_id: str, invite_id: str) -> Optional[Dict[str, Any]]:
        return self.get_for_viewer(viewer_id=viewer_id, invite_id=invite_id)

    def apply_action(self, *, viewer_id: str, invite_id: str, action: str) -> Optional[Dict[str, Any]]:
        out = self.transition(viewer_id=viewer_id, invite_id=invite_id, action=action)
        if out is not None:
            return out

        # If the invite exists but the viewer isn't authorized for this action, mark as forbidden
        try:
            inv = SiddesInvite.objects.get(id=invite_id)
        except SiddesInvite.DoesNotExist:
            return None

        act = str(action or "").strip().lower()
        if act in ("accept", "reject") and inv.to_id != viewer_id:
            return {"_forbidden": True}
        if act == "revoke" and inv.from_id != viewer_id:
            return {"_forbidden": True}
        return None

    def list_for_viewer(self, *, viewer_id: str, direction: Optional[str] = None) -> List[Dict[str, Any]]:
        if not viewer_id:
            return []

        qs = SiddesInvite.objects.all()
        d = str(direction or "").strip().lower()
        if d == "incoming":
            qs = qs.filter(to_id=viewer_id)
        elif d == "outgoing":
            qs = qs.filter(from_id=viewer_id)
        else:
            qs = qs.filter(models.Q(to_id=viewer_id) | models.Q(from_id=viewer_id))

        qs = qs.order_by("-updated_at")
        return [invite_to_item(i) for i in qs]

    def get_for_viewer(self, *, viewer_id: str, invite_id: str) -> Optional[Dict[str, Any]]:
        if not viewer_id or not invite_id:
            return None
        try:
            inv = SiddesInvite.objects.get(id=invite_id)
        except SiddesInvite.DoesNotExist:
            return None
        if inv.to_id != viewer_id and inv.from_id != viewer_id:
            return None
        return invite_to_item(inv)

    def create(
        self,
        *,
        from_id: str,
        to_id: str,
        set_id: str,
        side: Any,
        message: str = "",
    ) -> Dict[str, Any]:
        side_v = clean_side(side)
        msg = str(message or "")[:280]

        set_label = ""
        s: Optional[SiddesSet] = None

        # Ensure the Set exists and is owned by the sender (default-safe).
        try:
            s = SiddesSet.objects.get(id=set_id, owner_id=from_id)
            set_label = str(getattr(s, "label", "") or "")[:255]
        except SiddesSet.DoesNotExist:
            # Still create an invite, but mark it as revoked immediately to avoid weird UI crashes.
            inv = SiddesInvite.objects.create(
                id=new_id("inv"),
                from_id=from_id,
                to_id=to_id,
                set_id=set_id,
                set_label=set_label,
                side=side_v,
                status="revoked",
                message=msg,
            )
            return invite_to_item(inv)

        inv = SiddesInvite.objects.create(
            id=new_id("inv"),
            from_id=from_id,
            to_id=to_id,
            set_id=set_id,
            set_label=set_label,
            side=side_v,
            status="pending",
            message=msg,
        )
        return invite_to_item(inv)

    def transition(self, *, viewer_id: str, invite_id: str, action: str) -> Optional[Dict[str, Any]]:
        """Transition an invite by action: accept|reject|revoke."""

        if not viewer_id or not invite_id:
            return None

        act = str(action or "").strip().lower()
        if act not in ("accept", "reject", "revoke"):
            return None

        try:
            inv = SiddesInvite.objects.select_for_update().get(id=invite_id)
        except SiddesInvite.DoesNotExist:
            return None

        # Authorization:
        # - accept/reject only by recipient
        # - revoke only by sender
        if act in ("accept", "reject") and inv.to_id != viewer_id:
            return None
        if act == "revoke" and inv.from_id != viewer_id:
            return None

        with transaction.atomic():
            inv = SiddesInvite.objects.select_for_update().get(id=invite_id)

            # Idempotency-ish: if already terminal, just return.
            if inv.status in ("accepted", "rejected", "revoked"):
                return invite_to_item(inv)

            if act == "accept":
                inv.status = "accepted"
                inv.save(update_fields=["status", "updated_at"])

                # Best-effort: add recipient to Set members and emit a Sets event.
                try:
                    s = SiddesSet.objects.select_for_update().get(id=inv.set_id, owner_id=inv.from_id)
                except SiddesSet.DoesNotExist:
                    return invite_to_item(inv)

                prev = s.members if isinstance(s.members, list) else []
                prev_list = [str(m) for m in prev if isinstance(m, (str, int, float))]
                nxt = list(dict.fromkeys(prev_list + [inv.to_id]))
                if nxt != prev_list:
                    s.members = nxt
                    s.save(update_fields=["members", "updated_at"])
                    SiddesSetEvent.objects.create(
                        id=new_id("se"),
                        set=s,
                        ts_ms=now_ms(),
                        kind=SetEventKind.MEMBERS_UPDATED,
                        by=inv.to_id,
                        data={"from": prev_list, "to": nxt, "via": "invite", "inviteId": inv.id},
                    )

                return invite_to_item(inv)

            if act == "reject":
                inv.status = "rejected"
                inv.save(update_fields=["status", "updated_at"])
                return invite_to_item(inv)

            # revoke
            inv.status = "revoked"
            inv.save(update_fields=["status", "updated_at"])
            return invite_to_item(inv)


# Local import to avoid polluting module namespace with Django unless used.
from django.db import models  # noqa: E402
