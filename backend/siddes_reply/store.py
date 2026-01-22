"""In-memory reply store (dev/demo).

Replace with DB persistence later.
Keyed by post_id.

Important: this store does NOT enforce visibility — caller must enforce before create.

Compatibility:
- Supports optional parent_id + depth for one-level threading (matches DbReplyStore behavior).
- Supports client_key idempotency (best-effort for dev/demo).
"""

from __future__ import annotations

import time
from typing import Dict, List, Optional

from .models_stub import ReplyRecord


class ReplyStore:
    def __init__(self) -> None:
        self._by_post: Dict[str, List[ReplyRecord]] = {}

    def create(
        self,
        post_id: str,
        author_id: str,
        text: str,
        *,
        client_key: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> ReplyRecord:
        ck = (client_key or "").strip() or None

        # Idempotency (client_key) — helps on flaky networks / retries.
        if ck:
            for r in self._by_post.get(post_id, []):
                if r.author_id == author_id and r.client_key == ck:
                    return r

        pid = (parent_id or "").strip() or None
        parent = None
        depth = 0

        if pid:
            for r in self._by_post.get(post_id, []):
                if r.id == pid:
                    parent = r
                    break
            if parent is None:
                raise ValueError(f"parent_not_found:{pid}")

            # One nesting level only
            if getattr(parent, "parent_id", None):
                raise ValueError("parent_too_deep")

            depth = int(getattr(parent, "depth", 0) or 0) + 1
            if depth > 1:
                raise ValueError("parent_too_deep")

        rec = ReplyRecord(
            id=f"r_{int(time.time()*1000)}",
            post_id=post_id,
            author_id=author_id,
            text=text,
            created_at=time.time(),
            parent_id=pid,
            depth=depth,
            client_key=ck,
        )
        self._by_post.setdefault(post_id, []).append(rec)
        return rec

    def list_for_post(self, post_id: str) -> List[ReplyRecord]:
        return sorted(
            list(self._by_post.get(post_id, [])),
            key=lambda r: float(getattr(r, "created_at", 0.0) or 0.0),
        )

    def count_for_post(self, post_id: str) -> int:
        return len(self._by_post.get(post_id, []))

    def total(self) -> int:
        return sum(len(v) for v in self._by_post.values())
