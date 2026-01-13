"""Store selector for Posts + Replies (sd_146a).

Default remains in-memory for safety.

Modes (SD_POST_STORE):
- memory: use in-memory stores (dev/demo)
- db: use Django ORM stores
- auto: prefer DB when reachable + migrated, otherwise fall back to memory
"""

from __future__ import annotations

import os


def _db_ready() -> bool:
    """Best-effort check: is DB reachable and are post tables migrated?

    In auto mode, we fall back to memory on any failure.
    """
    try:
        from django.db import connections

        conn = connections["default"]
        conn.ensure_connection()

        from .models import Post

        Post.objects.using(conn.alias).all()[:1].exists()
        return True
    except Exception:
        return False


STORE_MODE = os.environ.get("SD_POST_STORE", "memory").strip().lower()
USE_AUTO = STORE_MODE in ("auto", "smart")
AUTO_DB_READY = _db_ready() if USE_AUTO else False

USE_MEMORY = STORE_MODE in ("memory", "inmemory") or (USE_AUTO and not AUTO_DB_READY)
USE_DB = STORE_MODE in ("db", "database", "postgres", "pg") or (USE_AUTO and AUTO_DB_READY)

if USE_DB:
    from .store_db import DbPostStore, DbReplyStore

    POST_STORE = DbPostStore()
    REPLY_STORE = DbReplyStore()
else:
    from siddes_posts.store import PostStore
    from siddes_reply.store import ReplyStore

    POST_STORE = PostStore()
    REPLY_STORE = ReplyStore()
