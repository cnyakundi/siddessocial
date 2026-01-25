"""DB-backed Set Invite Links store (Django ORM).

Feature:
- Set owners can mint shareable links: /i/<token>
- Anyone can open the link to see a landing page (public GET).
- Authenticated users can accept and auto-join the Set (server-truth).
"""

from __future__ import annotations

import time
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone

from siddes_backend.identity import display_for_token, viewer_aliases

from siddes_sets.models import SetEventKind, SiddesSet, SiddesSetEvent

from .models import SiddesInviteLink, VALID_SIDES


MAX_MAX_USES = 200


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}_{now_ms()}_{uuid.uuid4().hex[:8]}"


def new_token() -> str:
    # short, unguessable, URL-safe
    return "il_" + uuid.uuid4().hex


def clean_side(raw: Any) -> str:
    v = str(raw or "").strip().lower()
    return v if v in VALID_SIDES else "friends"


def clean_max_uses(raw: Any) -> int:
    try:
        v = int(raw)
    except Exception:
        v = 10
    v = max(1, min(MAX_MAX_USES, v))
    return v


def clean_expires_days(raw: Any) -> int:
    try:
        v = int(raw)
    except Exception:
        v = 0
    return max(0, min(365, v))


def _status_for(link: SiddesInviteLink) -> str:
    now = timezone.now()
    if link.revoked_at is not None:
        return "revoked"
    if link.expires_at is not None and link.expires_at <= now:
        return "expired"
    if int(link.uses or 0) >= int(link.max_uses or 0):
        return "used_up"
    return "active"


def link_to_item(link: SiddesInviteLink, *, include_owner: bool = False) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "token": str(link.token),
        "setId": str(link.set_id),
        "setLabel": str(getattr(link, "set_label", "") or ""),
        "side": str(getattr(link, "side", "") or "friends"),
        "maxUses": int(getattr(link, "max_uses", 0) or 0),
        "uses": int(getattr(link, "uses", 0) or 0),
        "expiresAt": int(link.expires_at.timestamp() * 1000) if link.expires_at else None,
        "revokedAt": int(link.revoked_at.timestamp() * 1000) if link.revoked_at else None,
        "createdAt": int(link.created_at.timestamp() * 1000),
        "updatedAt": int(link.updated_at.timestamp() * 1000),
        "status": _status_for(link),
    }
    if include_owner:
        out["owner"] = display_for_token(str(link.owner_id))
    return out


def _preferred_member_id(viewer_id: str) -> str:
    # Prefer @handle for membership checks.
    aliases = viewer_aliases(viewer_id)
    handles = [a for a in aliases if isinstance(a, str) and a.startswith("@")]
    if handles:
        return sorted(handles)[0]
    return str(viewer_id)


class DbInviteLinksStore:
    def list_for_set(self, *, owner_id: str, set_id: str) -> List[Dict[str, Any]]:
        if not owner_id or not set_id:
            return []
        qs = SiddesInviteLink.objects.filter(owner_id=owner_id, set_id=set_id).order_by("-updated_at")
        return [link_to_item(l) for l in qs]

    def create_for_set(self, *, owner_id: str, set_id: str, max_uses: Any, expires_days: Any) -> Optional[Dict[str, Any]]:
        if not owner_id or not set_id:
            return None

        # Ensure Set exists and belongs to owner (default-safe).
        try:
            s = SiddesSet.objects.get(id=set_id, owner_id=owner_id)
        except SiddesSet.DoesNotExist:
            return None

        max_uses_v = clean_max_uses(max_uses)
        expires_days_v = clean_expires_days(expires_days)

        exp = None
        if expires_days_v > 0:
            exp = timezone.now() + timedelta(days=expires_days_v)

        link = SiddesInviteLink.objects.create(
            token=new_token(),
            owner_id=owner_id,
            set_id=set_id,
            set_label=str(getattr(s, "label", "") or "")[:255],
            side=clean_side(getattr(s, "side", "") or "friends"),
            max_uses=max_uses_v,
            uses=0,
            expires_at=exp,
            revoked_at=None,
        )
        return link_to_item(link)

    def revoke(self, *, owner_id: str, set_id: str, token: str) -> Optional[Dict[str, Any]]:
        if not owner_id or not set_id or not token:
            return None
        try:
            link = SiddesInviteLink.objects.get(token=token, owner_id=owner_id, set_id=set_id)
        except SiddesInviteLink.DoesNotExist:
            return None

        if link.revoked_at is None:
            link.revoked_at = timezone.now()
            link.save(update_fields=["revoked_at", "updated_at"])
        return link_to_item(link)

    def public_get(self, *, token: str) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """Return (valid, item, reason)."""
        tok = str(token or "").strip()
        if not tok:
            return False, None, "bad_request"

        try:
            link = SiddesInviteLink.objects.get(token=tok)
        except SiddesInviteLink.DoesNotExist:
            return False, None, "not_found"

        st = _status_for(link)
        if st != "active":
            return False, link_to_item(link, include_owner=True), st

        return True, link_to_item(link, include_owner=True), "active"

    def accept(self, *, token: str, viewer_id: str) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """Accept an invite link and add viewer to set. Returns (ok, payload, reason)."""

        tok = str(token or "").strip()
        if not tok or not viewer_id:
            return False, None, "bad_request"

        member_id = _preferred_member_id(viewer_id)

        with transaction.atomic():
            try:
                link = SiddesInviteLink.objects.select_for_update().get(token=tok)
            except SiddesInviteLink.DoesNotExist:
                return False, None, "not_found"

            st = _status_for(link)
            if st != "active":
                return False, link_to_item(link, include_owner=True), st

            # Lock the Set row to avoid membership races.
            try:
                s = SiddesSet.objects.select_for_update().get(id=link.set_id, owner_id=link.owner_id)
            except SiddesSet.DoesNotExist:
                return False, link_to_item(link, include_owner=True), "not_found"

            prev = s.members if isinstance(s.members, list) else []
            prev_list = [str(m) for m in prev if isinstance(m, (str, int, float))]
            if member_id in prev_list:
                payload = {"joined": True, "setId": s.id, "setLabel": s.label, "side": str(s.side), "link": link_to_item(link)}
                return True, payload, "already_member"

            # Consume a use
            link.uses = int(link.uses or 0) + 1
            link.save(update_fields=["uses", "updated_at"])

            # Add member
            nxt = list(dict.fromkeys(prev_list + [member_id]))
            s.members = nxt
            s.save(update_fields=["members", "updated_at"])

            # Best-effort: keep membership table in sync
            try:
                from siddes_sets.models import SiddesSetMember  # type: ignore
                SiddesSetMember.objects.get_or_create(set=s, member_id=member_id)
            except Exception:
                pass

            SiddesSetEvent.objects.create(
                id=new_id("se"),
                set=s,
                ts_ms=now_ms(),
                kind=SetEventKind.MEMBERS_UPDATED,
                by=member_id,
                data={"from": prev_list, "to": nxt, "via": "invite_link", "token": link.token},
            )

            payload = {"joined": True, "setId": s.id, "setLabel": s.label, "side": str(s.side), "link": link_to_item(link)}
            return True, payload, "joined"
