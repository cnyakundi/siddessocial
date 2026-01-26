"""Inbox store interface (placeholder).

The UI contract needs durable behaviors:
- list threads (cursor pagination)
- get thread (messages pagination)
- ensure thread (DM bootstrap)
- send message
- set locked side (move thread)

In production, this will be DB-backed (Django models). In dev, we can use an in-memory
store similar to other Siddes stubs.

This file intentionally avoids Django imports so it stays reusable.
"""

from __future__ import annotations

from typing import List, Optional, Protocol, Tuple

from .models_stub import MessageRecord, ParticipantRecord, SideId, ThreadMetaRecord, ThreadRecord


class InboxStore(Protocol):
    def list_threads(
        self,
        *,
        viewer_id: str,
        side: Optional[SideId] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> Tuple[List[ThreadRecord], bool, Optional[str]]:
        """Return (items, has_more, next_cursor)."""

    def get_thread(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        limit: int = 30,
        cursor: Optional[str] = None,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord, List[MessageRecord], bool, Optional[str]]:
        """Return (thread, meta, messages, messages_has_more, messages_next_cursor)."""

    def ensure_thread(
        self,
        *,
        viewer_id: str,
        other_token: str,
        locked_side: SideId,
        title: str,
        participant: ParticipantRecord,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord]:
        """Ensure a DM-style thread exists and return (thread, meta).

        Idempotent per (viewer_id, other_token). If the thread already exists,
        it should be returned without widening context (do not auto-change locked_side).
        """

    def send_message(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
        client_key: Optional[str] = None,
    ) -> Tuple[MessageRecord, ThreadMetaRecord]:
        """Return (message, meta)."""

    def set_locked_side(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        side: SideId,
    ) -> ThreadMetaRecord:
        """Move thread to a new locked side and return updated meta."""
