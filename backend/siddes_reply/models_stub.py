"""Reply model stub (framework-agnostic).

In Django this becomes a model like:
- id (uuid)
- post FK
- author FK (viewer)
- text
- created_at
- optional: status (queued/sent), client_idempotency_key
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class ReplyRecord:
    id: str
    post_id: str
    author_id: str
    text: str
    created_at: float
    parent_id: Optional[str] = None
    depth: int = 0
    status: str = "created"  # created|queued|sent
    client_key: Optional[str] = None
