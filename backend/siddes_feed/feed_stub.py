from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Set, Tuple

from siddes_post.runtime_store import POST_STORE, REPLY_STORE
from siddes_visibility.policy import SideId

# Feed aggregation (DB-truth when SD_POST_STORE=db, otherwise memory stores).
#
# World-ready constraints:
# - No fake Activity/Signals.
# - Real engagement counters: likeCount, liked, replyCount, echoCount, echoed.
# - Fail-closed visibility for non-public posts: author OR Set membership.
# - Public topics are DB-backed via Post.public_channel (optional server filter via ?topic=...)


def _pretty_age(created_at: Any) -> str:
    """Return a compact relative age like 15s/3m/2h/4d."""
    try:
        ts = float(created_at)
        if ts <= 0:
            return ""
        delta = max(0.0, time.time() - ts)
        if delta < 60:
            return f"{int(delta)}s"
        if delta < 3600:
            return f"{int(delta // 60)}m"
        if delta < 86400:
            return f"{int(delta // 3600)}h"
        return f"{int(delta // 86400)}d"
    except Exception:
        return ""



def _edit_window_sec(side: str) -> int:
    """Edit window (anti bait-and-switch).

    Defaults:
    - Public: 15 minutes
    - Non-public: 24 hours

    Override via env:
      - SIDDES_POST_EDIT_WINDOW_PUBLIC_SEC
      - SIDDES_POST_EDIT_WINDOW_PRIVATE_SEC
    """

    import os

    s = str(side or '').strip().lower() or 'public'
    pub = int(str(os.environ.get('SIDDES_POST_EDIT_WINDOW_PUBLIC_SEC', '900')).strip() or '900')
    priv = int(str(os.environ.get('SIDDES_POST_EDIT_WINDOW_PRIVATE_SEC', str(24*3600))).strip() or str(24*3600))
    if s == 'public':
        return max(0, pub)
    return max(0, priv)

def _viewer_aliases(viewer_id: str) -> Set[str]:
    v = str(viewer_id or "").strip()
    if not v:
        return set()
    try:
        from siddes_backend.identity import viewer_aliases  # type: ignore

        aliases = viewer_aliases(v)
        return {str(a).strip() for a in aliases if str(a).strip()}
    except Exception:
        return {v}


def _same_person(viewer_id: str, author_id: str) -> bool:
    a = str(author_id or "").strip()
    if not a:
        return False
    return a in _viewer_aliases(viewer_id)




def _viewer_is_staff(viewer_id: str) -> bool:
    v = str(viewer_id or "").strip()
    if not v.startswith("me_"):
        return False
    try:
        from django.contrib.auth import get_user_model
        uid = v.split("me_", 1)[1]
        if not uid:
            return False
        u = get_user_model().objects.filter(id=int(uid)).first()
        return bool(u and (getattr(u, "is_staff", False) or getattr(u, "is_superuser", False)))
    except Exception:
        return False


def _set_allows(viewer_id: str, set_id: Optional[str]) -> bool:
    sid = str(set_id or "").strip()
    if not sid:
        return True
    if sid.startswith("b_"):
        # Broadcast posts are Public-readable channels.
        return True

    aliases = _viewer_aliases(viewer_id)
    if not aliases:
        return False

    try:
        from siddes_sets.models import SiddesSet, SiddesSetMember  # type: ignore
    except Exception:
        # Standalone tooling/selftests: fall back to demo membership helpers.
        try:
            from siddes_feed import mock_db  # type: ignore
            return bool(mock_db.set_allows(viewer_id, sid))
        except Exception:
            return False

    # Owner can always view
    try:
        if SiddesSet.objects.filter(id=sid, owner_id__in=list(aliases)).exists():
            return True
    except Exception:
        pass

    # sd_366: membership table (fast) with JSON fallback
    try:
        return SiddesSetMember.objects.filter(set_id=sid, member_id__in=list(aliases)).exists()
    except Exception:
        try:
            s = SiddesSet.objects.get(id=sid)
            members = getattr(s, "members", []) or []
            if not isinstance(members, list):
                return False
            mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}
            return bool(mem.intersection(aliases))
        except Exception:
            return False


def _can_view_record(viewer_id: str, rec) -> bool:
    side = str(getattr(rec, "side", "") or "public").strip().lower()
    author_id = str(getattr(rec, "author_id", "") or "").strip()

    # sd_326_block: block enforcement + hidden moderation gate
    if bool(getattr(rec, "is_hidden", False)):
        if not (_same_person(viewer_id, author_id) or _viewer_is_staff(viewer_id)):
            return False

    try:
        from siddes_safety.policy import is_blocked_pair, is_muted
        if author_id and is_blocked_pair(viewer_id, author_id):
            if not (_same_person(viewer_id, author_id) or _viewer_is_staff(viewer_id)):
                return False

        if author_id and is_muted(viewer_id, author_id):
            if not _same_person(viewer_id, author_id):
                return False
    except Exception:
        pass

    # Author always sees own posts
    if _same_person(viewer_id, author_id):
        return True

    if side == "public":
        return True

    # Non-public: require set membership (fail-closed)
    sid = str(getattr(rec, "set_id", "") or "").strip() or None
    if sid:
        return _set_allows(viewer_id, sid)

    # Non-public without a Set is author-only.
    return False


def _author_label(author_id: str) -> str:
    a = str(author_id or '').strip()
    if not a:
        return 'Unknown'
    try:
        from siddes_backend.identity import display_for_token  # type: ignore
        d = display_for_token(a)
        name = str((d or {}).get('name') or '').strip()
        return name or a
    except Exception:
        return a


def _handle(author_id: str) -> str:
    a = str(author_id or '').strip()
    if not a:
        return '@unknown'
    try:
        from siddes_backend.identity import display_for_token  # type: ignore
        d = display_for_token(a)
        h = str((d or {}).get('handle') or '').strip()
        return h or ('@' + a.lstrip('@').lower())
    except Exception:
        return '@' + a.lstrip('@')


def _bulk_engagement(viewer_id: str, post_ids: List[str]) -> Tuple[Dict[str, int], Dict[str, int], Set[str]]:
    """Return (like_counts, reply_counts, liked_ids) for post_ids."""

    like_counts: Dict[str, int] = {str(pid): 0 for pid in post_ids}
    reply_counts: Dict[str, int] = {str(pid): 0 for pid in post_ids}
    liked_ids: Set[str] = set()

    if not post_ids:
        return like_counts, reply_counts, liked_ids

    # Likes
    try:
        from django.db.models import Count
        from siddes_post.models import PostLike  # type: ignore

        rows = PostLike.objects.filter(post_id__in=post_ids).values("post_id").annotate(c=Count("id"))
        for r in rows:
            pid = str(r.get("post_id") or "").strip()
            if pid:
                like_counts[pid] = int(r.get("c") or 0)

        liked_ids = set(
            PostLike.objects.filter(post_id__in=post_ids, viewer_id=str(viewer_id)).values_list("post_id", flat=True)
        )
    except Exception:
        pass

    # Replies
    try:
        from django.db.models import Count
        from siddes_post.models import Reply  # type: ignore

        rows = Reply.objects.filter(post_id__in=post_ids).values("post_id").annotate(c=Count("id"))
        for r in rows:
            pid = str(r.get("post_id") or "").strip()
            if pid:
                reply_counts[pid] = int(r.get("c") or 0)
    except Exception:
        for pid in post_ids:
            try:
                reply_counts[str(pid)] = int(REPLY_STORE.count_for_post(str(pid)))
            except Exception:
                reply_counts[str(pid)] = 0

    return like_counts, reply_counts, liked_ids


# sd_384_media: bulk media attachments for feed hydration

def _bulk_media(post_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {str(pid): [] for pid in post_ids}
    if not post_ids:
        return out

    try:
        from siddes_media.models import MediaObject  # type: ignore
        from siddes_media.token_urls import build_media_url  # type: ignore

        qs = MediaObject.objects.filter(post_id__in=post_ids, status="committed").order_by("post_id", "created_at", "id")
        for m in qs:
            pid = str(getattr(m, "post_id", "") or "").strip()
            if not pid or pid not in out:
                continue
            if len(out[pid]) >= 4:
                continue
            key = str(getattr(m, "r2_key", "") or "").lstrip("/")
            out[pid].append(
                {
                    "id": str(getattr(m, "id", "") or key),
                    "r2Key": key,
                    "kind": str(getattr(m, "kind", "") or "image"),
                    "contentType": str(getattr(m, "content_type", "") or ""),
                    "url": build_media_url(key, is_public=bool(getattr(m, "is_public", False))),
                }
            )
    except Exception:
        pass

    return out


def _bulk_echo(viewer_id: str, post_ids: List[str], side: SideId, visible_recs: List[Any]) -> Tuple[Dict[str, int], Set[str]]:
    """Return (echo_counts, echoed_ids) for post_ids within the current Side."""

    echo_counts: Dict[str, int] = {str(pid): 0 for pid in post_ids}
    echoed_ids: Set[str] = set()

    if not post_ids:
        return echo_counts, echoed_ids

    aliases = _viewer_aliases(viewer_id)

    try:
        from django.db.models import Count
        from siddes_post.models import Post  # type: ignore

        rows = (
            Post.objects.filter(echo_of_post_id__in=post_ids, side=str(side))
            .values("echo_of_post_id")
            .annotate(c=Count("id"))
        )
        for r in rows:
            pid = str(r.get("echo_of_post_id") or "").strip()
            if pid:
                echo_counts[pid] = int(r.get("c") or 0)

        if aliases:
            echoed_ids = set(
                Post.objects.filter(
                    echo_of_post_id__in=post_ids, side=str(side), author_id__in=list(aliases)
                ).values_list("echo_of_post_id", flat=True)
            )
    except Exception:
        # Fallback: scan visible recs (same side, already permission-filtered)
        for r in visible_recs:
            e = str(getattr(r, "echo_of_post_id", "") or "").strip()
            if not e:
                continue
            if e not in echo_counts:
                continue
            echo_counts[e] = int(echo_counts.get(e, 0) or 0) + 1
            a = str(getattr(r, "author_id", "") or "").strip()
            if a and a in aliases:
                echoed_ids.add(e)

    return echo_counts, echoed_ids


def _echo_of_summary(echo_of_post_id: str) -> Optional[Dict[str, Any]]:
    pid = str(echo_of_post_id or "").strip()
    if not pid:
        return None

    try:
        base = POST_STORE.get(pid)
    except Exception:
        base = None

    if base is None:
        return {"id": pid, "author": "Unknown", "handle": "@unknown", "time": "", "content": "", "kind": "text"}

    author_id = str(getattr(base, "author_id", "") or "")
    return {
        "id": str(getattr(base, "id", "") or pid),
        "author": _author_label(author_id),
        "handle": _handle(author_id),
        "time": _pretty_age(getattr(base, "created_at", None)),
        "content": str(getattr(base, "text", "") or ""),
        "kind": "text",
    }


def _hydrate_from_record(
    rec,
    *,
    viewer_id: str,
    like_count: int = 0,
    reply_count: int = 0,
    liked: bool = False,
    echo_count: int = 0,
    echoed: bool = False,
) -> Dict[str, Any]:
    author_id = str(getattr(rec, "author_id", "") or "")

    echo_of_id = str(getattr(rec, "echo_of_post_id", "") or "").strip() or None
    echo_of = _echo_of_summary(echo_of_id) if echo_of_id else None

    out: Dict[str, Any] = {
        "id": rec.id,
        "author": _author_label(author_id),
        "handle": _handle(author_id),
        "time": _pretty_age(getattr(rec, "created_at", None)),
        "content": str(getattr(rec, "text", "") or ""),
        "kind": "text",
        # Engagement (real, DB-backed where available)
        "likeCount": int(like_count),
        "likes": int(like_count),  # legacy alias
        "liked": bool(liked),
        "replyCount": int(reply_count),
        "echoCount": int(echo_count),
        "echoed": bool(echoed),
    }

    if getattr(rec, "set_id", None):
        out["setId"] = rec.set_id
    if getattr(rec, "urgent", False):
        out["urgent"] = True

    if str(getattr(rec, "side", "") or "").strip().lower() == "public":
        out["trustLevel"] = 3 if author_id == "me" else 1
        pc = str(getattr(rec, "public_channel", "") or "").strip()
        if pc:
            out["publicChannel"] = pc

    if echo_of is not None:
        out["echoOf"] = echo_of

    # sd_325: edit/delete affordances (server truth)
    try:
        author_id = str(getattr(rec, "author_id", "") or "").strip()
        echo_of_id = str(getattr(rec, "echo_of_post_id", "") or "").strip()
        text = str(getattr(rec, "text", "") or "").strip()
        created = float(getattr(rec, "created_at", 0.0) or 0.0)
        win = _edit_window_sec(str(getattr(rec, "side", "") or "public"))
        can_edit = bool(author_id and viewer_id and _same_person(viewer_id, author_id) and (not echo_of_id or text) and created > 0 and (time.time() - created) <= float(win))
        out["canEdit"] = bool(can_edit)
        out["canDelete"] = bool(author_id and viewer_id and (_same_person(viewer_id, author_id) or _viewer_is_staff(viewer_id)))
    except Exception:
        out["canEdit"] = False
        out["canDelete"] = False

    try:
        ea = float(getattr(rec, "edited_at", 0.0) or 0.0)
        if ea > 0:
            out["editedAt"] = int(ea * 1000)
    except Exception:
        pass

    return out


def list_feed(viewer_id: str, side: SideId, *, topic: str | None = None, limit: int = 200, cursor: str | None = None) -> Dict[str, Any]:
    """Cursor-paginated feed (backward compatible).

    Inputs (via view query params):
    - limit: int (1..200). Defaults to 200 when omitted (matches old behavior).
    - cursor: opaque string returned in `nextCursor` (format: "<created_at>|<id>").

    Response adds:
    - nextCursor: str | None
    - hasMore: bool
    - serverTs: float
    """

    # Clamp limit (keep old behavior when omitted: defaults to 200)
    try:
        lim = int(limit)
    except Exception:
        lim = 200
    if lim < 1:
        lim = 1
    if lim > 200:
        lim = 200

    t = str(topic or "").strip().lower() or None
    if t == "all":
        t = None

    # sd_422_user_hide: per-viewer hidden posts (personal)
    hidden_ids: set[str] = set()
    try:
        from siddes_safety.models import UserHiddenPost  # type: ignore
        rows = list(
            UserHiddenPost.objects.filter(viewer_id=str(viewer_id))
            .values_list('post_id', flat=True)[:5000]
        )
        hidden_ids = {str(x).strip() for x in rows if str(x).strip()}
    except Exception:
        hidden_ids = set()

    def parse_cursor(cur: str | None) -> Tuple[Optional[float], str]:
        raw = str(cur or "").strip()
        if not raw or "|" not in raw:
            return None, ""
        a, b = raw.split("|", 1)
        a = a.strip()
        b = b.strip()
        if not a or not b:
            return None, ""
        try:
            ts = float(a)
        except Exception:
            return None, ""
        return ts, b

    def encode_cursor(rec: Any) -> str:
        ts = float(getattr(rec, "created_at", 0.0) or 0.0)
        pid = str(getattr(rec, "id", "") or "").strip()
        return f"{ts:.6f}|{pid}"

    def after_pred(rec: Any, ts: float, pid: str) -> bool:
        rts = float(getattr(rec, "created_at", 0.0) or 0.0)
        rid = str(getattr(rec, "id", "") or "").strip()
        if rts < ts:
            return True
        if rts == ts and rid < pid:
            return True
        return False

    def fetch_batch(after: str | None, n: int) -> List[Any]:
        # Fast path: ORM query in DB mode.
        try:
            from django.db.models import Q
            from siddes_post.models import Post  # type: ignore

            qs = Post.objects.filter(side=str(side)).order_by("-created_at", "-id")

            # Public topic filter (DB-backed)
            if str(side) == "public" and t:
                if t == "general":
                    qs = qs.filter(Q(public_channel__isnull=True) | Q(public_channel="") | Q(public_channel="general"))
                else:
                    qs = qs.filter(public_channel=t)

            cts, cid = parse_cursor(after)
            if cts is not None and cid:
                qs = qs.filter(Q(created_at__lt=cts) | (Q(created_at=cts) & Q(id__lt=cid)))

            return list(qs[:n])
        except Exception:
            # Fallback: in-memory store list.
            recs_all = POST_STORE.list()
            recs_side = [r for r in recs_all if str(getattr(r, "side", "") or "").strip().lower() == str(side)]

            cts, cid = parse_cursor(after)
            if cts is not None and cid:
                recs_side = [r for r in recs_side if after_pred(r, cts, cid)]

            if str(side) == "public" and t:
                def _topic_of(rec: Any) -> str:
                    ch = str(getattr(rec, "public_channel", "") or "").strip().lower()
                    return ch or "general"

                if t == "general":
                    recs_side = [r for r in recs_side if _topic_of(r) == "general"]
                else:
                    recs_side = [r for r in recs_side if _topic_of(r) == t]

            return list(recs_side[:n])

    # We may need to scan more than lim because visibility filtering can exclude records.
    batch_size = max(200, lim * 5)
    if batch_size > 500:
        batch_size = 500

    visible: List[Any] = []
    after = cursor
    last_scanned: Any = None
    has_more_underlying = False

    loops = 0
    while len(visible) < lim and loops < 5:
        loops += 1
        recs = fetch_batch(after, batch_size + 1)
        if not recs:
            has_more_underlying = False
            break

        more_underlying = len(recs) > batch_size
        if more_underlying:
            recs = recs[:batch_size]

        stopped_early = False
        for r in recs:
            last_scanned = r

            pid = str(getattr(r, "id", "") or "").strip()
            if pid and pid in hidden_ids:
                continue

            if not _can_view_record(viewer_id, r):
                continue

            sid = str(getattr(r, "set_id", "") or "").strip() or None
            if sid and not _set_allows(viewer_id, sid):
                continue

            visible.append(r)
            if len(visible) >= lim:
                stopped_early = True
                break

        if stopped_early:
            # There are more records after the last returned item (either unprocessed in this batch or beyond).
            has_more_underlying = True
            break

        # Not enough visible items yet; continue scanning if more underlying records exist.
        if more_underlying and last_scanned is not None:
            has_more_underlying = True
            after = encode_cursor(last_scanned)
            continue

        has_more_underlying = False
        break

    post_ids = [str(getattr(r, "id", "") or "").strip() for r in visible if str(getattr(r, "id", "") or "").strip()]
    like_counts, reply_counts, liked_ids = _bulk_engagement(viewer_id, post_ids)
    echo_counts, echoed_ids = _bulk_echo(viewer_id, post_ids, side, visible)
    media_map = _bulk_media(post_ids)

    items: List[dict] = []
    for r in visible:
        pid = str(getattr(r, "id", "") or "").strip()
        it = _hydrate_from_record(
            r,
            viewer_id=viewer_id,
            like_count=int(like_counts.get(pid, 0) or 0),
            reply_count=int(reply_counts.get(pid, 0) or 0),
            liked=(pid in liked_ids),
            echo_count=int(echo_counts.get(pid, 0) or 0),
            echoed=(pid in echoed_ids),
        )

        media = media_map.get(pid) or []
        if media:
            it["media"] = media
            it["kind"] = "image"

        items.append(it)

    # Final guard for Public topics (should already be filtered in fetch_batch).
    tt = str(t or "").strip().lower()
    if str(side) == "public" and tt:
        def _topic_of_item(it: dict) -> str:
            ch = str(it.get("publicChannel") or "").strip().lower()
            return ch or "general"

        if tt == "general":
            items = [it for it in items if _topic_of_item(it) == "general"]
        else:
            items = [it for it in items if _topic_of_item(it) == tt]

    next_cursor = None
    if has_more_underlying:
        if visible:
            next_cursor = encode_cursor(visible[-1])
        elif last_scanned is not None:
            next_cursor = encode_cursor(last_scanned)

    return {
        "side": side,
        "count": len(items),
        "items": items,
        "nextCursor": next_cursor,
        "hasMore": bool(next_cursor),
        "serverTs": time.time(),
    }
