'''Store selector for Posts + Replies.

World-ready rule:
- Default to DB-backed stores in Django runtime.
- Memory stores are allowed ONLY when:
  * Django is configured AND DEBUG=True AND SIDDES_ALLOW_MEMORY_STORES=1

Tooling rule (dev scripts):
- When Django isn't configured (e.g. scripts/dev/* selftests), fall back to memory stores
  so standalone tooling can run without requiring a full Django setup.
'''

from __future__ import annotations

import os


def _django_ready_and_debug() -> tuple[bool, bool]:
    # Return (django_ready, debug). Safe if Django isn't installed/configured.
    try:
        from django.conf import settings  # type: ignore
        from django.core.exceptions import ImproperlyConfigured  # type: ignore
    except Exception:
        return (False, False)

    try:
        # Touch a setting to force configuration
        _ = getattr(settings, "INSTALLED_APPS", None)
    except ImproperlyConfigured:
        return (False, False)
    except Exception:
        return (False, False)

    try:
        dbg = bool(getattr(settings, "DEBUG", False))
    except Exception:
        dbg = False

    return (True, dbg)


django_ready, debug = _django_ready_and_debug()

allow_memory_env = str(os.environ.get("SIDDES_ALLOW_MEMORY_STORES", "")).strip() == "1"
ALLOW_MEMORY = (allow_memory_env and debug) or (not django_ready)

if ALLOW_MEMORY:
    # Dev-only fallback (or standalone tooling)
    from siddes_posts.store import PostStore
    from siddes_reply.store import ReplyStore

    POST_STORE = PostStore()
    REPLY_STORE = ReplyStore()
else:
    # Production truth (DB)
    from .store_db import DbPostStore, DbReplyStore

    POST_STORE = DbPostStore()
    REPLY_STORE = DbReplyStore()
