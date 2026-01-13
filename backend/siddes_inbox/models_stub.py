"""Inbox model stubs (framework-agnostic).

These are the durable *shapes* the frontend expects (see `docs/INBOX_BACKEND_CONTRACT.md`).

In Django, this becomes models roughly like:
- InboxThread (id, locked_side, updated_at)
- InboxMessage (id, thread FK, sender FK, text, ts)
- InboxParticipant (thread FK OR derived from users/groups)
- InboxUnreadState (thread FK, viewer FK, last_read_ts)

Note: naming here is intentionally simple and mirrors the contract.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Literal

SideId = Literal["public", "friends", "close", "work"]


@dataclass
class ParticipantRecord:
    """The UI uses this to render thread identity consistently."""

    display_name: str
    initials: str
    avatar_seed: Optional[str] = None
    # Real backend optional fields (not required by contract)
    user_id: Optional[str] = None
    handle: Optional[str] = None


@dataclass
class ThreadRecord:
    """Thread list item (maps to `ThreadItem` in the contract)."""

    id: str
    title: str
    participant: ParticipantRecord
    locked_side: SideId
    last: str
    time: str
    unread: int
    updated_at: int  # ms since epoch


@dataclass
class ThreadMetaRecord:
    locked_side: SideId
    updated_at: int  # ms since epoch


@dataclass
class MessageRecord:
    """Thread message item (maps to `ThreadMessage` in the contract)."""

    id: str
    thread_id: str
    ts: int  # ms since epoch
    from_id: str
    text: str
    side: SideId
    queued: bool = False
    client_key: Optional[str] = None
