from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional, Set

from siddes_posts.models_stub import PostRecord

# Demo universe used ONLY by scripts/dev/* selftests.
# Guarded by SIDDES_DEMO_UNIVERSE=1 (or force=True).
# Keep this file framework-agnostic: no Django imports.

_DEMO_SETS: Dict[str, Dict[str, Any]] = {
    "set_fr_demo": {"side": "friends", "owner_id": "a", "members": {"v_friend"}},
    "set_cl_demo": {"side": "close", "owner_id": "a", "members": {"v_close"}},
    "set_wk_demo": {"side": "work", "owner_id": "a", "members": {"v_work"}},
}

_DEMO_POSTS: Dict[str, Dict[str, Any]] = {
    # Public
    "p_pub_1": {"id": "p_pub_1", "author_id": "a", "side": "public", "text": "Hello Public 1", "set_id": None},
    "p_pub_2": {"id": "p_pub_2", "author_id": "b", "side": "public", "text": "Hello Public 2", "set_id": None},
    # Friends (visible to v_friend via set membership)
    "p_fr_1": {"id": "p_fr_1", "author_id": "a", "side": "friends", "text": "Hello Friends 1", "set_id": "set_fr_demo"},
    "p_fr_2": {"id": "p_fr_2", "author_id": "a", "side": "friends", "text": "Hello Friends 2", "set_id": "set_fr_demo"},
    # Close (visible to v_close via set membership)
    "p_cl_1": {"id": "p_cl_1", "author_id": "a", "side": "close", "text": "Hello Close 1", "set_id": "set_cl_demo"},
    # Work (visible to v_work via set membership)
    "p_wk_1": {"id": "p_wk_1", "author_id": "a", "side": "work", "text": "Hello Work 1", "set_id": "set_wk_demo"},
}

_SEEDED = False


def get_post(post_id: str) -> Optional[Dict[str, Any]]:
    pid = str(post_id or "").strip()
    if not pid:
        return None
    return _DEMO_POSTS.get(pid)


def set_allows(viewer_id: str, set_id: Optional[str]) -> bool:
    sid = str(set_id or "").strip()
    if not sid:
        return False
    v = str(viewer_id or "").strip()
    if not v:
        return False

    s = _DEMO_SETS.get(sid)
    if not s:
        return False

    if v == str(s.get("owner_id") or "").strip():
        return True

    members: Set[str] = set(s.get("members") or set())
    return v in members


def ensure_seeded(*, force: bool = False) -> bool:
    # Seed the in-memory post store with deterministic demo posts.
    # No-ops unless:
    #   - force=True OR SIDDES_DEMO_UNIVERSE=1
    # AND the active store looks like an in-memory PostStore (has _posts dict).
    global _SEEDED
    if _SEEDED:
        return False

    if not force and str(os.environ.get("SIDDES_DEMO_UNIVERSE", "")).strip() != "1":
        return False

    try:
        from siddes_post.runtime_store import POST_STORE  # type: ignore
    except Exception:
        return False

    # Only seed memory store (avoid DB mode)
    if not hasattr(POST_STORE, "_posts"):
        return False

    try:
        POST_STORE._posts.clear()  # type: ignore[attr-defined]
        if hasattr(POST_STORE, "_by_author_key"):
            POST_STORE._by_author_key.clear()  # type: ignore[attr-defined]
    except Exception:
        pass

    now = time.time()
    order = ["p_pub_2", "p_pub_1", "p_fr_2", "p_fr_1", "p_cl_1", "p_wk_1"]
    for i, pid in enumerate(order):
        p = _DEMO_POSTS[pid]
        rec = PostRecord(
            id=str(p["id"]),
            author_id=str(p["author_id"]),
            side=str(p["side"]),  # type: ignore[arg-type]
            text=str(p["text"]),
            created_at=now - float(i * 60),
            set_id=p.get("set_id"),
            public_channel=None,
            urgent=False,
            client_key=None,
            echo_of_post_id=None,
        )
        try:
            POST_STORE._posts[rec.id] = rec  # type: ignore[attr-defined]
        except Exception:
            pass

    _SEEDED = True
    return True
