from __future__ import annotations

import time

from typing import Any, Dict, Optional, Tuple, Set

from django.conf import settings
from django.utils.decorators import method_decorator

from siddes_backend.csrf import dev_csrf_exempt

from siddes_backend.throttles import SiddesScopedRateThrottle

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role
from siddes_sets.store_db import DbSetsStore

from .runtime_store import POST_STORE, REPLY_STORE
from .models import Post, PostLike
from .trust_gates import enabled as trust_gates_enabled, enforce_public_write_gates, normalize_trust_level

_ALLOWED_SIDES = {"public", "friends", "close", "work"}


def _can_view_set_post(*, viewer_id: str, set_id: Optional[str]) -> bool:
    """Enforce Set-level privacy for posts.

    - No set_id: Side-only rules apply.
    - Broadcast set_id (b_*): treated as public channel.
    - Otherwise: viewer must be owner/member of the Set.

    Fail-closed: if membership can't be confirmed, deny.
    """

    sid = str(set_id or "").strip()
    if not sid:
        return True
    if sid.startswith("b_"):
        return True

    try:
        return DbSetsStore().get(owner_id=str(viewer_id), set_id=sid) is not None
    except Exception:
        return False


def _raw_viewer_from_request(request) -> Optional[str]:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        uid = str(getattr(user, "id", "") or "").strip()
        return f"me_{uid}" if uid else None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return raw or None


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or "anon").strip() or "anon"
    role = resolve_viewer_role(viewer) or "anon"
    return has_viewer, viewer, role


def _trust_level(request, *, role: str) -> int:
    fallback = 0
    if role == "me":
        fallback = 3
    elif role in ("work", "close"):
        fallback = 2
    elif role == "friends":
        fallback = 1

    # sd_265: Never trust client-supplied trust overrides in production.
    raw = None
    if getattr(settings, "DEBUG", False):
        raw = request.headers.get("x-sd-trust") or getattr(request, "COOKIES", {}).get("sd_trust")

    return normalize_trust_level(raw, fallback)


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


def _can_edit_post(viewer_id: str, rec) -> bool:
    if not viewer_id:
        return False
    try:
        author_id = str(getattr(rec, 'author_id', '') or '').strip()
        if not author_id or not _same_person(viewer_id, author_id):
            return False
        # Disallow editing pure echoes (no original text). Quote-echoes are allowed.
        echo_of = str(getattr(rec, 'echo_of_post_id', '') or '').strip()
        text = str(getattr(rec, 'text', '') or '').strip()
        if echo_of and not text:
            return False
        created = float(getattr(rec, 'created_at', 0.0) or 0.0)
        if created <= 0:
            return False
        win = _edit_window_sec(str(getattr(rec, 'side', '') or 'public'))
        if win <= 0:
            return False
        import time
        return (time.time() - created) <= float(win)
    except Exception:
        return False


def _can_delete_post(viewer_id: str, rec) -> bool:
    if not viewer_id:
        return False
    try:
        author_id = str(getattr(rec, 'author_id', '') or '').strip()
        if author_id and _same_person(viewer_id, author_id):
            return True
        return _viewer_is_staff(viewer_id)
    except Exception:
        return False



def _set_meta(viewer_id: str, set_id: Optional[str]) -> Tuple[bool, Optional[str]]:
    # Set-scoped post enforcement (fail-closed).
    sid = str(set_id or "").strip()
    if not sid:
        return True, None
    if sid.startswith("b_"):
        # Broadcast set ids are handled elsewhere.
        return True, None

    aliases = _viewer_aliases(viewer_id)
    if not aliases:
        return False, None

    try:
        from siddes_sets.models import SiddesSet, SiddesSetMember  # type: ignore

        s = SiddesSet.objects.get(id=sid)
    except Exception:
        return False, None

    owner = str(getattr(s, "owner_id", "") or "").strip()
    side = str(getattr(s, "side", "") or "").strip() or None
    if owner and owner in aliases:
        return True, side

    # sd_366: membership table (fast) with JSON fallback
    try:
        ok = SiddesSetMember.objects.filter(set_id=sid, member_id__in=list(aliases)).exists()
        return bool(ok), side
    except Exception:
        members = getattr(s, "members", []) or []
        if not isinstance(members, list):
            return False, side
        mem = {str(m).strip() for m in members if isinstance(m, (str, int, float))}
        return (bool(mem.intersection(aliases))), side




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


def _can_view_post_record(*, viewer_id: str, side: str, author_id: str, set_id: Optional[str], is_hidden: bool = False) -> bool:
    """Launch-safe visibility rule (no demo relationship graph).

    - Author always sees own posts.
    - Public posts are viewable.
    - Non-public posts require Set membership when set_id is present.
    - Non-public posts without set_id are author-only.
    """

    s = str(side or "").strip().lower() or "public"
    # sd_326_block: block enforcement (either direction)
    try:
        from siddes_safety.policy import is_blocked_pair
        if is_blocked_pair(viewer_id, author_id):
            if not (_same_person(viewer_id, author_id) or _viewer_is_staff(viewer_id)):
                return False
    except Exception:
        pass

    # sd_324_hidden: hide/unhide moderation gate
    if bool(is_hidden):
        if _same_person(viewer_id, author_id) or _viewer_is_staff(viewer_id):
            return True
        return False


    if _same_person(viewer_id, author_id):
        return True

    if s == "public":
        return True

    sid = str(set_id or "").strip() or ""
    if sid:
        ok_set, _set_side = _set_meta(viewer_id, sid)
        return bool(ok_set)

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


def _viewer_liked(post_id: str, viewer_id: Optional[str]) -> bool:
    if not viewer_id or not post_id:
        return False
    try:
        return PostLike.objects.filter(post_id=str(post_id), viewer_id=str(viewer_id)).exists()
    except Exception:
        return False


def _reply_count(post_id: str) -> int:
    try:
        return int(REPLY_STORE.count_for_post(str(post_id)))
    except Exception:
        return 0


# sd_384_media: attachments (R2 keys)

def _parse_media_keys(body: Dict[str, Any]) -> list[str]:
    raw = None
    if isinstance(body, dict):
        raw = body.get("mediaKeys") or body.get("media_keys") or body.get("media")

    keys: list[str] = []
    if isinstance(raw, str):
        parts = [p.strip() for p in raw.split(",")]
        for p in parts:
            if p:
                keys.append(p)
    elif isinstance(raw, list):
        for x in raw:
            k = str(x or "").strip()
            if k:
                keys.append(k)

    out: list[str] = []
    seen = set()
    for k in keys:
        if k in seen:
            continue
        seen.add(k)
        out.append(k)
    return out


def _media_for_post(post_id: str) -> list[Dict[str, Any]]:
    pid = str(post_id or "").strip()
    if not pid:
        return []

    try:
        from siddes_media.models import MediaObject  # type: ignore
        from siddes_media.token_urls import build_media_url  # type: ignore

        qs = MediaObject.objects.filter(post_id=pid, status="committed").order_by("created_at", "id")
        out: list[Dict[str, Any]] = []
        for m in list(qs[:4]):
            key = str(getattr(m, "r2_key", "") or "").lstrip("/")
            out.append(
                {
                    "id": str(getattr(m, "id", "") or key),
                    "r2Key": key,
                    "kind": str(getattr(m, "kind", "") or "image"),
                    "contentType": str(getattr(m, "content_type", "") or ""),
                    "url": build_media_url(key, is_public=bool(getattr(m, "is_public", False))),
                }
            )
        return out
    except Exception:
        return []





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
def _feed_post_from_record(rec, viewer_id: Optional[str] = None) -> Dict[str, Any]:
    author_id = str(getattr(rec, "author_id", "") or "")
    pid = str(getattr(rec, "id", "") or "")

    like_count = _like_count(pid) if pid else 0
    reply_count = _reply_count(pid) if pid else 0
    liked = _viewer_liked(pid, viewer_id) if pid else False

    side = str(getattr(rec, "side", "") or "public").strip().lower()
    echo_count = _echo_count(pid, side=side) if pid else 0
    echoed = _viewer_echoed(pid, viewer_id, side=side) if pid else False

    out: Dict[str, Any] = {
        "id": rec.id,
        "author": _author_label(author_id),
        "handle": _handle(author_id),
        "time": _pretty_age(getattr(rec, "created_at", None)),
        "content": str(getattr(rec, "text", "") or ""),
        "kind": "text",
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

    echo_of_id = str(getattr(rec, "echo_of_post_id", "") or "").strip()
    if echo_of_id:
        out["echoOf"] = _echo_of_summary(echo_of_id)

    # sd_325: edit/delete affordances (server truth)
    if viewer_id:
        out["canEdit"] = bool(_can_edit_post(str(viewer_id), rec))
        out["canDelete"] = bool(_can_delete_post(str(viewer_id), rec))

    try:
        ea = float(getattr(rec, "edited_at", 0.0) or 0.0)
        if ea > 0:
            out["editedAt"] = int(ea * 1000)
    except Exception:
        pass
    # sd_384_media: include media attachments (if any)
    try:
        if pid:
            media = _media_for_post(pid)
            if media:
                out["media"] = media
                out["kind"] = "image"
    except Exception:
        pass

    return out


@method_decorator(dev_csrf_exempt, name="dispatch")
class PostCreateView(APIView):
    throttle_scope = "post_create"
    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        side = str(body.get("side") or "public").strip().lower()
        if side not in _ALLOWED_SIDES:
            side = "public"
        text = str(body.get("text") or "").strip()
        set_id = str(body.get("setId") or body.get("set_id") or "").strip() or None

        public_channel = None
        if side == "public" and not (set_id and str(set_id).startswith("b_")):
            raw_pc = body.get("publicChannel") or body.get("public_channel")
            raw_pc = str(raw_pc or "").strip().lower()
            if raw_pc and raw_pc != "all":
                ok = True
                if len(raw_pc) > 32:
                    ok = False
                else:
                    for ch in raw_pc:
                        if not (ch.isalnum() or ch in "_-"):
                            ok = False
                            break
                if ok:
                    public_channel = raw_pc

        # Broadcasts are Public-only channels addressed via set_id=b_*
        if set_id and str(set_id).startswith("b_"):
            # Force broadcast posts into Public side (default-safe)
            side = "public"
            try:
                from siddes_broadcasts.store_db import STORE as _BC_STORE

                if not _BC_STORE.can_write(viewer_id=viewer, broadcast_id=str(set_id)):
                    return Response({"ok": False, "restricted": True, "error": "broadcast_write_forbidden"}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                # If broadcasts aren't ready, fail closed
                return Response({"ok": False, "restricted": True, "error": "broadcast_unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        # Sets (non-broadcast): enforce membership before accepting set_id.
        if set_id and not str(set_id).startswith("b_"):
            if not _can_view_set_post(viewer_id=viewer, set_id=set_id):
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        # Set-scoped posts must enforce set membership and inherit Set side.
        if set_id and not str(set_id).startswith("b_"):
            ok_set, set_side = _set_meta(viewer, set_id)
            if not ok_set:
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            if set_side and set_side in _ALLOWED_SIDES:
                side = set_side

        urgent = bool(body.get("urgent")) if "urgent" in body else False
        client_key = str(body.get("client_key") or body.get("clientKey") or "").strip() or None
        parent_id = str(body.get("parentId") or body.get("parent_id") or "").strip() or None

        # sd_384_media: optional media attachments (R2 keys)
        media_keys = _parse_media_keys(body)
        if len(media_keys) > 4:
            return Response({"ok": False, "error": "too_many_media"}, status=status.HTTP_400_BAD_REQUEST)

        if media_keys:
            try:
                from siddes_media.models import MediaObject  # type: ignore

                qs = MediaObject.objects.filter(r2_key__in=media_keys, owner_id=viewer)
                found = {str(getattr(o, "r2_key", "") or "").strip(): o for o in qs}
                missing = [k for k in media_keys if k not in found]
                if missing:
                    return Response({"ok": False, "error": "invalid_media"}, status=status.HTTP_400_BAD_REQUEST)

                used = [k for k, o in found.items() if str(getattr(o, "post_id", "") or "").strip()]
                if used:
                    return Response({"ok": False, "error": "media_already_used"}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                return Response({"ok": False, "error": "media_unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


        if not text:
            return Response({"ok": False, "error": "empty_text"}, status=status.HTTP_400_BAD_REQUEST)

        # sd_360: server-side size limits (prevents DoS/DB bloat; keeps posting normal)
        max_len = 800 if side == "public" else 5000
        if len(text) > max_len:
            return Response({"ok": False, "error": "too_long", "max": max_len}, status=status.HTTP_400_BAD_REQUEST)

        if trust_gates_enabled() and side == "public":
            trust = _trust_level(request, role=role)
            gate = enforce_public_write_gates(viewer_id=viewer, trust_level=trust, text=text, kind="post")
            if not gate.get("ok"):
                st = int(gate.get("status") or 403)
                payload: Dict[str, Any] = {"ok": False, "restricted": st == 401, "error": gate.get("error")}
                if gate.get("retry_after_ms") is not None:
                    payload["retry_after_ms"] = gate.get("retry_after_ms")
                if gate.get("min_trust") is not None:
                    payload["min_trust"] = gate.get("min_trust")
                return Response(payload, status=st)

        rec = POST_STORE.create(author_id=viewer, side=side, text=text, set_id=set_id, urgent=urgent, public_channel=public_channel, client_key=client_key)

        # sd_384_media: commit + attach media to post (server-side visibility is enforced here)
        if media_keys:
            try:
                from siddes_media.models import MediaObject  # type: ignore

                MediaObject.objects.filter(r2_key__in=media_keys, owner_id=viewer, post_id__isnull=True).update(
                    status="committed",
                    post_id=str(getattr(rec, "id", "") or ""),
                    is_public=(side == "public"),
                )
            except Exception:
                pass


        # Touch broadcast last_post_at when posting into a broadcast
        if set_id and str(set_id).startswith("b_"):
            try:
                from siddes_broadcasts.store_db import STORE as _BC_STORE

                _BC_STORE.touch_last_post(broadcast_id=str(set_id), created_at=float(getattr(rec, "created_at", 0.0) or 0.0))
            except Exception:
                pass

        return Response({"ok": True, "status": 201, "post": _feed_post_from_record(rec, viewer_id=viewer), "side": side}, status=status.HTTP_201_CREATED)


@method_decorator(dev_csrf_exempt, name="dispatch")
class PostDetailView(APIView):
    def get(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        # sd_422_user_hide: treat viewer-hidden posts as not_found
        try:
            from siddes_safety.models import UserHiddenPost  # type: ignore
            if UserHiddenPost.objects.filter(viewer_id=viewer, post_id=str(post_id)).exists():
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            pass

        rec = POST_STORE.get(post_id)
        if rec is None:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        ok_set, set_side = _set_meta(viewer, getattr(rec, "set_id", None))
        if not ok_set:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if set_side and set_side in _ALLOWED_SIDES and str(getattr(rec, "side", "") or "") != set_side:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_view_post_record(
            viewer_id=viewer,
            side=str(getattr(rec, "side", "") or "public"),
            author_id=str(getattr(rec, "author_id", "") or ""),
            set_id=getattr(rec, "set_id", None),
            is_hidden=bool(getattr(rec, "is_hidden", False)),
        ):
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "post": _feed_post_from_record(rec, viewer_id=viewer), "side": rec.side}, status=status.HTTP_200_OK)

    # sd_325: method-scoped throttling (edit/delete)
    def get_throttles(self):
        try:
            m = str(getattr(self.request, "method", "GET") or "GET").upper()
        except Exception:
            m = "GET"
        if m in ("PATCH", "PUT"):
            t = SiddesScopedRateThrottle()
            t.scope = "post_edit"
            return [t]
        if m == "DELETE":
            t = SiddesScopedRateThrottle()
            t.scope = "post_delete"
            return [t]
        return []

    def patch(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        rec = POST_STORE.get(post_id)
        if rec is None:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        ok_set, set_side = _set_meta(viewer, getattr(rec, "set_id", None))
        if not ok_set:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if set_side and set_side in _ALLOWED_SIDES and str(getattr(rec, "side", "") or "") != set_side:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _same_person(viewer, str(getattr(rec, "author_id", "") or "")):
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_edit_post(viewer, rec):
            return Response({"ok": False, "error": "edit_window_closed"}, status=status.HTTP_403_FORBIDDEN)

        body = request.data if isinstance(getattr(request, "data", None), dict) else {}
        text = str(body.get("text") or "").strip()
        if not text:
            return Response({"ok": False, "error": "empty_text"}, status=status.HTTP_400_BAD_REQUEST)

        side = str(getattr(rec, "side", "") or "public").strip().lower()
        max_len = 800 if side == "public" else 5000
        if len(text) > max_len:
            return Response({"ok": False, "error": "too_long", "max": max_len}, status=status.HTTP_400_BAD_REQUEST)

        if trust_gates_enabled() and side == "public":
            trust = _trust_level(request, role=role)
            gate = enforce_public_write_gates(viewer_id=viewer, trust_level=trust, text=text, kind="post_edit")
            if not gate.get("ok"):
                st = int(gate.get("status") or 403)
                payload = {"ok": False, "restricted": st == 401, "error": gate.get("error")}
                if gate.get("retry_after_ms") is not None:
                    payload["retry_after_ms"] = gate.get("retry_after_ms")
                if gate.get("min_trust") is not None:
                    payload["min_trust"] = gate.get("min_trust")
                return Response(payload, status=st)

        try:
            import time as _time
            rec.text = text
            rec.edited_at = float(_time.time())
            rec.save(update_fields=["text", "edited_at"])
        except Exception:
            return Response({"ok": False, "error": "update_failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"ok": True, "post": _feed_post_from_record(rec, viewer_id=viewer)}, status=status.HTTP_200_OK)

    def delete(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        rec = POST_STORE.get(post_id)
        if rec is None:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        ok_set, set_side = _set_meta(viewer, getattr(rec, "set_id", None))
        if not ok_set:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if set_side and set_side in _ALLOWED_SIDES and str(getattr(rec, "side", "") or "") != set_side:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_delete_post(viewer, rec):
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        # sd_384_media: detach media objects (fail-safe)
        try:
            from siddes_media.models import MediaObject  # type: ignore

            MediaObject.objects.filter(post_id=str(post_id)).update(post_id=None, is_public=False)
        except Exception:
            pass


        try:
            PostLike.objects.filter(post_id=str(post_id)).delete()
        except Exception:
            pass
        try:
            Post.objects.filter(id=str(post_id)).delete()
        except Exception:
            return Response({"ok": False, "error": "delete_failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"ok": True, "deleted": True, "id": str(post_id)}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class PostRepliesView(APIView):
    def get(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        rec = POST_STORE.get(post_id)
        if rec is None:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        ok_set, _set_side = _set_meta(viewer, getattr(rec, "set_id", None))
        if not ok_set:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_view_post_record(
            viewer_id=viewer,
            side=str(getattr(rec, "side", "") or "public"),
            author_id=str(getattr(rec, "author_id", "") or ""),
            set_id=getattr(rec, "set_id", None),
            is_hidden=bool(getattr(rec, "is_hidden", False)),
        ):
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        replies = REPLY_STORE.list_for_post(post_id)
        out = [
            {
                "id": r.id,
                "postId": r.post_id,
                "authorId": r.author_id,
                "author": _author_label(r.author_id),
                "handle": _handle(r.author_id),
                "text": r.text,
                "createdAt": int(float(r.created_at) * 1000),
                "clientKey": r.client_key,
                "parentId": getattr(r, "parent_id", None),
                "depth": int(getattr(r, "depth", 0) or 0),
            }
            for r in replies
        ]
        return Response({"ok": True, "postId": post_id, "count": len(out), "replies": out}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class PostReplyCreateView(APIView):
    throttle_scope = "post_reply_create"
    def post(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        text = str(body.get("text") or "").strip()
        client_key = str(body.get("client_key") or body.get("clientKey") or "").strip() or None
        parent_id = str(body.get("parent_id") or body.get("parentId") or "").strip() or None

        if not text:
            return Response({"ok": False, "error": "empty_text"}, status=status.HTTP_400_BAD_REQUEST)

        # sd_360: server-side size limits (prevents DoS/DB bloat; keeps posting normal)
        max_len = 2000
        if len(text) > max_len:
            return Response({"ok": False, "error": "too_long", "max": max_len}, status=status.HTTP_400_BAD_REQUEST)

        rec = POST_STORE.get(post_id)
        if rec is None:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        side = str(getattr(rec, "side", "") or "public")
        author_id = str(getattr(rec, "author_id", "") or "")
        set_id_of_post = str(getattr(rec, "set_id", "") or "").strip() or None

        ok_set, _set_side = _set_meta(viewer, set_id_of_post)
        if not ok_set:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_view_post_record(viewer_id=viewer, side=side, author_id=author_id, set_id=set_id_of_post, is_hidden=bool(getattr(rec, "is_hidden", False))):
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if side != "public" and role != "me":
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if trust_gates_enabled() and side == "public":
            trust = _trust_level(request, role=role)
            gate = enforce_public_write_gates(viewer_id=viewer, trust_level=trust, text=text, kind="reply")
            if not gate.get("ok"):
                st = int(gate.get("status") or 403)
                payload: Dict[str, Any] = {"ok": False, "restricted": st == 401, "error": gate.get("error")}
                if gate.get("retry_after_ms") is not None:
                    payload["retry_after_ms"] = gate.get("retry_after_ms")
                if gate.get("min_trust") is not None:
                    payload["min_trust"] = gate.get("min_trust")
                return Response(payload, status=st)

        try:
            r = REPLY_STORE.create(post_id=post_id, author_id=viewer, text=text, client_key=client_key, parent_id=parent_id)

            # sd_310_notify_reply: notify post author
            try:
                if author_id and not _same_person(viewer, author_id):
                    from siddes_notifications.service import notify
                    post_text = str(getattr(rec, "text", "") or "")
                    notify(
                        viewer_id=author_id,
                        ntype="reply",
                        actor_id=viewer,
                        glimpse=text,
                        post_id=post_id,
                        post_title=(post_text[:60] if post_text else None),
                    )
            except Exception:
                pass

        except ValueError as e:
            msg = str(e)
            if "post_not_found" in msg:
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            if "parent_not_found" in msg:
                return Response({"ok": False, "error": "parent_not_found"}, status=status.HTTP_400_BAD_REQUEST)
            if "parent_too_deep" in msg:
                return Response({"ok": False, "error": "parent_too_deep"}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"ok": False, "error": "server_error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                "ok": True,
                "status": 201,
                "reply": {"id": r.id, "post_id": post_id, "text": r.text, "client_key": client_key, "created_at": int(float(r.created_at) * 1000)},
            },
            status=status.HTTP_201_CREATED,
        )


# --- Post Likes endpoint (sd_179m) ---


# --- Post Echo (Step 2.2) ---

def _echo_count(post_id: str, *, side: str | None = None) -> int:
    """Count echo/quote-echo posts referencing post_id.

    Scope: by Side (prevents leaking private echo volumes across Sides).
    """
    pid = str(post_id or '').strip()
    if not pid:
        return 0
    try:
        qs = Post.objects.filter(echo_of_post_id=pid)
        if side:
            qs = qs.filter(side=str(side))
        return int(qs.count())
    except Exception:
        return 0


def _viewer_echoed(post_id: str, viewer_id: str | None, *, side: str | None = None) -> bool:
    """Did viewer create any echo/quote-echo of post_id in this Side?"""
    pid = str(post_id or '').strip()
    if not pid or not viewer_id:
        return False
    aliases = _viewer_aliases(str(viewer_id)) or {str(viewer_id)}
    try:
        qs = Post.objects.filter(echo_of_post_id=pid, author_id__in=list(aliases))
        if side:
            qs = qs.filter(side=str(side))
        return bool(qs.exists())
    except Exception:
        return False


def _echo_of_summary(echo_of_post_id: str) -> Dict[str, Any] | None:
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
    content = str(getattr(base, "text", "") or "")

    out = {
        "id": str(getattr(base, "id", "") or pid),
        "author": _author_label(author_id),
        "handle": _handle(author_id),
        "time": _pretty_age(getattr(base, "created_at", None)),
        "content": content,
        "kind": "text",
    }

    # sd_384_media: echoOf includes media
    try:
        media = _media_for_post(pid)
        if media:
            out["media"] = media
            out["kind"] = "image"
    except Exception:
        pass

    return out


def _like_count(post_id: str) -> int:
    return int(PostLike.objects.filter(post_id=post_id).count())


@method_decorator(dev_csrf_exempt, name="dispatch")
class PostLikeView(APIView):
    throttle_scope = "post_like"
    """Like/unlike a post.

    POST   /api/post/<id>/like   -> like
    DELETE /api/post/<id>/like   -> unlike
    """

    def _ensure_viewable(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return False, Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        rec = POST_STORE.get(post_id)
        if rec is None:
            return False, Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        side = str(getattr(rec, "side", "") or "public")
        author_id = str(getattr(rec, "author_id", "") or "")
        set_id = str(getattr(rec, "set_id", "") or "").strip() or None

        ok_set, _set_side = _set_meta(viewer, set_id)
        if not ok_set:
            return False, Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_view_post_record(viewer_id=viewer, side=side, author_id=author_id, set_id=set_id, is_hidden=bool(getattr(rec, "is_hidden", False))):
            return False, Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return True, (viewer,)

    def post(self, request, post_id: str):
        ok, payload = self._ensure_viewable(request, post_id)
        if not ok:
            return payload

        (viewer,) = payload
        PostLike.objects.get_or_create(post_id=post_id, viewer_id=viewer, defaults={"created_at": time.time()})

        # sd_310_notify_like: notify post author
        try:
            rec = POST_STORE.get(post_id)
            author_id = str(getattr(rec, "author_id", "") or "") if rec is not None else ""
            if author_id and not _same_person(viewer, author_id):
                from siddes_notifications.service import notify
                post_text = str(getattr(rec, "text", "") or "") if rec is not None else ""
                notify(
                    viewer_id=author_id,
                    ntype="like",
                    actor_id=viewer,
                    glimpse=post_text,
                    post_id=post_id,
                    post_title=(post_text[:60] if post_text else None),
                )
        except Exception:
            pass

        return Response({"ok": True, "liked": True, "postId": post_id, "likeCount": _like_count(post_id)}, status=status.HTTP_200_OK)

    def delete(self, request, post_id: str):
        ok, payload = self._ensure_viewable(request, post_id)
        if not ok:
            return payload

        (viewer,) = payload
        PostLike.objects.filter(post_id=post_id, viewer_id=viewer).delete()
        return Response({"ok": True, "liked": False, "postId": post_id, "likeCount": _like_count(post_id)}, status=status.HTTP_200_OK)


# --- Post Echo endpoints (Step 2.2) ---

@method_decorator(dev_csrf_exempt, name="dispatch")
class PostEchoView(APIView):
    throttle_scope = "post_echo"
    """Echo/un-echo a post into the viewer's chosen Side.

    POST   /api/post/<id>/echo?side=<side>    -> create a *pure* echo (empty text)
    DELETE /api/post/<id>/echo?side=<side>    -> remove the *pure* echo

    Notes:
    - Echoing is allowed only for posts whose original side is Public.
    - Echo state/count are scoped to the target side.
    """

    def _ensure_viewable(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return False, Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        if role != "me":
            return False, Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        rec = POST_STORE.get(post_id)
        if rec is None:
            return False, Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        side = str(getattr(rec, "side", "") or "public").strip().lower()
        author_id = str(getattr(rec, "author_id", "") or "")
        set_id = str(getattr(rec, "set_id", "") or "").strip() or None

        ok_set, _set_side = _set_meta(viewer, set_id)
        if not ok_set:
            return False, Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_view_post_record(viewer_id=viewer, side=side, author_id=author_id, set_id=set_id, is_hidden=bool(getattr(rec, "is_hidden", False))):
            return False, Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        # Launch-safe: only echo Public originals.
        if side != "public":
            return False, Response({"ok": False, "error": "echo_forbidden_private"}, status=status.HTTP_403_FORBIDDEN)

        return True, (viewer,)

    def _target_side(self, request) -> str:
        raw = None
        try:
            if isinstance(getattr(request, "data", None), dict):
                raw = request.data.get("side")
        except Exception:
            raw = None
        if not raw:
            raw = getattr(getattr(request, "query_params", {}), "get", lambda *_: None)("side")
        s = str(raw or "public").strip().lower()
        return s if s in _ALLOWED_SIDES else "public"

    def post(self, request, post_id: str):
        ok, payload = self._ensure_viewable(request, post_id)
        if not ok:
            return payload

        (viewer,) = payload
        tgt = self._target_side(request)
        ck = f"echo:{post_id}:{tgt}"

        # Pure echo: empty text, stable client_key for idempotency.
        POST_STORE.create(
            author_id=viewer,
            side=tgt,
            text="",
            set_id=None,
            urgent=False,
            client_key=ck,
            echo_of_post_id=post_id,
        )

        # sd_310_notify_echo: notify original author
        try:
            base = POST_STORE.get(post_id)
            base_author = str(getattr(base, "author_id", "") or "") if base is not None else ""
            if base_author and not _same_person(viewer, base_author):
                from siddes_notifications.service import notify
                base_text = str(getattr(base, "text", "") or "") if base is not None else ""
                notify(
                    viewer_id=base_author,
                    ntype="echo",
                    actor_id=viewer,
                    glimpse="",
                    post_id=post_id,
                    post_title=(base_text[:60] if base_text else None),
                )
        except Exception:
            pass

        return Response({"ok": True, "echoed": True, "postId": post_id, "side": tgt, "echoCount": _echo_count(post_id, side=tgt)}, status=status.HTTP_200_OK)

    def delete(self, request, post_id: str):
        ok, payload = self._ensure_viewable(request, post_id)
        if not ok:
            return payload

        (viewer,) = payload
        tgt = self._target_side(request)
        ck = f"echo:{post_id}:{tgt}"

        # Remove only the pure echo (stable key). Quote-echo posts are regular posts.
        try:
            if hasattr(POST_STORE, "delete_by_author_client_key"):
                POST_STORE.delete_by_author_client_key(author_id=viewer, client_key=ck)  # type: ignore
            else:
                Post.objects.filter(author_id=str(viewer), client_key=ck).delete()
        except Exception:
            pass

        return Response({"ok": True, "echoed": False, "postId": post_id, "side": tgt, "echoCount": _echo_count(post_id, side=tgt)}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class PostQuoteEchoView(APIView):
    throttle_scope = "post_quote"
    """Quote Echo a post (creates a new post with echo_of_post_id set)."""

    def post(self, request, post_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not post_id:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        base = POST_STORE.get(post_id)
        if base is None:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        base_side = str(getattr(base, "side", "") or "public").strip().lower()
        base_author_id = str(getattr(base, "author_id", "") or "")
        base_set_id = str(getattr(base, "set_id", "") or "").strip() or None

        ok_set, _set_side = _set_meta(viewer, base_set_id)
        if not ok_set:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if not _can_view_post_record(viewer_id=viewer, side=base_side, author_id=base_author_id, set_id=base_set_id, is_hidden=bool(getattr(base, "is_hidden", False))):
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        # Launch-safe: only quote-echo Public originals.
        if base_side != "public":
            return Response({"ok": False, "error": "echo_forbidden_private"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        text = str(body.get("text") or "").strip()
        if not text:
            return Response({"ok": False, "error": "empty_text"}, status=status.HTTP_400_BAD_REQUEST)

        tgt = str(body.get("side") or "public").strip().lower()
        if tgt not in _ALLOWED_SIDES:
            tgt = "public"

        # sd_385: align quote-echo write gates with PostCreate (length + trust gates)
        max_len = 800 if tgt == "public" else 5000
        if len(text) > max_len:
            return Response({"ok": False, "error": "too_long", "max": max_len}, status=status.HTTP_400_BAD_REQUEST)

        if trust_gates_enabled() and tgt == "public":
            trust = _trust_level(request, role=role)
            gate = enforce_public_write_gates(viewer_id=viewer, trust_level=trust, text=text, kind="post")
            if not gate.get("ok"):
                st = int(gate.get("status") or 403)
                payload: Dict[str, Any] = {"ok": False, "restricted": st == 401, "error": gate.get("error")}
                if gate.get("retry_after_ms") is not None:
                    payload["retry_after_ms"] = gate.get("retry_after_ms")
                if gate.get("min_trust") is not None:
                    payload["min_trust"] = gate.get("min_trust")
                return Response(payload, status=st)

        client_key = str(body.get("client_key") or body.get("clientKey") or "").strip() or None

        rec = POST_STORE.create(
            author_id=viewer,
            side=tgt,
            text=text,
            set_id=None,
            urgent=False,
            client_key=client_key,
            echo_of_post_id=post_id,
        )

        # sd_310_notify_quote: notify original author
        try:
            if base_author_id and not _same_person(viewer, base_author_id):
                from siddes_notifications.service import notify
                base_text = str(getattr(base, "text", "") or "")
                notify(
                    viewer_id=base_author_id,
                    ntype="echo",
                    actor_id=viewer,
                    glimpse=text,
                    post_id=post_id,
                    post_title=(base_text[:60] if base_text else None),
                )
        except Exception:
            pass

        return Response({"ok": True, "status": 201, "post": _feed_post_from_record(rec, viewer_id=viewer), "side": tgt}, status=status.HTTP_201_CREATED)
