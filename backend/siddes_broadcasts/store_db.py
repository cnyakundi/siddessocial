from __future__ import annotations

STARTER_BROADCASTS = [
    {"name": "Nairobi Traffic", "handle": "@nairobi_traffic", "category": "Utility", "desc": "Real-time road updates. Calm, verified, high-signal."},
    {"name": "Kenya Markets", "handle": "@ke_markets", "category": "Business", "desc": "Rates, MMF notes, fuel, food prices - explained simply."},
    {"name": "Tech Weekly KE", "handle": "@tech_weekly_ke", "category": "Tech", "desc": "Curated Silicon Savannah news. No hype."},
    {"name": "Weekend Plans KE", "handle": "@weekend_ke", "category": "Lifestyle", "desc": "Gigs, events, chill spots - high signal only."},
    {"name": "Public Service Watch", "handle": "@psc_watch", "category": "News", "desc": "State corp moves, notices, accountability - sourced."},
    {"name": "Sports Pulse KE", "handle": "@sports_ke", "category": "Sports", "desc": "Fixtures + headlines. Minimal noise."},
]

"""DB-backed Broadcasts store.

This store produces small JSON shapes that the Next UI can consume directly.
"""


import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.db import transaction
from django.db.models import Q

from siddes_post.models import Post

from .models import Broadcast, BroadcastMember, BroadcastRole, NotifyMode


def now_s() -> float:
    return float(time.time())


def now_ms() -> int:
    return int(now_s() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}_{now_ms()}_{uuid.uuid4().hex[:8]}"


def normalize_handle(raw: Any) -> str:
    s = str(raw or "").strip()
    if not s:
        return ""
    if not s.startswith("@"): 
        s = "@" + s.lstrip("@")
    return s.lower()


def rel_label(ts_s: Optional[float]) -> str:
    if not ts_s:
        return ""
    d = max(0.0, now_s() - float(ts_s))
    if d < 60:
        return "now"
    if d < 3600:
        return f"{int(d // 60)}m"
    if d < 86400:
        return f"{int(d // 3600)}h"
    return f"{int(d // 86400)}d"


def _member_for(viewer_id: str, b: Broadcast) -> Optional[BroadcastMember]:
    if not viewer_id:
        return None
    try:
        return BroadcastMember.objects.filter(broadcast=b, viewer_id=str(viewer_id)).first()
    except Exception:
        return None


def broadcast_to_item(b: Broadcast, *, viewer_id: str) -> Dict[str, Any]:
    m = _member_for(viewer_id, b)

    last_post_at = float(b.last_post_at) if b.last_post_at else None
    last_seen = float(m.last_seen_at) if m else 0.0

    has_unread = bool(m and last_post_at and last_post_at > (last_seen + 1e-6))

    return {
        "id": b.id,
        "name": b.name,
        "handle": b.handle,
        "category": b.category,
        "desc": b.desc,
        "subscribers": int(b.subscriber_count or 0),
        "isFollowing": bool(m),
        "viewerRole": str(m.role) if m else None,
        "notifyMode": str(m.notify_mode) if m else "off",
        "muted": bool(m.muted) if m else False,
        "hasUnread": has_unread,
        "lastPostAt": int(last_post_at * 1000) if last_post_at else None,
        "lastUpdate": rel_label(last_post_at),
    }


def _seed_if_empty() -> None:
    if not getattr(settings, "DEBUG", False):
        return
    try:
        if Broadcast.objects.all()[:1].exists():
            return
    except Exception:
        return

    owner = "me"

    seeds = [
        {
            "name": "Nairobi Traffic",
            "handle": "@nairobi_traffic",
            "category": "Utility",
            "desc": "Real-time updates on major routes. Community sourced, verified by admins.",
            "pinned_rules": "Keep it factual. No doxxing. No rage bait.",
        },
        {
            "name": "Tech Weekly",
            "handle": "@tech_weekly",
            "category": "Tech",
            "desc": "Curated high-signal tech news from the Silicon Savannah.",
            "pinned_rules": "Links must be reputable. Keep summaries short.",
        },
        {
            "name": "Weekend Plans",
            "handle": "@weekend_ke",
            "category": "Lifestyle",
            "desc": "The best events, gigs, and chill spots for your weekend.",
            "pinned_rules": "No scams. Be respectful.",
        },
    ]

    with transaction.atomic():
        for s in seeds:
            b = Broadcast.objects.create(
                id=new_id("b"),
                owner_id=owner,
                name=s["name"],
                handle=normalize_handle(s["handle"]),
                category=s.get("category") or "",
                desc=s.get("desc") or "",
                pinned_rules=s.get("pinned_rules") or "",
                subscriber_count=0,
                last_post_at=None,
            )
            BroadcastMember.objects.create(
                broadcast=b,
                viewer_id=owner,
                role=BroadcastRole.OWNER,
                notify_mode=NotifyMode.ALL,
                muted=False,
                last_seen_at=0.0,
            )



def _display_author(author_id: str) -> tuple[str, str]:
    a = str(author_id or '').strip()
    if not a:
        return ('Unknown', '@unknown')
    try:
        from siddes_backend.identity import display_for_token  # type: ignore
        d = display_for_token(a)
        name = str((d or {}).get('name') or '').strip() or a
        handle = str((d or {}).get('handle') or '').strip() or ('@' + a.lstrip('@').lower())
        return (name, handle)
    except Exception:
        return (a, '@' + a.lstrip('@'))

class DbBroadcastsStore:
    def ensure_seed(self) -> None:
        _seed_if_empty()

    def list(self, *, viewer_id: str, tab: str, q: str | None = None, category: str | None = None, limit: int = 50) -> List[Dict[str, Any]]:
        self.ensure_seed()

        tab = str(tab or "following").strip().lower()
        if tab not in ("following", "discover"):
            tab = "following"

        qs = Broadcast.objects.all()

        if category:
            c = str(category or "").strip()
            if c:
                qs = qs.filter(category__iexact=c)

        if q:
            t = str(q or "").strip()
            if t:
                qs = qs.filter(Q(name__icontains=t) | Q(handle__icontains=t) | Q(desc__icontains=t))

        if tab == "following":
            ids = list(BroadcastMember.objects.filter(viewer_id=str(viewer_id)).values_list("broadcast_id", flat=True))
            if not ids:
                return []
            qs = qs.filter(id__in=ids)
        else:
            # Discover: hide ones already followed
            ids = list(BroadcastMember.objects.filter(viewer_id=str(viewer_id)).values_list("broadcast_id", flat=True))
            if ids:
                qs = qs.exclude(id__in=ids)

        qs = qs.order_by("-subscriber_count", "-last_post_at", "-updated_at")
        out: List[Dict[str, Any]] = []
        for b in qs[: max(1, min(200, int(limit)) )]:
            out.append(broadcast_to_item(b, viewer_id=str(viewer_id)))
        return out

    def create(self, *, owner_id: str, name: str, handle: str, category: str = "", desc: str = "", pinned_rules: str = "") -> Dict[str, Any]:
        h = normalize_handle(handle)
        if not h:
            raise ValueError("bad_handle")

        with transaction.atomic():
            b = Broadcast.objects.create(
                id=new_id("b"),
                owner_id=str(owner_id),
                name=str(name or "Untitled")[:255],
                handle=h,
                category=str(category or "")[:64],
                desc=str(desc or ""),
                pinned_rules=str(pinned_rules or ""),
                subscriber_count=0,
                last_post_at=None,
            )
            BroadcastMember.objects.create(
                broadcast=b,
                viewer_id=str(owner_id),
                role=BroadcastRole.OWNER,
                notify_mode=NotifyMode.ALL,
                muted=False,
                last_seen_at=0.0,
            )

        return broadcast_to_item(b, viewer_id=str(owner_id))

    def get(self, *, viewer_id: str, broadcast_id: str) -> Optional[Dict[str, Any]]:
        try:
            b = Broadcast.objects.filter(id=str(broadcast_id)).first()
        except Exception:
            b = None
        if not b:
            return None
        return broadcast_to_item(b, viewer_id=str(viewer_id))

    def can_write(self, *, viewer_id: str, broadcast_id: str) -> bool:
        if not viewer_id:
            return False
        try:
            m = BroadcastMember.objects.filter(broadcast_id=str(broadcast_id), viewer_id=str(viewer_id)).first()
        except Exception:
            m = None
        if not m:
            return False
        return str(m.role) in (BroadcastRole.OWNER, BroadcastRole.WRITER)

    def follow(self, *, viewer_id: str, broadcast_id: str) -> Dict[str, Any]:
        with transaction.atomic():
            b = Broadcast.objects.select_for_update().filter(id=str(broadcast_id)).first()
            if not b:
                raise ValueError("not_found")

            m = BroadcastMember.objects.filter(broadcast=b, viewer_id=str(viewer_id)).first()
            if m:
                return broadcast_to_item(b, viewer_id=str(viewer_id))

            BroadcastMember.objects.create(
                broadcast=b,
                viewer_id=str(viewer_id),
                role=BroadcastRole.SUBSCRIBER,
                notify_mode=NotifyMode.OFF,
                muted=False,
                last_seen_at=float(b.last_post_at or 0.0),
            )

            b.subscriber_count = int(b.subscriber_count or 0) + 1
            b.save(update_fields=["subscriber_count"])

        return broadcast_to_item(b, viewer_id=str(viewer_id))

    def unfollow(self, *, viewer_id: str, broadcast_id: str) -> Dict[str, Any]:
        with transaction.atomic():
            b = Broadcast.objects.select_for_update().filter(id=str(broadcast_id)).first()
            if not b:
                raise ValueError("not_found")

            m = BroadcastMember.objects.filter(broadcast=b, viewer_id=str(viewer_id)).first()
            if not m:
                return broadcast_to_item(b, viewer_id=str(viewer_id))

            # Owners/Writers can't unfollow via this endpoint.
            if str(m.role) in (BroadcastRole.OWNER, BroadcastRole.WRITER):
                return broadcast_to_item(b, viewer_id=str(viewer_id))

            m.delete()
            b.subscriber_count = max(0, int(b.subscriber_count or 0) - 1)
            b.save(update_fields=["subscriber_count"])

        return broadcast_to_item(b, viewer_id=str(viewer_id))

    def set_notify(self, *, viewer_id: str, broadcast_id: str, mode: str, muted: bool) -> Dict[str, Any]:
        mode = str(mode or NotifyMode.OFF).strip().lower()
        if mode not in ("off", "highlights", "all"):
            mode = "off"

        with transaction.atomic():
            b = Broadcast.objects.filter(id=str(broadcast_id)).first()
            if not b:
                raise ValueError("not_found")

            m = BroadcastMember.objects.filter(broadcast=b, viewer_id=str(viewer_id)).first()
            if not m:
                # Following is required to set notifications.
                m = BroadcastMember.objects.create(
                    broadcast=b,
                    viewer_id=str(viewer_id),
                    role=BroadcastRole.SUBSCRIBER,
                    notify_mode=NotifyMode.OFF,
                    muted=False,
                    last_seen_at=float(b.last_post_at or 0.0),
                )
                b.subscriber_count = int(b.subscriber_count or 0) + 1
                b.save(update_fields=["subscriber_count"])

            m.notify_mode = mode
            m.muted = bool(muted)
            m.save(update_fields=["notify_mode", "muted"])

        return broadcast_to_item(b, viewer_id=str(viewer_id))

    def touch_last_post(self, *, broadcast_id: str, created_at: float) -> None:
        try:
            b = Broadcast.objects.filter(id=str(broadcast_id)).first()
            if not b:
                return
            cur = float(b.last_post_at or 0.0)
            nxt = float(created_at or 0.0)
            if nxt <= 0.0:
                return
            if nxt > cur:
                b.last_post_at = nxt
                b.save(update_fields=["last_post_at"])
        except Exception:
            return

    def mark_seen(self, *, viewer_id: str, broadcast_id: str) -> None:
        try:
            b = Broadcast.objects.filter(id=str(broadcast_id)).first()
            if not b:
                return
            m = BroadcastMember.objects.filter(broadcast=b, viewer_id=str(viewer_id)).first()
            if not m:
                return
            m.last_seen_at = float(b.last_post_at or now_s())
            m.save(update_fields=["last_seen_at"])
        except Exception:
            return

    def list_posts(self, *, viewer_id: str, broadcast_id: str, limit: int = 30, before: float | None = None) -> List[Dict[str, Any]]:
        self.ensure_seed()

        b = Broadcast.objects.filter(id=str(broadcast_id)).first()
        if not b:
            raise ValueError("not_found")

        qs = Post.objects.filter(side="public", set_id=str(broadcast_id))
        if before is not None and float(before) > 0:
            qs = qs.filter(created_at__lt=float(before))

        qs = qs.order_by("-created_at")

        out: List[Dict[str, Any]] = []
        for rec in qs[: max(1, min(200, int(limit)) )]:
            author_id = str(getattr(rec, "author_id", "") or "")
            name, handle = _display_author(author_id)
            out.append(
                {
                    "id": rec.id,
                    "author": name,
                    "handle": handle,
                    "time": "now",
                    "content": rec.text,
                    "kind": "text",
                    "setId": rec.set_id,
                    "broadcast": {"id": b.id, "name": b.name, "handle": b.handle},
                    "createdAt": int(float(rec.created_at) * 1000),
                }
            )

        # Mark seen when user fetches posts.
        self.mark_seen(viewer_id=str(viewer_id), broadcast_id=str(broadcast_id))

        return out

    def feed(self, *, viewer_id: str, limit: int = 30, before: float | None = None) -> list[dict[str, Any]]:
        """Return public posts from broadcasts the viewer follows (calm, non-algorithmic)."""
        self.ensure_seed()

        ids = list(BroadcastMember.objects.filter(viewer_id=str(viewer_id)).values_list("broadcast_id", flat=True))
        if not ids:
            return []

        qs = Post.objects.filter(side="public", set_id__in=ids)
        if before is not None and float(before) > 0:
            qs = qs.filter(created_at__lt=float(before))
        qs = qs.order_by("-created_at")

        bs = {b.id: b for b in Broadcast.objects.filter(id__in=ids)}

        out: list[dict[str, Any]] = []
        for rec in qs[: max(1, min(200, int(limit))) ]:
            b = bs.get(str(rec.set_id or ""))
            author_id = str(getattr(rec, "author_id", "") or "")
            name, handle = _display_author(author_id)
            out.append(
                {
                    "id": rec.id,
                    "author": name,
                    "handle": handle,
                    "time": "now",
                    "content": rec.text,
                    "kind": "text",
                    "setId": rec.set_id,
                    "broadcast": {"id": b.id, "name": b.name, "handle": b.handle} if b else None,
                    "createdAt": int(float(rec.created_at) * 1000),
                }
            )
        return out

    def list_unread(self, *, viewer_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """List broadcasts that have new posts since the viewer last saw them.

        We deliberately return a small list + dots (no big addictive counters).
        """
        self.ensure_seed()

        ms = (
            BroadcastMember.objects
            .filter(viewer_id=str(viewer_id), muted=False)
            .select_related("broadcast")
        )

        items: list[dict[str, Any]] = []
        for m in ms:
            b = getattr(m, "broadcast", None)
            if not b:
                continue
            last = float(getattr(b, "last_post_at", 0.0) or 0.0)
            seen = float(getattr(m, "last_seen_at", 0.0) or 0.0)
            if last > 0.0 and last > seen:
                it = broadcast_to_item(b, viewer_id=str(viewer_id))
                it["hasUnread"] = True
                it["lastUpdateAt"] = int(last * 1000)
                items.append(it)

        items.sort(key=lambda x: int(x.get("lastUpdateAt") or 0), reverse=True)
        return items[: max(1, min(200, int(limit))) ]

    def list_writers(self, *, viewer_id: str, broadcast_id: str) -> list[dict[str, str]]:
        """Return the writer team for a broadcast (owner+writer roles).

        Privacy: follower list stays private; only team is exposed here.
        """
        self.ensure_seed()
        rows = (
            BroadcastMember.objects
            .filter(broadcast_id=str(broadcast_id), role__in=["owner", "writer"])
            .order_by("role", "viewer_id")
            .values_list("viewer_id", "role")
        )
        out: list[dict[str, str]] = []
        for vid, role in rows:
            out.append({"viewerId": str(vid), "role": str(role)})
        return out

    def add_writer(self, *, owner_viewer_id: str, broadcast_id: str, writer_viewer_id: str) -> None:
        self.ensure_seed()
        # Must be owner
        is_owner = BroadcastMember.objects.filter(broadcast_id=str(broadcast_id), viewer_id=str(owner_viewer_id), role="owner").exists()
        if not is_owner:
            raise PermissionError("owner_required")

        BroadcastMember.objects.update_or_create(
            broadcast_id=str(broadcast_id),
            viewer_id=str(writer_viewer_id),
            defaults={"role": "writer", "muted": False, "notify_mode": "highlights"},
        )

    def remove_writer(self, *, owner_viewer_id: str, broadcast_id: str, writer_viewer_id: str) -> None:
        self.ensure_seed()
        is_owner = BroadcastMember.objects.filter(broadcast_id=str(broadcast_id), viewer_id=str(owner_viewer_id), role="owner").exists()
        if not is_owner:
            raise PermissionError("owner_required")

        # Never delete owner
        BroadcastMember.objects.filter(broadcast_id=str(broadcast_id), viewer_id=str(writer_viewer_id), role="writer").delete()


STORE = DbBroadcastsStore()
