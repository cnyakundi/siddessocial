from __future__ import annotations

from typing import Optional, Dict, Any

from siddes_reply.store import ReplyStore


def _can_view(viewer_id: str, post: Dict[str, Any]) -> bool:
    side = str(post.get("side") or "public").strip().lower()
    author_id = str(post.get("author_id") or "").strip()
    set_id = post.get("set_id")

    if not viewer_id:
        return False

    # Author can always view
    if author_id and viewer_id == author_id:
        return True

    if side == "public":
        return True

    # Non-public: require set membership (fail-closed)
    if set_id:
        try:
            from siddes_feed import mock_db  # type: ignore
            return bool(mock_db.set_allows(viewer_id, str(set_id)))
        except Exception:
            return False

    return False


def create_reply(
    store: ReplyStore,
    *,
    viewer_id: str,
    post_id: str,
    text: str,
    client_key: Optional[str] = None,
) -> Dict[str, Any]:
    # Dev-only reply endpoint stub (framework-agnostic).
    # Fail-closed: return 404 when post is not visible to viewer (avoid existence leaks).
    vid = str(viewer_id or "").strip()
    pid = str(post_id or "").strip()
    body = str(text or "").strip()

    if not pid or not body:
        return {"ok": False, "status": 400, "error": "bad_request"}

    try:
        from siddes_feed import mock_db  # type: ignore
        post = mock_db.get_post(pid)
    except Exception:
        post = None

    if not post:
        return {"ok": False, "status": 404, "error": "not_found"}

    if not _can_view(vid, post):
        return {"ok": False, "status": 404, "error": "not_found"}

    rec = store.create(pid, vid, body, client_key=client_key)
    return {
        "ok": True,
        "status": 201,
        "reply": {
            "id": str(getattr(rec, "id", "")),
            "post_id": pid,
            "author_id": vid,
            "text": body,
        },
    }
