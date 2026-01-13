"""In-memory reply store (dev/demo).

Replace with DB persistence later.
Keyed by post_id.

Important: this store does NOT enforce visibility — caller must enforce before create.
"""

from __future__ import annotations

import time
from typing import Dict, List, Optional

from .models_stub import ReplyRecord


class ReplyStore:
    def __init__(self) -> None:
        self._by_post: Dict[str, List[ReplyRecord]] = {}

    def create(self, post_id: str, author_id: str, text: str, *, client_key: Optional[str] = None) -> ReplyRecord:
        rec = ReplyRecord(
            id=f"r_{int(time.time()*1000)}",
            post_id=post_id,
            author_id=author_id,
            text=text,
            created_at=time.time(),
            client_key=client_key,
        )
        self._by_post.setdefault(post_id, []).append(rec)
        return rec

    def list_for_post(self, post_id: str) -> List[ReplyRecord]:
        return list(self._by_post.get(post_id, []))

    def count_for_post(self, post_id: str) -> int:
        return len(self._by_post.get(post_id, []))

    def total(self) -> int:
        return sum(len(v) for v in self._by_post.values())
