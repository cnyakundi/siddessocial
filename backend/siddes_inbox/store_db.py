"""DB-backed InboxStore (v0.7).

Goal (sd_121b):
- Introduce a Postgres-backed InboxStore using Django ORM models.
- Keep the API contract stable (docs/INBOX_BACKEND_CONTRACT.md).
- Stay default-safe:
  - This store is only used when SD_INBOX_STORE=db.
  - If the DB is empty, listThreads returns an empty list (no crash).
  - A later overlay can add deterministic seeding + dual-write.

Notes:
- This is still a *demo* implementation, but unread is now tracked per-viewer via
  `InboxThreadReadState` (sd_121e scaffold).
- Viewer identity & visibility policy enforcement still happens above the store layer.
"""

from __future__ import annotations

from datetime import datetime, timezone as dt_tz, timedelta
from typing import List, Optional, Tuple
from uuid import uuid4

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import InboxMessage, InboxThread, InboxThreadReadState
from .models_stub import MessageRecord, ParticipantRecord, SideId, ThreadMetaRecord, ThreadRecord
from .store import InboxStore

from .visibility_stub import ViewerRole, allowed_sides_for_role, resolve_viewer_role, role_can_view


def _dt_to_ms(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_tz.utc)
    return int(dt.timestamp() * 1000)


def _ms_to_dt(ms: int) -> datetime:
    # Always use UTC for cursor comparison.
    return datetime.fromtimestamp(ms / 1000.0, tz=dt_tz.utc)


def _age_label(now_ms: int, ts_ms: int) -> str:
    delta = max(0, now_ms - ts_ms)
    mins = delta // 60000
    if mins < 60:
        return f"{max(1, mins)}m" if mins > 0 else "now"
    hours = mins // 60
    if hours < 24:
        return f"{hours}h"
    days = hours // 24
    return f"{days}d"




def _is_real_authed_viewer(viewer_id: str) -> bool:
    """True if this looks like a real authenticated viewer id (me_<id>)."""
    return str(viewer_id or "").startswith("me_")
class DbInboxStore(InboxStore):
    """InboxStore backed by Django models."""

    def __init__(self) -> None:
        # sd_121j: unread is derived from `last_read_ts` + message history.
        # sd_122: cleanup — remove legacy constructor flags.
        pass

    def _viewer_role(self, viewer_id: str) -> ViewerRole:
        # Viewer ids are normalized in DRF (`get_viewer_id`), but keep this safe.
        return resolve_viewer_role(viewer_id) or "anon"

    def _participant(self, t: InboxThread) -> ParticipantRecord:
        name = (t.participant_display_name or t.title or "").strip()
        # Compute safe initials (1-2 chars).
        parts = [p for p in name.replace("@", "").split() if p]
        initials = ""
        for p in parts:
            initials += p[0].upper()
            if len(initials) >= 2:
                break
        if not initials:
            initials = "?"
        return ParticipantRecord(
            display_name=t.participant_display_name or name or "",
            initials=initials,
            avatar_seed=t.participant_avatar_seed or t.id,
            user_id=t.participant_user_id,
            handle=t.participant_handle,
        )

    def _thread_record(self, *, viewer_id: str, t: InboxThread, now_ms: int, unread: int = 0) -> ThreadRecord:
        updated_ms = _dt_to_ms(t.updated_at)
        return ThreadRecord(
            id=t.id,
            title=t.title,
            participant=self._participant(t),
            locked_side=str(t.locked_side),
            last=t.last_text or "",
            time=_age_label(now_ms, updated_ms),
            unread=int(unread or 0),
            updated_at=updated_ms,
        )

    def _derive_unread_map_for_threads(self, *, viewer_id: str, thread_ids: list[str]) -> dict[str, int]:
        # Derive unread counts from message history + per-viewer last_read_ts.

        if not thread_ids:
            return {}

        rows = InboxThreadReadState.objects.filter(
            viewer_id=str(viewer_id),
            thread_id__in=thread_ids,
        ).values_list("thread_id", "last_read_ts")

        last_read: dict[str, datetime | None] = {str(tid): ts for tid, ts in rows}
        epoch = datetime(1970, 1, 1, tzinfo=dt_tz.utc)

        out: dict[str, int] = {}
        for tid in thread_ids:
            key = str(tid)
            # sd_757_unread_inbound_only: if a read-state row doesn't exist yet, treat as never-read.
            # Unread counts only inbound messages (from_id="them").
            cutoff = last_read.get(key) or epoch
            if cutoff.tzinfo is None:
                cutoff = cutoff.replace(tzinfo=dt_tz.utc)

            out[key] = InboxMessage.objects.filter(thread_id=tid, from_id="them", ts__gt=cutoff).count()

        return out

    def _unread_map_for_threads(self, *, viewer_id: str, thread_ids: list[str]) -> dict[str, int]:
        # Return per-thread unread counts for a viewer.

        if not thread_ids:
            return {}

        role = self._viewer_role(viewer_id)

        # Hard rule: anonymous viewers never have unread.
        if role == "anon":
            return {tid: 0 for tid in thread_ids}

        # Deterministic shim: only role==me tracks unread.
        if role != "me":
            return {tid: 0 for tid in thread_ids}

        return self._derive_unread_map_for_threads(viewer_id=viewer_id, thread_ids=thread_ids)

    def _set_thread_unread(
        self,
        *,
        thread: InboxThread,
        viewer_id: str,
        unread: int,
        last_read_ts: datetime | None = None,
    ) -> None:
        # Best-effort: persist per-viewer last_read_ts for a thread.

        role = self._viewer_role(viewer_id)
        if role == "anon":
            return

        defaults: dict[str, object] = {"viewer_role": str(role)}

        if last_read_ts is not None:
            defaults["last_read_ts"] = last_read_ts

        InboxThreadReadState.objects.update_or_create(
            thread=thread,
            viewer_id=str(viewer_id),
            defaults=defaults,
        )


    def list_threads(
        self,
        *,
        viewer_id: str,
        side: Optional[SideId] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> Tuple[List[ThreadRecord], bool, Optional[str]]:
        limit = max(1, min(int(limit), 50))
        now_ms = _dt_to_ms(timezone.now())

        qs = InboxThread.objects.all()

        # sd_242a: real authenticated users (viewer_id=me_<id>) must only see their own threads.
        if str(viewer_id).startswith("me_"):
            qs = qs.filter(owner_viewer_id=str(viewer_id))


        role = self._viewer_role(viewer_id)
        allowed = allowed_sides_for_role(role)
        qs = qs.filter(locked_side__in=list(allowed))

        if side:
            qs = qs.filter(locked_side=str(side))

        if cursor:
            try:
                ts_s, cid = cursor.split(":", 1)
                ts_ms = int(ts_s)
                cutoff = _ms_to_dt(ts_ms)
                qs = qs.filter(Q(updated_at__lt=cutoff) | (Q(updated_at=cutoff) & Q(id__lt=cid)))
            except Exception:
                # Bad cursor -> ignore (dev tolerance)
                pass

        qs = qs.order_by("-updated_at", "-id")

        # Fetch one extra to determine has_more
        objs = list(qs[: limit + 1])
        has_more = len(objs) > limit
        page = objs[:limit]

        unread_map = self._unread_map_for_threads(viewer_id=viewer_id, thread_ids=[t.id for t in page])
        items = [
            self._thread_record(viewer_id=viewer_id, t=t, now_ms=now_ms, unread=unread_map.get(t.id, 0)) for t in page
        ]

        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = f"{_dt_to_ms(last.updated_at)}:{last.id}"

        return items, bool(has_more), next_cursor

    def get_thread(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        limit: int = 30,
        cursor: Optional[str] = None,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord, List[MessageRecord], bool, Optional[str]]:
        limit = max(1, min(int(limit), 50))
        try:
            t = InboxThread.objects.get(id=thread_id)
        except InboxThread.DoesNotExist as exc:
            raise KeyError(f"unknown thread: {thread_id}") from exc

        # sd_248: owner scoping for real authenticated viewers.
        if _is_real_authed_viewer(viewer_id) and str(getattr(t, 'owner_viewer_id', '') or '') != str(viewer_id):
            # Default-safe: hide existence
            raise KeyError('restricted')

        # sd_242a: per-viewer thread scoping for real authenticated users (me_<id>).
        if str(viewer_id).startswith("me_"):
            if str(getattr(t, "owner_viewer_id", "") or "") != str(viewer_id):
                # Default-safe: hide existence
                raise KeyError("restricted")

        role = self._viewer_role(viewer_id)
        if not role_can_view(role, str(t.locked_side)):
            # Default-safe: hide existence
            raise KeyError("restricted")

        cutoff = None
        if cursor:
            try:
                ts_s, mid = cursor.split(":", 1)
                cutoff = (int(ts_s), mid)
            except Exception:
                cutoff = None

        msg_qs = InboxMessage.objects.filter(thread=t)

        if cutoff is not None:
            cutoff_dt = _ms_to_dt(cutoff[0])
            cutoff_id = cutoff[1]
            msg_qs = msg_qs.filter(Q(ts__lt=cutoff_dt) | (Q(ts=cutoff_dt) & Q(id__lt=cutoff_id)))

        # We want the most recent page among eligible older messages.
        # Do this by ordering DESC, slicing, then reversing to ASC.
        msg_qs = msg_qs.order_by("-ts", "-id")
        rows = list(msg_qs[: limit + 1])
        has_more = len(rows) > limit
        page_desc = rows[:limit]
        page = list(reversed(page_desc))

        messages: List[MessageRecord] = [
            MessageRecord(
                id=m.id,
                thread_id=t.id,
                ts=_dt_to_ms(m.ts),
                from_id=m.from_id,
                text=m.text,
                side=str(m.side),
                queued=bool(m.queued),
                client_key=m.client_key,
            )
            for m in page
        ]

        next_cursor = None
        if has_more and page:
            oldest = page[0]
            next_cursor = f"{_dt_to_ms(oldest.ts)}:{oldest.id}"

        # Read semantics: opening the thread clears unread *for this viewer*.
        now_dt = timezone.now()
        try:
            self._set_thread_unread(thread=t, viewer_id=viewer_id, unread=0, last_read_ts=now_dt)
        except Exception:
            pass

        now_ms = _dt_to_ms(now_dt)
        thread = self._thread_record(viewer_id=viewer_id, t=t, now_ms=now_ms, unread=0)
        
        # sd_748_mirror_delivery: mirror-write into recipient inbox (per-owner threads)
        try:
            recip_uid = str(getattr(t, "participant_user_id", "") or "").strip()
            if recip_uid:
                recip_viewer = f"me_{recip_uid}"

                # Build sender participant snapshot for recipient thread
                sender_uid = str(t.owner_viewer_id or "").replace("me_", "")
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    u = User.objects.get(id=sender_uid)
                    disp = (u.get_full_name() or u.get_username() or "User").strip()
                    handle = u.get_username()
                except Exception:
                    disp = "User"
                    handle = None

                parts = [x for x in disp.split() if x]
                initials = "".join([x[0].upper() for x in parts])[:2] or "?"

                from .models_stub import ParticipantRecord
                participant = ParticipantRecord(
                    display_name=disp,
                    initials=initials,
                    avatar_seed=sender_uid or t.id,
                    user_id=sender_uid,
                    handle=handle,
                )

                # Ensure recipient thread
                r_thread, _ = self.ensure_thread(
                    viewer_id=recip_viewer,
                    other_token=handle or sender_uid,
                    locked_side=str(t.locked_side),
                    title=disp,
                    participant=participant,
                )

                # Insert mirrored message
                InboxMessage.objects.create(
                    id=f"m_{uuid4().hex[:18]}",
                    thread=InboxThread.objects.get(id=r_thread.id),
                    ts=now,
                    from_id="them",
                    text=str(text or ""),
                    side=str(t.locked_side),
                    queued=False,
                    client_key=None,
                )

                # Touch recipient thread cache
                rt = InboxThread.objects.get(id=r_thread.id)
                rt.last_text = str(text or "")
                rt.last_from_id = "them"
                rt.updated_at = now
                rt.save(update_fields=["last_text", "last_from_id", "updated_at"])

                # Ensure unread state exists (unread derives > 0)
                from .models import InboxThreadReadState
                InboxThreadReadState.objects.get_or_create(
                    thread=rt,
                    viewer_id=recip_viewer,
                    defaults={"viewer_role": "me", "last_read_ts": None},
                )
        except Exception:
            pass

        meta = ThreadMetaRecord(locked_side=str(t.locked_side), updated_at=_dt_to_ms(t.updated_at))

        return thread, meta, messages, bool(has_more), next_cursor

    def ensure_thread(
        self,
        *,
        viewer_id: str,
        other_token: str,
        locked_side: SideId,
        title: str,
        participant: ParticipantRecord,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord]:
        """Ensure a DM-style thread exists for (viewer_id, other_token).

        Idempotent per (owner_viewer_id, participant_handle). If an existing thread
        is found, we return it without changing locked_side.
        """

        role = self._viewer_role(viewer_id)
        if role != "me":
            raise KeyError("restricted")

        tok = str(other_token or "").strip()
        if not tok:
            raise KeyError("restricted")

        uid = str(getattr(participant, "user_id", "") or "").strip()

        now = timezone.now()
        now_ms = _dt_to_ms(now)

        # sd_741: Prefer stable participant_user_id for idempotency when available.
        t = None
        if uid:
            t = InboxThread.objects.filter(owner_viewer_id=str(viewer_id), participant_user_id=str(uid)).first()
        if t is None:
            t = InboxThread.objects.filter(owner_viewer_id=str(viewer_id), participant_handle=str(tok)).first()

        # sd_741: If we found an older thread by handle, migrate it to stable user_id.
        if t is not None and uid:
            changed_fields: list[str] = []
            if not str(getattr(t, "participant_user_id", "") or "").strip():
                t.participant_user_id = str(uid)
                changed_fields.append("participant_user_id")
            if str(getattr(t, "participant_handle", "") or "") != str(tok):
                t.participant_handle = str(tok)
                changed_fields.append("participant_handle")
            if changed_fields:
                try:
                    t.save(update_fields=changed_fields)
                except Exception:
                    pass

        if t is not None:
            thread = self._thread_record(viewer_id=viewer_id, t=t, now_ms=now_ms, unread=0)
            meta = ThreadMetaRecord(locked_side=str(t.locked_side), updated_at=_dt_to_ms(t.updated_at))
            return thread, meta

        p = participant
        disp = str(p.display_name or "").strip() or str(title or "").strip() or "Message"
        initials = str(getattr(p, "initials", "") or "").strip()
        if not initials:
            parts = [x for x in disp.replace("@", "").split() if x]
            initials = "".join([x[0].upper() for x in parts])[:2] or "?"

        tid = f"t_{uuid4().hex[:12]}"
        t = InboxThread.objects.create(
            id=tid,
            owner_viewer_id=str(viewer_id or ""),
            locked_side=str(locked_side),
            title=str(title or disp),
            participant_display_name=str(disp),
            participant_initials=str(initials),
            participant_avatar_seed=p.avatar_seed or tid,
            participant_user_id=p.user_id,
            participant_handle=str(tok),
            last_text="",
            last_from_id="",
        )

        thread = self._thread_record(viewer_id=viewer_id, t=t, now_ms=now_ms, unread=0)
        
        # sd_748_mirror_delivery: mirror-write into recipient inbox (per-owner threads)
        try:
            recip_uid = str(getattr(t, "participant_user_id", "") or "").strip()
            if recip_uid:
                recip_viewer = f"me_{recip_uid}"

                # Build sender participant snapshot for recipient thread
                sender_uid = str(t.owner_viewer_id or "").replace("me_", "")
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    u = User.objects.get(id=sender_uid)
                    disp = (u.get_full_name() or u.get_username() or "User").strip()
                    handle = u.get_username()
                except Exception:
                    disp = "User"
                    handle = None

                parts = [x for x in disp.split() if x]
                initials = "".join([x[0].upper() for x in parts])[:2] or "?"

                from .models_stub import ParticipantRecord
                participant = ParticipantRecord(
                    display_name=disp,
                    initials=initials,
                    avatar_seed=sender_uid or t.id,
                    user_id=sender_uid,
                    handle=handle,
                )

                # Ensure recipient thread
                r_thread, _ = self.ensure_thread(
                    viewer_id=recip_viewer,
                    other_token=handle or sender_uid,
                    locked_side=str(t.locked_side),
                    title=disp,
                    participant=participant,
                )

                # Insert mirrored message
                InboxMessage.objects.create(
                    id=f"m_{uuid4().hex[:18]}",
                    thread=InboxThread.objects.get(id=r_thread.id),
                    ts=now,
                    from_id="them",
                    text=str(text or ""),
                    side=str(t.locked_side),
                    queued=False,
                    client_key=None,
                )

                # Touch recipient thread cache
                rt = InboxThread.objects.get(id=r_thread.id)
                rt.last_text = str(text or "")
                rt.last_from_id = "them"
                rt.updated_at = now
                rt.save(update_fields=["last_text", "last_from_id", "updated_at"])

                # Ensure unread state exists (unread derives > 0)
                from .models import InboxThreadReadState
                InboxThreadReadState.objects.get_or_create(
                    thread=rt,
                    viewer_id=recip_viewer,
                    defaults={"viewer_role": "me", "last_read_ts": None},
                )
        except Exception:
            pass

        meta = ThreadMetaRecord(locked_side=str(t.locked_side), updated_at=_dt_to_ms(t.updated_at))
        return thread, meta




    def send_message(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
        client_key: Optional[str] = None,
    ) -> Tuple[MessageRecord, ThreadMetaRecord]:
        now = timezone.now()

        try:
            t = InboxThread.objects.get(id=thread_id)
        except InboxThread.DoesNotExist as exc:
            raise KeyError(f"unknown thread: {thread_id}") from exc


        # sd_248: owner scoping for real authenticated viewers.
        if _is_real_authed_viewer(viewer_id) and str(getattr(t, 'owner_viewer_id', '') or '') != str(viewer_id):
            # Default-safe: hide existence
            raise KeyError('restricted')
        # sd_242a: per-viewer thread scoping for real authenticated users (me_<id>).
        if str(viewer_id).startswith("me_"):
            if str(getattr(t, "owner_viewer_id", "") or "") != str(viewer_id):
                # Default-safe: hide existence
                raise KeyError("restricted")

        role = self._viewer_role(viewer_id)
        if not role_can_view(role, str(t.locked_side)):
            # Default-safe: hide existence
            raise KeyError("restricted")

        # sd_751_inbox_send_idempotency: if client_key repeats, return existing message (no duplicates on retry)
        if client_key:
            try:
                ex = (
                    InboxMessage.objects.filter(thread=t, from_id="me", client_key=str(client_key))
                    .order_by("ts")
                    .first()
                )
                if ex is not None:
                    meta = ThreadMetaRecord(locked_side=str(t.locked_side), updated_at=_dt_to_ms(t.updated_at))
                    msg = MessageRecord(
                        id=str(ex.id),
                        thread_id=str(t.id),
                        ts=_dt_to_ms(ex.ts),
                        from_id=str(ex.from_id),
                        text=str(ex.text or ""),
                        side=str(ex.side),
                        queued=bool(ex.queued),
                        client_key=str(ex.client_key) if ex.client_key is not None else None,
                    )
                    return msg, meta
            except Exception:
                pass

        msg_id = f"m_{uuid4().hex[:18]}"
        side = str(t.locked_side)

        with transaction.atomic():
            InboxMessage.objects.create(
                id=msg_id,
                thread=t,
                ts=now,
                from_id="me",
                text=str(text or ""),
                side=side,
                queued=False,
                client_key=client_key,
            )

            # Update thread caches
            t.last_text = str(text or "")
            t.last_from_id = "me"
            t.updated_at = now
            t.save(update_fields=["last_text", "last_from_id", "updated_at"])

        # Sender sees unread cleared for their viewer role.
        try:
            self._set_thread_unread(thread=t, viewer_id=viewer_id, unread=0, last_read_ts=now)
        except Exception:
            pass

        
        # sd_748_mirror_delivery: mirror-write into recipient inbox (per-owner threads)
        try:
            recip_uid = str(getattr(t, "participant_user_id", "") or "").strip()
            if recip_uid:
                recip_viewer = f"me_{recip_uid}"

                # Build sender participant snapshot for recipient thread
                sender_uid = str(t.owner_viewer_id or "").replace("me_", "")
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    u = User.objects.get(id=sender_uid)
                    disp = (u.get_full_name() or u.get_username() or "User").strip()
                    handle = u.get_username()
                except Exception:
                    disp = "User"
                    handle = None

                parts = [x for x in disp.split() if x]
                initials = "".join([x[0].upper() for x in parts])[:2] or "?"

                from .models_stub import ParticipantRecord
                participant = ParticipantRecord(
                    display_name=disp,
                    initials=initials,
                    avatar_seed=sender_uid or t.id,
                    user_id=sender_uid,
                    handle=handle,
                )

                # Ensure recipient thread
                r_thread, _ = self.ensure_thread(
                    viewer_id=recip_viewer,
                    other_token=handle or sender_uid,
                    locked_side=str(t.locked_side),
                    title=disp,
                    participant=participant,
                )

                # Insert mirrored message
                InboxMessage.objects.create(
                    id=f"m_{uuid4().hex[:18]}",
                    thread=InboxThread.objects.get(id=r_thread.id),
                    ts=now,
                    from_id="them",
                    text=str(text or ""),
                    side=str(t.locked_side),
                    queued=False,
                    client_key=None,
                )

                # Touch recipient thread cache
                rt = InboxThread.objects.get(id=r_thread.id)
                rt.last_text = str(text or "")
                rt.last_from_id = "them"
                rt.updated_at = now
                rt.save(update_fields=["last_text", "last_from_id", "updated_at"])

                # Ensure unread state exists (unread derives > 0)
                from .models import InboxThreadReadState
                InboxThreadReadState.objects.get_or_create(
                    thread=rt,
                    viewer_id=recip_viewer,
                    defaults={"viewer_role": "me", "last_read_ts": None},
                )
        except Exception:
            pass

        meta = ThreadMetaRecord(locked_side=side, updated_at=_dt_to_ms(now))
        msg = MessageRecord(
            id=msg_id,
            thread_id=t.id,
            ts=_dt_to_ms(now),
            from_id="me",
            text=str(text or ""),
            side=side,
            queued=False,
            client_key=client_key,
        )
        return msg, meta

    def set_locked_side(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        side: SideId,
    ) -> ThreadMetaRecord:
        now = timezone.now()
        try:
            t = InboxThread.objects.get(id=thread_id)
        except InboxThread.DoesNotExist as exc:
            raise KeyError(f"unknown thread: {thread_id}") from exc


        # sd_248: owner scoping for real authenticated viewers.
        if _is_real_authed_viewer(viewer_id) and str(getattr(t, 'owner_viewer_id', '') or '') != str(viewer_id):
            # Default-safe: hide existence
            raise KeyError('restricted')
        # sd_242a: per-viewer thread scoping for real authenticated users (me_<id>).
        if str(viewer_id).startswith("me_"):
            if str(getattr(t, "owner_viewer_id", "") or "") != str(viewer_id):
                # Default-safe: hide existence
                raise KeyError("restricted")

        role = self._viewer_role(viewer_id)
        if role != "me":
            raise KeyError("restricted")

        t.locked_side = str(side)
        t.updated_at = now
        t.save(update_fields=["locked_side", "updated_at"])

        return ThreadMetaRecord(locked_side=str(t.locked_side), updated_at=_dt_to_ms(now))

    # --- dual-write helpers ----------------------------------------

    def shadow_upsert_thread(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        locked_side: SideId,
        title: str = "",
        participant: Optional[ParticipantRecord] = None,
    ) -> None:
        """Best-effort upsert used by dev dual-write.

        This is NOT part of the public API contract; it exists so a memory-mode
        server can mirror writes into the DB without a full cutover.

        Behavior:
        - Create the thread if missing.
        - Update side/title/participant snapshot if provided.
        - Never raises on DB errors (callers may still wrap in try/except).
        """

        try:
            t = InboxThread.objects.get(id=thread_id)
            update_fields: list[str] = []

            # sd_242a: owner scoping — prevent cross-user overwrite for real users.
            cur_owner = str(getattr(t, "owner_viewer_id", "") or "")
            if str(viewer_id).startswith("me_"):
                if not cur_owner or cur_owner != str(viewer_id):
                    return
            else:
                if not cur_owner:
                    t.owner_viewer_id = str(viewer_id)
                    update_fields.append("owner_viewer_id")

            if locked_side and str(t.locked_side) != str(locked_side):
                t.locked_side = str(locked_side)
                update_fields.append("locked_side")

            if title and str(t.title or "") != str(title):
                t.title = str(title)
                update_fields.append("title")

            if participant is not None:
                if str(t.participant_display_name or "") != str(participant.display_name or ""):
                    t.participant_display_name = str(participant.display_name or "")
                    update_fields.append("participant_display_name")
                if str(t.participant_initials or "") != str(participant.initials or ""):
                    t.participant_initials = str(participant.initials or "")
                    update_fields.append("participant_initials")

                # Optional snapshot fields
                if (t.participant_avatar_seed or None) != (participant.avatar_seed or None):
                    t.participant_avatar_seed = participant.avatar_seed
                    update_fields.append("participant_avatar_seed")
                if (t.participant_user_id or None) != (participant.user_id or None):
                    t.participant_user_id = participant.user_id
                    update_fields.append("participant_user_id")
                if (t.participant_handle or None) != (participant.handle or None):
                    t.participant_handle = participant.handle
                    update_fields.append("participant_handle")

            if update_fields:
                t.save(update_fields=update_fields)
            return

        except InboxThread.DoesNotExist:
            pass

        # Create
        kwargs = {
            "id": thread_id,
            "owner_viewer_id": str(viewer_id or ""),
            "locked_side": str(locked_side),
            "title": str(title or ""),
            "participant_display_name": "",
            "participant_initials": "",
            "participant_avatar_seed": None,
            "participant_user_id": None,
            "participant_handle": None,
            "last_text": "",
            "last_from_id": "",
        }

        if participant is not None:
            kwargs["participant_display_name"] = str(participant.display_name or "")
            kwargs["participant_initials"] = str(participant.initials or "")
            kwargs["participant_avatar_seed"] = participant.avatar_seed
            kwargs["participant_user_id"] = participant.user_id
            kwargs["participant_handle"] = participant.handle

        InboxThread.objects.create(**kwargs)

    # --- dev debug helpers ------------------------------------------

    def debug_reset_unread(self, *, viewer_id: str, thread_id: str) -> None:
        """Dev-only: reset unread counter for the thread.
        """

        role = self._viewer_role(viewer_id)
        if role != "me":
            raise KeyError("restricted")

        try:
            t = InboxThread.objects.get(id=thread_id)
        except InboxThread.DoesNotExist as exc:
            raise KeyError(f"unknown thread: {thread_id}") from exc

        # sd_242a: per-viewer thread scoping for real authenticated users (me_<id>).
        if str(viewer_id).startswith("me_"):
            if str(getattr(t, "owner_viewer_id", "") or "") != str(viewer_id):
                # Default-safe: hide existence
                raise KeyError("restricted")

        if not role_can_view(role, str(t.locked_side)):
            raise KeyError("restricted")

        # Reset unread for this viewer role.
        try:
            self._set_thread_unread(thread=t, viewer_id=viewer_id, unread=0, last_read_ts=timezone.now())
        except Exception:
            pass

    def debug_append_incoming(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
    ) -> Tuple[MessageRecord, ThreadMetaRecord]:
        """Dev-only: append an incoming message from `them` and increment unread."""

        role = self._viewer_role(viewer_id)
        if role != "me":
            raise KeyError("restricted")

        try:
            t = InboxThread.objects.get(id=thread_id)
        except InboxThread.DoesNotExist as exc:
            raise KeyError(f"unknown thread: {thread_id}") from exc

        # sd_242a: per-viewer thread scoping for real authenticated users (me_<id>).
        if str(viewer_id).startswith("me_"):
            if str(getattr(t, "owner_viewer_id", "") or "") != str(viewer_id):
                # Default-safe: hide existence
                raise KeyError("restricted")

        if not role_can_view(role, str(t.locked_side)):
            raise KeyError("restricted")

        now = timezone.now()
        msg_id = f"m_{uuid4().hex[:18]}"
        side = str(t.locked_side)
        txt = str(text or "Incoming (simulated) message")

        with transaction.atomic():
            InboxMessage.objects.create(
                id=msg_id,
                thread=t,
                ts=now,
                from_id="them",
                text=txt,
                side=side,
                queued=False,
                client_key=None,
            )

            # Update thread caches
            t.last_text = txt
            t.last_from_id = "them"
            t.updated_at = now
            t.save(update_fields=["last_text", "last_from_id", "updated_at"])
        # Ensure a baseline read-state exists so derived unread behaves predictably.
        # If no row exists, create one such that the newly appended incoming message
        # appears as 1 unread (ts > last_read_ts).
        try:
            state = InboxThreadReadState.objects.filter(thread=t, viewer_id=str(viewer_id)).first()
            if state is None:
                baseline = now - timedelta(microseconds=1)
                InboxThreadReadState.objects.create(
                    thread=t,
                    viewer_id=str(viewer_id),
                    viewer_role=str(role),
                    last_read_ts=baseline,
                )
        except Exception:
            pass

        
        # sd_748_mirror_delivery: mirror-write into recipient inbox (per-owner threads)
        try:
            recip_uid = str(getattr(t, "participant_user_id", "") or "").strip()
            if recip_uid:
                recip_viewer = f"me_{recip_uid}"

                # Build sender participant snapshot for recipient thread
                sender_uid = str(t.owner_viewer_id or "").replace("me_", "")
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    u = User.objects.get(id=sender_uid)
                    disp = (u.get_full_name() or u.get_username() or "User").strip()
                    handle = u.get_username()
                except Exception:
                    disp = "User"
                    handle = None

                parts = [x for x in disp.split() if x]
                initials = "".join([x[0].upper() for x in parts])[:2] or "?"

                from .models_stub import ParticipantRecord
                participant = ParticipantRecord(
                    display_name=disp,
                    initials=initials,
                    avatar_seed=sender_uid or t.id,
                    user_id=sender_uid,
                    handle=handle,
                )

                # Ensure recipient thread
                r_thread, _ = self.ensure_thread(
                    viewer_id=recip_viewer,
                    other_token=handle or sender_uid,
                    locked_side=str(t.locked_side),
                    title=disp,
                    participant=participant,
                )

                # Insert mirrored message
                InboxMessage.objects.create(
                    id=f"m_{uuid4().hex[:18]}",
                    thread=InboxThread.objects.get(id=r_thread.id),
                    ts=now,
                    from_id="them",
                    text=str(text or ""),
                    side=str(t.locked_side),
                    queued=False,
                    client_key=None,
                )

                # Touch recipient thread cache
                rt = InboxThread.objects.get(id=r_thread.id)
                rt.last_text = str(text or "")
                rt.last_from_id = "them"
                rt.updated_at = now
                rt.save(update_fields=["last_text", "last_from_id", "updated_at"])

                # Ensure unread state exists (unread derives > 0)
                from .models import InboxThreadReadState
                InboxThreadReadState.objects.get_or_create(
                    thread=rt,
                    viewer_id=recip_viewer,
                    defaults={"viewer_role": "me", "last_read_ts": None},
                )
        except Exception:
            pass

        meta = ThreadMetaRecord(locked_side=side, updated_at=_dt_to_ms(now))
        msg = MessageRecord(
            id=msg_id,
            thread_id=t.id,
            ts=_dt_to_ms(now),
            from_id="them",
            text=txt,
            side=side,
            queued=False,
            client_key=None,
        )
        return msg, meta
