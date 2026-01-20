"""In-memory post store with idempotency (dev/demo).

Important:
- IDs must be collision-safe. Millisecond IDs can collide in fast tests.
"""

from __future__ import annotations

import time
import uuid
from typing import Dict, List, Optional, Tuple

from .models_stub import PostRecord, SideId


class PostStore:
    def __init__(self) -> None:
        self._posts: Dict[str, PostRecord] = {}  # id -> post
        self._by_author_key: Dict[Tuple[str, str], str] = {}  # (author_id, client_key) -> post_id

    def _new_id(self) -> str:
        # Collision-safe id: ms + random suffix
        return f"p_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}"

    def create(
        self,
        *,
        author_id: str,
        side: SideId,
        text: str,
        set_id: Optional[str] = None,
        public_channel: Optional[str] = None,
        urgent: bool = False,
        client_key: Optional[str] = None,
        echo_of_post_id: Optional[str] = None,
    ) -> PostRecord:
        if client_key:
            k = (author_id, client_key)
            existing_id = self._by_author_key.get(k)
            if existing_id:
                return self._posts[existing_id]

        post_id = self._new_id()
        rec = PostRecord(
            id=post_id,
            author_id=author_id,
            side=side,
            text=text,
            set_id=set_id,
            public_channel=public_channel,
            urgent=urgent,
            created_at=time.time(),
            client_key=client_key,
            echo_of_post_id=echo_of_post_id,
        )
        self._posts[post_id] = rec
        if client_key:
            self._by_author_key[(author_id, client_key)] = post_id
        return rec

    def delete_by_author_client_key(self, *, author_id: str, client_key: str) -> int:
        """Delete a post by (author_id, client_key). Returns number deleted."""
        ck = str(client_key or '').strip()
        if not ck:
            return 0
        key = (str(author_id or '').strip(), ck)
        pid = self._by_author_key.pop(key, None)
        if not pid:
            return 0
        if pid in self._posts:
            del self._posts[pid]
            return 1
        return 0

    def list(self) -> List[PostRecord]:
        return sorted(self._posts.values(), key=lambda p: p.created_at, reverse=True)

    def total(self) -> int:
        return len(self._posts)

    def get(self, post_id: str) -> Optional[PostRecord]:
        return self._posts.get(post_id)
