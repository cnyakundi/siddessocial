"""Reply endpoint stub (framework-agnostic).

Rules:
- Viewer must be allowed to view the target post (visibility policy).
- Do not create replies for forbidden viewers.

Return shape (v0):
- {ok: True, status: 201, reply: {...}}
- {ok: False, status: 404|403, error: "not_found"|"forbidden"}
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .store import ReplyStore


def create_reply(
    store: ReplyStore,
    *,
    viewer_id: str,
    post_id: str,
    text: str,
    client_key: Optional[str] = None,
    hide_existence: bool = False,
) -> Dict[str, Any]:
    """Create a reply if viewer can see the post.

    hide_existence=True returns 404 instead of 403 on forbidden.
    """
    t = (text or "").strip()
    if not t:
        return {"ok": False, "status": 400, "error": "empty_text"}

    from siddes_post.detail_stub import get_post_detail

    detail = get_post_detail(viewer_id, post_id)
    if not detail.get("ok"):
        # not_found or forbidden
        status = int(detail.get("status", 404))
        if hide_existence and status == 403:
            status = 404
        return {"ok": False, "status": status, "error": detail.get("error")}

    rec = store.create(post_id=post_id, author_id=viewer_id, text=t, client_key=client_key)
    return {
        "ok": True,
        "status": 201,
        "reply": {
            "id": rec.id,
            "post_id": rec.post_id,
            "author_id": rec.author_id,
            "text": rec.text,
            "created_at": rec.created_at,
            "status": rec.status,
        },
    }
