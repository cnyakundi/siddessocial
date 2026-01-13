from __future__ import annotations

from typing import Any, Dict, List

from siddes_visibility.policy import SideId, Post as VPost, filter_visible_posts
from siddes_post.runtime_store import POST_STORE
from .mock_db import MOCK_POSTS, RELATIONSHIPS, POST_CONTENT


def _author_label(author_id: str) -> str:
    return "Founder" if author_id == "me" else author_id


def _handle(author_id: str) -> str:
    return "@founder" if author_id == "me" else f"@{author_id}"


def _hydrate_from_mock(p: VPost) -> Dict[str, Any]:
    c = POST_CONTENT.get(p.id, {})
    author = str(c.get("author") or _author_label(p.author_id))
    text = str(c.get("text") or "")
    return {"id": p.id, "author": author, "handle": _handle(p.author_id), "time": "now", "content": text, "kind": "text", "signals": 0}


def _hydrate_from_record(rec) -> Dict[str, Any]:
    author_id = str(getattr(rec, "author_id", "") or "")
    out: Dict[str, Any] = {
        "id": rec.id,
        "author": _author_label(author_id),
        "handle": _handle(author_id),
        "time": "now",
        "content": rec.text,
        "kind": "text",
        "signals": 0,
    }
    if getattr(rec, "set_id", None):
        out["setId"] = rec.set_id
    if getattr(rec, "urgent", False):
        out["urgent"] = True
    if getattr(rec, "side", "") == "public":
        out["trustLevel"] = 3 if author_id == "me" else 1
    return out


def list_feed(viewer_id: str, side: SideId) -> Dict[str, Any]:
    store_recs = [r for r in POST_STORE.list() if r.side == side]
    store_posts = [VPost(id=r.id, author_id=r.author_id, side=r.side) for r in store_recs]

    candidates = [p for p in MOCK_POSTS if p.side == side] + store_posts
    visible = filter_visible_posts(candidates, viewer_id, relationships=RELATIONSHIPS)

    by_id = {r.id: r for r in store_recs}

    items: List[dict] = []
    for p in visible:
        rec = by_id.get(p.id)
        items.append(_hydrate_from_record(rec) if rec is not None else _hydrate_from_mock(p))

    return {"side": side, "count": len(items), "items": items}
