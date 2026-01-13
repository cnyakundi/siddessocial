"""Inbox endpoints (stub-safe, but now backed by a dev store).

This module mirrors the JSON shapes in `docs/INBOX_BACKEND_CONTRACT.md`.

Safety rule (non-negotiable):
- If you can't confidently authorize the viewer, return `restricted: true` with **no content**.

As of sd_109+:
- The Django router can use an in-memory store to serve realistic demo content.
- Production will swap this store for a DB-backed implementation + real auth.

As of sd_112:
- No Django Ninja dependencies remain. DRF views call into this module.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .models_stub import MessageRecord, ParticipantRecord, SideId, ThreadMetaRecord, ThreadRecord
from .store import InboxStore


def _participant(p: ParticipantRecord) -> Dict[str, Any]:
    out: Dict[str, Any] = {"displayName": p.display_name, "initials": p.initials}
    if p.avatar_seed is not None:
        out["avatarSeed"] = p.avatar_seed
    if p.user_id is not None:
        out["userId"] = p.user_id
    if p.handle is not None:
        out["handle"] = p.handle
    return out


def _thread(t: ThreadRecord) -> Dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "participant": _participant(t.participant),
        "lockedSide": t.locked_side,
        "last": t.last,
        "time": t.time,
        "unread": int(t.unread),
        "updatedAt": int(t.updated_at),
    }


def _meta(m: ThreadMetaRecord) -> Dict[str, Any]:
    return {"lockedSide": m.locked_side, "updatedAt": int(m.updated_at)}


def _message(m: MessageRecord) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": m.id,
        "ts": int(m.ts),
        "from": m.from_id,
        "text": m.text,
        "side": m.side,
        "queued": bool(m.queued),
    }
    # Optional debug key (safe to ignore client-side)
    if m.client_key is not None:
        out["clientKey"] = m.client_key
    return out


def _restricted_list() -> Dict[str, Any]:
    return {"ok": True, "restricted": True, "items": [], "hasMore": False, "nextCursor": None}


def _restricted_thread() -> Dict[str, Any]:
    return {
        "ok": True,
        "restricted": True,
        "thread": None,
        "meta": None,
        "messages": [],
        "messagesHasMore": False,
        "messagesNextCursor": None,
    }


def _restricted_send() -> Dict[str, Any]:
    return {"ok": True, "restricted": True, "message": None, "meta": None}


def _restricted_meta() -> Dict[str, Any]:
    return {"ok": True, "restricted": True, "meta": None}


def list_threads(
    store: InboxStore,
    *,
    viewer_id: Optional[str],
    side: Optional[SideId] = None,
    limit: int = 20,
    cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """GET /api/inbox/threads"""

    if not viewer_id:
        return _restricted_list()

    try:
        items, has_more, next_cursor = store.list_threads(
            viewer_id=viewer_id,
            side=side,
            limit=limit,
            cursor=cursor,
        )
    except Exception:
        return _restricted_list()

    return {
        "ok": True,
        "restricted": False,
        "items": [_thread(t) for t in items],
        "hasMore": bool(has_more),
        "nextCursor": next_cursor,
    }


def get_thread(
    store: InboxStore,
    *,
    viewer_id: Optional[str],
    thread_id: str,
    limit: int = 30,
    cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """GET /api/inbox/thread/:id"""

    if not viewer_id:
        return _restricted_thread()

    try:
        thread, meta, messages, has_more, next_cursor = store.get_thread(
            viewer_id=viewer_id,
            thread_id=thread_id,
            limit=limit,
            cursor=cursor,
        )
    except KeyError:
        # Hide existence details for safety (still ok:false would also be fine in dev)
        return _restricted_thread()

    return {
        "ok": True,
        "restricted": False,
        "thread": _thread(thread),
        "meta": _meta(meta),
        "messages": [_message(m) for m in messages],
        "messagesHasMore": bool(has_more),
        "messagesNextCursor": next_cursor,
    }


def send_message(
    store: InboxStore,
    *,
    viewer_id: Optional[str],
    thread_id: str,
    text: str,
    client_key: Optional[str] = None,
) -> Dict[str, Any]:
    """POST /api/inbox/thread/:id body: { text }"""

    if not viewer_id:
        return _restricted_send()

    if not (text or "").strip():
        # Contract: views return HTTP 400 + ok:false
        raise ValueError("missing_text")

    try:
        msg, meta = store.send_message(
            viewer_id=viewer_id,
            thread_id=thread_id,
            text=text,
            client_key=client_key,
        )
    except KeyError:
        return _restricted_send()

    return {"ok": True, "restricted": False, "message": _message(msg), "meta": _meta(meta)}


def set_locked_side(
    store: InboxStore,
    *,
    viewer_id: Optional[str],
    thread_id: str,
    side: SideId,
) -> Dict[str, Any]:
    """POST /api/inbox/thread/:id body: { setLockedSide }"""

    if not viewer_id:
        return _restricted_meta()

    try:
        meta = store.set_locked_side(viewer_id=viewer_id, thread_id=thread_id, side=side)
    except KeyError:
        return _restricted_meta()

    return {"ok": True, "restricted": False, "meta": _meta(meta)}
