"""Post detail endpoint stub (framework-agnostic).

Inputs:
- viewer_id
- post_id

Steps:
1) load post record (author_id, side)
2) build VisibilityContext for viewer and author
3) check can_view_post
4) return post content or forbidden

Real Django wiring:
- query post by id
- compute membership sets (friends/close/work) for author->viewer
- enforce can_view_post
"""

from __future__ import annotations

from typing import Any, Dict

from siddes_visibility.policy import VisibilityContext, can_view_post
from siddes_feed.mock_db import RELATIONSHIPS, POST_CONTENT, MOCK_POSTS


def get_post(post_id: str):
    for p in MOCK_POSTS:
        if p.id == post_id:
            return p
    return None


def get_post_detail(viewer_id: str, post_id: str) -> Dict[str, Any]:
    p = get_post(post_id)
    if not p:
        return {"ok": False, "status": 404, "error": "not_found"}

    rel = RELATIONSHIPS.get(p.author_id) or {"friends": set(), "close": set(), "work": set()}
    ctx = VisibilityContext(
        viewer_id=viewer_id,
        author_id=p.author_id,
        author_friends=set(rel.get("friends") or set()),
        author_close=set(rel.get("close") or set()),
        author_work=set(rel.get("work") or set()),
    )

    if not can_view_post(p.side, ctx):
        return {"ok": False, "status": 403, "error": "forbidden"}

    content = POST_CONTENT.get(p.id, {})
    return {
        "ok": True,
        "status": 200,
        "post": {
            "id": p.id,
            "author_id": p.author_id,
            "side": p.side,
            "author": content.get("author", p.author_id),
            "text": content.get("text", ""),
        },
    }
