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
        return ParticipantRecord(
            display_name=t.participant_display_name or "",
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

    def _derive_unread_map_for_threads(self, *, viewer_role: ViewerRole, thread_ids: list[str]) -> dict[str, int]:
        """Derive unread counts by counting messages after `last_read_ts`.

        This is optional/dev-only scaffolding.

        For now we keep the deterministic stub behavior: only the owning viewer
        ("me") tracks unread; other roles return 0 unread.
        """

        if not thread_ids:
            return {}

        if viewer_role != "me":
            return {tid: 0 for tid in thread_ids}

        rows = InboxThreadReadState.objects.filter(
            viewer_role=str(viewer_role),
            thread_id__in=thread_ids,
        ).values_list("thread_id", "last_read_ts")

        last_read: dict[str, datetime | None] = {str(tid): ts for tid, ts in rows}
        epoch = datetime(1970, 1, 1, tzinfo=dt_tz.utc)

        out: dict[str, int] = {}
        for tid in thread_ids:
            key = str(tid)
            if key not in last_read:
                # Default-safe: if a read-state row doesn't exist yet,
                # treat the thread as read (0 unread).
                out[key] = 0
                continue

            cutoff = last_read.get(key) or epoch
            if cutoff.tzinfo is None:
                cutoff = cutoff.replace(tzinfo=dt_tz.utc)

            # Unread == incoming messages after last_read_ts.
            n = InboxMessage.objects.filter(
                thread_id=key,
                from_id="them",
                ts__gt=cutoff,
            ).count()

            try:
                out[key] = min(99, max(0, int(n)))
            except Exception:
                out[key] = 0

        return out

    def _unread_map_for_threads(self, *, viewer_role: ViewerRole, thread_ids: list[str]) -> dict[str, int]:
        """Return per-thread unread counts for a given viewer role.

        sd_121j: unread is always derived from `last_read_ts` + message history.
        """

        if not thread_ids:
            return {}

        # Hard rule: anonymous viewers never have unread.
        if viewer_role == "anon":
            return {tid: 0 for tid in thread_ids}

        # Deterministic stub behavior: only "me" has unread.
        if viewer_role != "me":
            return {tid: 0 for tid in thread_ids}

        return self._derive_unread_map_for_threads(viewer_role=viewer_role, thread_ids=thread_ids)

    def _set_thread_unread(
        self,
        *,
        thread: InboxThread,
        viewer_role: ViewerRole,
        unread: int,
        last_read_ts: datetime | None = None,
    ) -> None:
        """Best-effort: update per-viewer read state for a thread.

        sd_121j: cached unread is removed; only `last_read_ts` is persisted.
        The `unread` arg remains for backwards compatibility with the store interface.
        """

        if viewer_role == "anon":
            return

        defaults: dict[str, object] = {}

        if last_read_ts is not None:
            defaults["last_read_ts"] = last_read_ts

        if not defaults:
            return

        InboxThreadReadState.objects.update_or_create(
            thread=thread,
            viewer_role=str(viewer_role),
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

        unread_map = self._unread_map_for_threads(viewer_role=role, thread_ids=[t.id for t in page])
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
            self._set_thread_unread(thread=t, viewer_role=role, unread=0, last_read_ts=now_dt)
        except Exception:
            pass

        now_ms = _dt_to_ms(now_dt)
        thread = self._thread_record(viewer_id=viewer_id, t=t, now_ms=now_ms, unread=0)
        meta = ThreadMetaRecord(locked_side=str(t.locked_side), updated_at=_dt_to_ms(t.updated_at))

        return thread, meta, messages, bool(has_more), next_cursor

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

        role = self._viewer_role(viewer_id)
        if not role_can_view(role, str(t.locked_side)):
            # Default-safe: hide existence
            raise KeyError("restricted")

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
            self._set_thread_unread(thread=t, viewer_role=role, unread=0, last_read_ts=now)
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

        role = self._viewer_role(viewer_id)
        if role != "me":
            raise KeyError("restricted")

        t.locked_side = str(side)
        t.updated_at = now
        t.save(update_fields=["locked_side", "updated_at"])

        return ThreadMetaRecord(locked_side=str(t.locked_side), updated_at=_dt_to_ms(now))

    # --- dual-write helpers ----------------------------------------

    def ensure_thread(
        self,
        *,
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

        if not role_can_view(role, str(t.locked_side)):
            raise KeyError("restricted")

        # Reset unread for this viewer role.
        try:
            self._set_thread_unread(thread=t, viewer_role=role, unread=0, last_read_ts=timezone.now())
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
            state = InboxThreadReadState.objects.filter(thread=t, viewer_role=str(role)).first()
            if state is None:
                baseline = now - timedelta(microseconds=1)
                InboxThreadReadState.objects.create(
                    thread=t,
                    viewer_role=str(role),
                    last_read_ts=baseline,
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
