"""Store selector for Posts + Replies.

World-ready rule:
- Default to DB-backed stores in ALL environments.
- Memory stores are allowed ONLY when:
  * DEBUG=True AND SIDDES_ALLOW_MEMORY_STORES=1

Rationale:
- Eliminates silent fallback to fake/demo data.
"""

from __future__ import annotations

import os
from django.conf import settings

ALLOW_MEMORY = (str(os.environ.get('SIDDES_ALLOW_MEMORY_STORES', '')).strip() == '1') and bool(getattr(settings, 'DEBUG', False))

if ALLOW_MEMORY:
    # Optional dev-only fallback
    from siddes_posts.store import PostStore
    from siddes_reply.store import ReplyStore
    POST_STORE = PostStore()
    REPLY_STORE = ReplyStore()
else:
    from .store_db import DbPostStore, DbReplyStore
    POST_STORE = DbPostStore()
    REPLY_STORE = DbReplyStore()
