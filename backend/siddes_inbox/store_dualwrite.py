"""Dual-write InboxStore (dev helper).

Goal (sd_121d):
- Keep SD_INBOX_STORE=memory as the *read* source of truth (fast seeded demos)
- Mirror write operations into the DB store best-effort, to prep a safe cutover.

This is intentionally forgiving:
- If the DB is unavailable / migrations not applied, reads still work.
- Shadow-write errors are swallowed.

Enable:
- SD_INBOX_STORE=memory
- SD_INBOX_DUALWRITE_DB=1

Notes:
- The DB store now tracks unread per-viewer (sd_121e scaffold), so parity is
  "good enough" for cutover prep.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from .models_stub import MessageRecord, ParticipantRecord, SideId, ThreadMetaRecord, ThreadRecord
from .store_db import DbInboxStore
from .store_memory import InMemoryInboxStore


class DualWriteInboxStore:
    """Read from `primary`, mirror writes to `shadow_db` best-effort."""

    def __init__(self, *, primary: InMemoryInboxStore, shadow_db: DbInboxStore) -> None:
        self.primary = primary
        self.shadow_db = shadow_db

    # --- seed -------------------------------------------------------

    def seed_demo(self) -> None:
        fn = getattr(self.primary, "seed_demo", None)
        if callable(fn):
            fn()

    # --- reads ------------------------------------------------------

    def list_threads(
        self,
        *,
        viewer_id: str,
        side: Optional[SideId] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> Tuple[List[ThreadRecord], bool, Optional[str]]:
        return self.primary.list_threads(viewer_id=viewer_id, side=side, limit=limit, cursor=cursor)

    def get_thread(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        limit: int = 30,
        cursor: Optional[str] = None,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord, List[MessageRecord], bool, Optional[str]]:
        return self.primary.get_thread(viewer_id=viewer_id, thread_id=thread_id, limit=limit, cursor=cursor)

    # --- write helpers ---------------------------------------------

    def _shadow_thread_snapshot(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        side_hint: Optional[SideId],
    ) -> tuple[Optional[str], Optional[ParticipantRecord], Optional[SideId]]:
        """Best-effort: fetch a title/participant snapshot from the primary store."""

        try:
            # Prefer listThreads (no side effects like clearing unread)
            items, _, _ = self.primary.list_threads(viewer_id=viewer_id, side=side_hint, limit=200, cursor=None)
            for t in items:
                if getattr(t, "id", None) == thread_id:
                    return (t.title, t.participant, t.locked_side)
        except Exception:
            pass

        try:
            # Fallback to getThread (may clear unread in primary; acceptable for dev)
            thread, meta, _msgs, _hm, _nc = self.primary.get_thread(viewer_id=viewer_id, thread_id=thread_id, limit=1, cursor=None)
            return (thread.title, thread.participant, meta.locked_side)
        except Exception:
            return (None, None, None)

    def _shadow_ensure_thread(self, *, viewer_id: str, thread_id: str, side_hint: Optional[SideId]) -> None:
        try:
            title, participant, locked = self._shadow_thread_snapshot(viewer_id=viewer_id, thread_id=thread_id, side_hint=side_hint)
            locked_side: SideId = (locked or side_hint or "friends")  # type: ignore[assignment]
            self.shadow_db.ensure_thread(
                thread_id=thread_id,
                locked_side=locked_side,
                title=str(title or ""),
                participant=participant,
            )
        except Exception:
            # swallow
            return

    # --- writes -----------------------------------------------------

    def send_message(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
        client_key: Optional[str] = None,
    ) -> Tuple[MessageRecord, ThreadMetaRecord]:
        msg, meta = self.primary.send_message(
            viewer_id=viewer_id,
            thread_id=thread_id,
            text=text,
            client_key=client_key,
        )

        try:
            self._shadow_ensure_thread(viewer_id=viewer_id, thread_id=thread_id, side_hint=meta.locked_side)
            self.shadow_db.send_message(
                viewer_id=viewer_id,
                thread_id=thread_id,
                text=text,
                client_key=client_key,
            )
        except Exception:
            pass

        return msg, meta

    def set_locked_side(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        side: SideId,
    ) -> ThreadMetaRecord:
        meta = self.primary.set_locked_side(viewer_id=viewer_id, thread_id=thread_id, side=side)

        try:
            self._shadow_ensure_thread(viewer_id=viewer_id, thread_id=thread_id, side_hint=side)
            self.shadow_db.set_locked_side(viewer_id=viewer_id, thread_id=thread_id, side=side)
        except Exception:
            pass

        return meta

    # --- dev debug helpers ------------------------------------------

    def debug_reset_unread(self, *, viewer_id: str, thread_id: str) -> None:
        fn = getattr(self.primary, "debug_reset_unread", None)
        if callable(fn):
            fn(viewer_id=viewer_id, thread_id=thread_id)

        try:
            self.shadow_db.debug_reset_unread(viewer_id=viewer_id, thread_id=thread_id)  # type: ignore[attr-defined]
        except Exception:
            pass

    def debug_append_incoming(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
    ):
        fn = getattr(self.primary, "debug_append_incoming", None)
        if not callable(fn):
            raise NotImplementedError("primary store missing debug_append_incoming")

        msg, meta = fn(viewer_id=viewer_id, thread_id=thread_id, text=text)

        try:
            self._shadow_ensure_thread(viewer_id=viewer_id, thread_id=thread_id, side_hint=meta.locked_side)
            self.shadow_db.debug_append_incoming(viewer_id=viewer_id, thread_id=thread_id, text=text)  # type: ignore[attr-defined]
        except Exception:
            pass

        return msg, meta
