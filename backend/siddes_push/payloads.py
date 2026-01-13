"""Push payload schema (Side-aware + glimpse).

Payload (v0, locked):
- title: str
- body: str
- url: str (deep link)
- side: one of public/friends/close/work
- glimpse: str (preview)
Optional: icon, image
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional


SideId = Literal["public", "friends", "close", "work"]


@dataclass
class PushPayload:
    title: str
    body: str
    url: str
    side: SideId
    glimpse: str
    icon: Optional[str] = None
    image: Optional[str] = None


def validate_payload(p: PushPayload) -> None:
    if not p.title or not isinstance(p.title, str):
        raise ValueError("title required")
    if not p.url.startswith("/"):
        raise ValueError("url must be a relative path starting with '/'")
    if p.side not in ("public", "friends", "close", "work"):
        raise ValueError("invalid side")
    if not p.glimpse or len(p.glimpse) < 2:
        raise ValueError("glimpse required")
