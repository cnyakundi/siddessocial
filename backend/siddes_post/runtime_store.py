"""Runtime in-memory stores for Posts + Replies (dev/demo)."""

from __future__ import annotations

from siddes_posts.store import PostStore
from siddes_reply.store import ReplyStore

POST_STORE = PostStore()
REPLY_STORE = ReplyStore()
