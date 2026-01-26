"""Dev-only in-memory InboxStore.

Goal (sd_109):
- Give the Django Inbox routes *real* demo content (threads, messages, unread, pagination)
  without introducing a DB yet.
- Keep the safety rule: if viewer identity is unknown, endpoints return `restricted: true`.
  (That enforcement lives in the router/endpoint layer, not the store.)

Notes:
- This store is per-process memory. It is meant for local dev + demos only.
- Shapes mirror `docs/INBOX_BACKEND_CONTRACT.md`.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import DefaultDict, Dict, List, Optional, Tuple
from collections import defaultdict

from .models_stub import MessageRecord, ParticipantRecord, SideId, ThreadMetaRecord, ThreadRecord


# ---------------------------------------------------------------------------
# Visibility shim (dev/stub)
# ---------------------------------------------------------------------------
#
# Siddes non-negotiable: Close/Work must never leak server-side.
#
# In dev/stub mode we don't have real relationship graphs yet, so we enforce a
# deterministic role-based policy using normalized viewer roles:
#   anon | friends | close | work | me
#
# The canonical mapping lives in `backend/siddes_inbox/visibility_stub.py` and is
# mirrored in `frontend/src/lib/server/inboxVisibility.ts`.

from .visibility_stub import ViewerRole, resolve_viewer_role, role_can_view


def _viewer_role(viewer_id: str) -> ViewerRole:
    # Viewer ids are normalized in DRF (`get_viewer_id`), but keep this safe.
    return resolve_viewer_role(viewer_id) or "anon"

def _role_can_view(role: ViewerRole, side: SideId) -> bool:
    """Compatibility shim.

    Some overlay checks grep for `_role_can_view(...)` usage.
    Canonical policy lives in `visibility_stub.role_can_view`.
    """
    return bool(role_can_view(role, side))


def _now_ms() -> int:
    return int(time.time() * 1000)


def _age_label(now_ms: int, ts_ms: int) -> str:
    """Human-ish relative label used by the UI (e.g., 2m, 1h, 3d)."""
    delta = max(0, now_ms - ts_ms)
    mins = delta // 60000
    if mins < 60:
        return f"{max(1, mins)}m" if mins > 0 else "now"
    hours = mins // 60
    if hours < 24:
        return f"{hours}h"
    days = hours // 24
    return f"{days}d"


@dataclass
class _ThreadCore:
    id: str
    title: str
    participant: ParticipantRecord
    locked_side: SideId
    updated_at: int


class InMemoryInboxStore:
    def __init__(self) -> None:
        self._threads: Dict[str, _ThreadCore] = {}
        self._messages: Dict[str, List[MessageRecord]] = {}
        self._unread: DefaultDict[str, Dict[str, int]] = defaultdict(dict)
        # Idempotent DM mapping: (viewer_id, other_token) -> thread_id
        self._dm_index: Dict[Tuple[str, str], str] = {}

    # --- helpers -----------------------------------------------------

    def _thread_last(self, thread_id: str) -> str:
        msgs = self._messages.get(thread_id) or []
        if not msgs:
            return ""
        return msgs[-1].text

    def _thread_record(self, *, viewer_id: str, thread_id: str, now_ms: int) -> ThreadRecord:
        core = self._threads[thread_id]
        unread = int(self._unread.get(viewer_id, {}).get(thread_id, 0))
        return ThreadRecord(
            id=core.id,
            title=core.title,
            participant=core.participant,
            locked_side=core.locked_side,
            last=self._thread_last(thread_id),
            time=_age_label(now_ms, core.updated_at),
            unread=unread,
            updated_at=core.updated_at,
        )

    # --- InboxStore-like API ----------------------------------------

    def list_threads(
        self,
        *,
        viewer_id: str,
        side: Optional[SideId] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> Tuple[List[ThreadRecord], bool, Optional[str]]:
        limit = max(1, min(int(limit), 50))
        now_ms = _now_ms()

        role = _viewer_role(viewer_id)

        ids = list(self._threads.keys())

        # Enforce visibility server-side (dev/stub policy).
        ids = [tid for tid in ids if _role_can_view(role, self._threads[tid].locked_side)]
        if side:
            ids = [tid for tid in ids if self._threads[tid].locked_side == side]

        items = [self._thread_record(viewer_id=viewer_id, thread_id=tid, now_ms=now_ms) for tid in ids]

        # Order by updatedAt DESC, id DESC
        items.sort(key=lambda t: (t.updated_at, t.id), reverse=True)

        if cursor:
            try:
                ts_s, cid = cursor.split(":", 1)
                ts = int(ts_s)
                cur_tuple = (ts, cid)
                # return items strictly AFTER this cursor in the ordering
                items = [t for t in items if (t.updated_at, t.id) < cur_tuple]
            except Exception:
                # Bad cursor -> ignore (dev-only tolerance)
                pass

        page = items[:limit]
        has_more = len(items) > limit
        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = f"{last.updated_at}:{last.id}"
        return page, has_more, next_cursor

    def get_thread(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        limit: int = 30,
        cursor: Optional[str] = None,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord, List[MessageRecord], bool, Optional[str]]:
        if thread_id not in self._threads:
            raise KeyError(f"unknown thread: {thread_id}")

        role = _viewer_role(viewer_id)
        if not _role_can_view(role, self._threads[thread_id].locked_side):
            # Hide existence details for safety.
            raise KeyError("restricted")

        # Read semantics: opening the thread clears unread for the viewer.
        self._unread[viewer_id][thread_id] = 0

        msgs = list(self._messages.get(thread_id) or [])
        # Ensure ascending time order
        msgs.sort(key=lambda m: (m.ts, m.id))

        limit = max(1, min(int(limit), 100))

        cutoff: Optional[Tuple[int, str]] = None
        if cursor:
            try:
                ts_s, mid = cursor.split(":", 1)
                cutoff = (int(ts_s), mid)
            except Exception:
                cutoff = None

        eligible = msgs
        if cutoff is not None:
            eligible = [m for m in msgs if (m.ts, m.id) < cutoff]

        # We return the most recent page among eligible older messages.
        page = eligible[-limit:]
        has_more = len(eligible) > limit
        next_cursor = None
        if has_more and page:
            oldest = page[0]
            next_cursor = f"{oldest.ts}:{oldest.id}"

        now_ms = _now_ms()
        thread = self._thread_record(viewer_id=viewer_id, thread_id=thread_id, now_ms=now_ms)
        meta = ThreadMetaRecord(locked_side=self._threads[thread_id].locked_side, updated_at=self._threads[thread_id].updated_at)
        return thread, meta, page, has_more, next_cursor

    def ensure_thread(
        self,
        *,
        viewer_id: str,
        other_token: str,
        locked_side: SideId,
        title: str,
        participant: ParticipantRecord,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord]:
        """Ensure a DM-style thread exists (dev memory store).

        Idempotent per (viewer_id, other_token). If an existing thread is found,
        we return it without changing locked_side.
        """

        v = str(viewer_id or "").strip()
        tok = str(other_token or "").strip().lower()
        if not v or not tok:
            raise KeyError("restricted")

        key = (v, tok)
        now_ms = _now_ms()

        existing = self._dm_index.get(key)
        if existing and existing in self._threads:
            core = self._threads[existing]
            thread = self._thread_record(viewer_id=v, thread_id=existing, now_ms=now_ms)
            meta = ThreadMetaRecord(locked_side=str(core.locked_side), updated_at=int(core.updated_at))
            return thread, meta

        tid = f"t_dm_{uuid.uuid4().hex[:10]}"
        p = participant
        t = str(title or "").strip() or str(p.display_name or "").strip() or "Message"

        self._threads[tid] = _ThreadCore(
            id=tid,
            title=t,
            participant=p,
            locked_side=locked_side,
            updated_at=now_ms,
        )
        self._messages[tid] = []
        self._dm_index[key] = tid

        thread = self._thread_record(viewer_id=v, thread_id=tid, now_ms=now_ms)
        meta = ThreadMetaRecord(locked_side=str(locked_side), updated_at=int(now_ms))
        return thread, meta


    def send_message(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
        client_key: Optional[str] = None,
    ) -> Tuple[MessageRecord, ThreadMetaRecord]:
        if thread_id not in self._threads:
            raise KeyError(f"unknown thread: {thread_id}")

        role = _viewer_role(viewer_id)
        core = self._threads[thread_id]
        if not _role_can_view(role, core.locked_side):
            raise KeyError("restricted")

        now = _now_ms()
        # `core` set above

        msg = MessageRecord(
            id=f"m_{uuid.uuid4().hex[:10]}",
            thread_id=thread_id,
            ts=now,
            from_id="me",
            text=text,
            side=core.locked_side,
            queued=False,
            client_key=client_key,
        )
        self._messages.setdefault(thread_id, []).append(msg)

        # Update thread freshness
        core.updated_at = now

        # Sender sees unread cleared.
        self._unread[viewer_id][thread_id] = 0

        meta = ThreadMetaRecord(locked_side=core.locked_side, updated_at=core.updated_at)
        return msg, meta

    def set_locked_side(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        side: SideId,
    ) -> ThreadMetaRecord:
        if thread_id not in self._threads:
            raise KeyError(f"unknown thread: {thread_id}")

        role = _viewer_role(viewer_id)
        if role != "me":
            # Only the owning user can move a thread between Sides.
            raise KeyError("restricted")

        core = self._threads[thread_id]
        core.locked_side = side
        core.updated_at = _now_ms()

        # Move operation does not create unread by itself.
        self._unread[viewer_id][thread_id] = int(self._unread[viewer_id].get(thread_id, 0))

        return ThreadMetaRecord(locked_side=core.locked_side, updated_at=core.updated_at)

    # --- seeding -----------------------------------------------------

    def seed_demo(self) -> None:
        """Seed a small realistic demo inbox."""
        now = _now_ms()

        def add_thread(
            tid: str,
            title: str,
            initials: str,
            locked_side: SideId,
            avatar_seed: str,
            unread: int,
            messages: List[Tuple[int, str, str]],  # (minutes_ago, from, text)
        ) -> None:
            participant = ParticipantRecord(display_name=title, initials=initials, avatar_seed=avatar_seed)
            updated_at = now
            self._threads[tid] = _ThreadCore(
                id=tid,
                title=title,
                participant=participant,
                locked_side=locked_side,
                updated_at=updated_at,
            )
            self._messages[tid] = []
            for mins_ago, frm, txt in messages:
                ts = now - int(mins_ago) * 60000
                self._messages[tid].append(
                    MessageRecord(
                        id=f"m_{uuid.uuid4().hex[:10]}",
                        thread_id=tid,
                        ts=ts,
                        from_id=frm,
                        text=txt,
                        side=locked_side,
                        queued=False,
                    )
                )
            # Ensure updated_at reflects latest message
            if self._messages[tid]:
                latest = max(self._messages[tid], key=lambda m: (m.ts, m.id))
                self._threads[tid].updated_at = latest.ts
            self._unread["me"][tid] = unread

        # Friends
        add_thread(
            tid="t_friends_1",
            title="Marcus",
            initials="M",
            locked_side="friends",
            avatar_seed="seed_marcus",
            unread=1,
            messages=[
                (120, "them", "Yo — you free this weekend?"),
                (5, "them", "Count me in for Saturday!"),
            ],
        )

        # Work
        add_thread(
            tid="t_work_1",
            title="Work Group",
            initials="WG",
            locked_side="work",
            avatar_seed="seed_work_group",
            unread=0,
            messages=[
                (180, "them", "Updated the roadmap slides."),
                (12, "them", "Please review before standup."),
            ],
        )

        # Close
        add_thread(
            tid="t_close_1",
            title="Elena",
            initials="E",
            locked_side="close",
            avatar_seed="seed_elena",
            unread=2,
            messages=[
                (90, "them", "Coffee later?"),
                (35, "them", "Also—did you see that update?"),
                (8, "them", "Ping me when you're free."), 
            ],
        )

        # Public (rare, but possible)
        add_thread(
            tid="t_public_1",
            title="Tipline",
            initials="T",
            locked_side="public",
            avatar_seed="seed_tipline",
            unread=0,
            messages=[
                (240, "them", "Thanks for reaching out."), 
                (60, "them", "We received your message."), 
            ],
        )

    # --- dev debug helpers ------------------------------------------

    def debug_reset_unread(self, *, viewer_id: str, thread_id: str) -> None:
        """Dev-only: reset unread counter for a given viewer/thread."""
        if thread_id not in self._threads:
            raise KeyError(f"unknown thread: {thread_id}")
        self._unread[viewer_id][thread_id] = 0

    def debug_append_incoming(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
    ):
        """Dev-only: append an incoming message from `them` and increment unread."""
        if thread_id not in self._threads:
            raise KeyError(f"unknown thread: {thread_id}")

        now = _now_ms()
        core = self._threads[thread_id]

        msg = MessageRecord(
            id=f"m_{uuid.uuid4().hex[:10]}",
            thread_id=thread_id,
            ts=now,
            from_id="them",
            text=text,
            side=core.locked_side,
            queued=False,
        )
        self._messages.setdefault(thread_id, []).append(msg)

        # Update thread freshness
        core.updated_at = now

        # Increment unread for viewer
        current = int(self._unread.get(viewer_id, {}).get(thread_id, 0))
        self._unread[viewer_id][thread_id] = current + 1

        meta = ThreadMetaRecord(locked_side=core.locked_side, updated_at=core.updated_at)
        return msg, meta
