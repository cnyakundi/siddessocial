"""Dev-null InboxStore.

The sd_108 goal is to bootstrap Django + route wiring while keeping the Inbox
endpoints **default-safe**.

Until sd_109+ lands (in-memory or DB-backed store + auth), the endpoint stub
functions still return `restricted: true` so no content leaks.

We keep a concrete store object here so the router wiring is real and ready.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from .models_stub import MessageRecord, ParticipantRecord, SideId, ThreadMetaRecord, ThreadRecord


class DevNullInboxStore:
    def list_threads(
        self,
        *,
        viewer_id: str,
        side: Optional[SideId] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> Tuple[List[ThreadRecord], bool, Optional[str]]:
        raise NotImplementedError("Inbox store not implemented yet (sd_109+)")

    def get_thread(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        limit: int = 30,
        cursor: Optional[str] = None,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord, List[MessageRecord], bool, Optional[str]]:
        raise NotImplementedError("Inbox store not implemented yet (sd_109+)")

    def ensure_thread(
        self,
        *,
        viewer_id: str,
        other_token: str,
        locked_side: SideId,
        title: str,
        participant: ParticipantRecord,
    ) -> Tuple[ThreadRecord, ThreadMetaRecord]:
        raise NotImplementedError("Inbox store not implemented yet (sd_109+)")

    def send_message(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        text: str,
        client_key: Optional[str] = None,
    ) -> Tuple[MessageRecord, ThreadMetaRecord]:
        raise NotImplementedError("Inbox store not implemented yet (sd_109+)")

    def set_locked_side(
        self,
        *,
        viewer_id: str,
        thread_id: str,
        side: SideId,
    ) -> ThreadMetaRecord:
        raise NotImplementedError("Inbox store not implemented yet (sd_109+)")
