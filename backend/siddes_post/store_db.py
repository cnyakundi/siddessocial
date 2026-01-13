"""DB-backed stores for Posts + Replies (sd_146a).

Notes:
- Visibility enforcement remains above the store layer (in views).
- Reply creation requires the Post to exist in DB (FK integrity).
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


class DbPostStore:
    def create(
        self,
        *,
        author_id: str,
        side: str,
        text: str,
        set_id: Optional[str] = None,
        urgent: bool = False,
        client_key: Optional[str] = None,
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
            urgent=urgent,
            created_at=time.time(),
            client_key=ck,
        )
        rec.save()
        return rec

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
    def create(self, post_id: str, author_id: str, text: str, *, client_key: Optional[str] = None) -> Reply:
        ck = (client_key or "").strip() or None
        if ck:
            existing = Reply.objects.filter(post_id=post_id, author_id=author_id, client_key=ck).first()
            if existing:
                return existing

        post = Post.objects.filter(id=post_id).first()
        if post is None:
            raise ValueError(f"post_not_found:{post_id}")

        rec = Reply(
            id=_new_reply_id(),
            post=post,
            author_id=author_id,
            text=text,
            created_at=time.time(),
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
