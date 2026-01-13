"""Inbox store interface (placeholder).

The UI contract needs 4 durable behaviors:
- list threads (cursor pagination)
- get thread (messages pagination)
- send message
- set locked side (move thread)

In production, this will be DB-backed (Django models). In dev, we can use an in-memory
store similar to other Siddes stubs.

This file intentionally avoids Django imports so it stays reusable.
"""

from __future__ import annotations

from typing import Optional, Protocol, Tuple, List

from .models_stub import SideId, ThreadRecord, ThreadMetaRecord, MessageRecord


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
