"""Post model stub (framework-agnostic).

In Django this becomes:
- id (uuid)
- author FK
- side
- text
- set_id (optional)
- urgent bool
- created_at
- client_key (unique per author for idempotency)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Literal

SideId = Literal["public", "friends", "close", "work"]

@dataclass
class PostRecord:
    id: str
    author_id: str
    side: SideId
    text: str
    created_at: float
    set_id: Optional[str] = None
    public_channel: Optional[str] = None
    urgent: bool = False
    client_key: Optional[str] = None
    echo_of_post_id: Optional[str] = None
