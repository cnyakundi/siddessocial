"""DB-backed stores for Posts + Replies (sd_146a).

Notes:
- Visibility enforcement remains above the store layer (in views).
- Reply creation requires the Post to exist in DB (FK integrity).

sd_435:
- Fix DbPostStore.create corruption (undefined vars + invalid fields).
- Ensure Reply threading fields (parent/depth) are persisted.
"""

from __future__ import annotations

import time
import uuid
from typing import List, Optional

from .models import Post, Reply


def _new_post_id() -> str:
    return f"p_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}"


def _new_reply_id() -> str:
    return f"r_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}"


def _clean_echo_of_post_id(v: Optional[str]) -> Optional[str]:
    """Normalize echo_of_post_id inputs.

    - If caller passes None, keep NULL in DB (do NOT persist the string "None").
    - Blank and sentinel strings (none/null/0) are treated as empty.
    """
    if v is None:
        return None
    try:
        s = str(v).strip()
    except Exception:
        return None
    if not s:
        return None
    low = s.lower()
    if low in ("none", "null", "0"):
        return None
    return s


class DbPostStore:
    def create(
        self,
        *,
        author_id: str,
        side: str,
        text: str,
        set_id: Optional[str] = None,
        public_channel: Optional[str] = None,
        urgent: bool = False,
        client_key: Optional[str] = None,
        echo_of_post_id: Optional[str] = None,
    ) -> Post:
        ck = (client_key or "").strip() or None
        if ck:
            existing = Post.objects.filter(author_id=author_id, client_key=ck).first()
            if existing:
                return existing

        rec = Post(
            id=_new_post_id(),
            author_id=author_id,
            side=side,
            text=text,
            set_id=set_id,
            public_channel=public_channel,
            urgent=urgent,
            created_at=time.time(),
            client_key=ck,
            echo_of_post_id=_clean_echo_of_post_id(echo_of_post_id),
        )
        rec.save()
        return rec

    def delete_by_author_client_key(self, *, author_id: str, client_key: str) -> int:
        """Delete a post by (author_id, client_key). Returns number deleted."""
        ck = (client_key or "").strip()
        if not ck:
            return 0
        qs = Post.objects.filter(author_id=str(author_id), client_key=ck)
        n = int(qs.count())
        if n:
            qs.delete()
        return n

    def get(self, post_id: str) -> Optional[Post]:
        return Post.objects.filter(id=post_id).first()

    def list(self, *, side: Optional[str] = None, limit: int = 200) -> List[Post]:
        qs = Post.objects.all()
        if side:
            qs = qs.filter(side=side)
        return list(qs.order_by("-created_at")[:limit])

    def total(self) -> int:
        return Post.objects.count()


class DbReplyStore:
    def create(
        self,
        post_id: str,
        author_id: str,
        text: str,
        *,
        client_key: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> Reply:
        ck = (client_key or "").strip() or None
        if ck:
            existing = Reply.objects.filter(post_id=post_id, author_id=author_id, client_key=ck).first()
            if existing:
                return existing

        post = Post.objects.filter(id=post_id).first()
        if post is None:
            raise ValueError(f"post_not_found:{post_id}")

        parent = None
        depth = 0
        pid = (parent_id or "").strip() or None
        if pid:
            parent = Reply.objects.filter(id=pid, post_id=post_id).first()
            if parent is None:
                raise ValueError(f"parent_not_found:{pid}")
            # Facebook-style: one nesting level only
            # sd_953c: allow replying to replies (removed one-level cap)
            depth = int(getattr(parent, "depth", 0) or 0) + 1
            if depth > 25:
                raise ValueError("parent_too_deep")
        rec = Reply(
            id=_new_reply_id(),
            post=post,
            parent=parent,
            author_id=author_id,
            text=text,
            created_at=time.time(),
            depth=depth,
            client_key=ck,
            status="created",
        )
        rec.save()
        return rec

    def list_for_post(self, post_id: str) -> List[Reply]:
        return list(Reply.objects.filter(post_id=post_id).order_by("created_at"))

    def count_for_post(self, post_id: str) -> int:
        return Reply.objects.filter(post_id=post_id).count()

    def total(self) -> int:
        return Reply.objects.count()
