from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt
from siddes_safety.policy import is_blocked_pair

from .models import PrismFacet, PrismSideId, SideMembership


VIEW_SIDES = ("public", "friends", "close", "work")
MEMBER_SIDES = ("friends", "close", "work")


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def viewer_id_for_user(user) -> str:
    return f"me_{getattr(user, 'id', '')}"


def _allowed_set_sides_for_side(side: str) -> set[str]:
    s = str(side or '').strip().lower()
    if s == 'friends':
        return {'friends'}
    if s == 'close':
        return {'friends', 'close'}
    if s == 'work':
        return {'work'}
    return set()

def _prune_member_from_owner_sets(*, owner_tok: str, member_handle: str, allowed_sides: set[str]) -> int:
    """Best-effort: remove member_handle from any of owner's Sets outside allowed_sides.

    Privacy hardening: SideMembership is the canonical 'who can see me' edge.
    If a person is no longer in your Friends/Close/Work, they must not silently
    retain access via old Set membership.
    """
    try:
        from siddes_sets.models import SiddesSet, SiddesSetMember, SiddesSetEvent, SetEventKind  # type: ignore
    except Exception:
        return 0

    owner = str(owner_tok or '').strip()
    mh = str(member_handle or '').strip().lower()
    if not owner or not mh:
        return 0

    # Fast path: membership table -> sets owned by this owner.
    set_ids: list[str] = []
    try:
        qs = SiddesSetMember.objects.select_related('set').filter(member_id=mh, set__owner_id=owner)
        if allowed_sides:
            qs = qs.exclude(set__side__in=list(allowed_sides))
        set_ids = list(qs.values_list('set_id', flat=True))
    except Exception:
        set_ids = []

    try:
        if set_ids:
            sets = list(SiddesSet.objects.filter(id__in=set_ids, owner_id=owner))
        else:
            # Fallback: scan a bounded number of owner sets.
            sets = list(SiddesSet.objects.filter(owner_id=owner)[:800])
    except Exception:
        return 0

    import time as _time
    import uuid as _uuid

    touched = 0
    for s in sets:
        try:
            side = str(getattr(s, 'side', '') or '').strip().lower()
            if allowed_sides and side in allowed_sides:
                continue

            members = getattr(s, 'members', []) or []
            if not isinstance(members, list):
                members = []
            prev = [str(m) for m in members if isinstance(m, (str, int, float))]
            prev_norm = [str(m).strip().lower() for m in prev]
            if mh not in prev_norm:
                # still delete any stale membership row (best-effort)
                try:
                    SiddesSetMember.objects.filter(set=s, member_id=mh).delete()
                except Exception:
                    pass
                continue

            nxt = [prev[i] for i, mn in enumerate(prev_norm) if mn != mh]
            s.members = nxt
            s.save(update_fields=['members', 'updated_at'])

            try:
                SiddesSetMember.objects.filter(set=s, member_id=mh).delete()
            except Exception:
                pass

            # Best-effort audit event
            try:
                SiddesSetEvent.objects.create(
                    id='se_' + _uuid.uuid4().hex[:10],
                    set=s,
                    ts_ms=int(_time.time() * 1000),
                    kind=SetEventKind.MEMBERS_UPDATED,
                    by=owner,
                    data={'from': prev, 'to': nxt, 'via': 'side_prune', 'member': mh, 'allowed': sorted(list(allowed_sides))},
                )
            except Exception:
                pass

            touched += 1
        except Exception:
            continue

    return touched


def _parse_me_id(raw: str) -> Optional[int]:
    s = str(raw or "").strip()
    if not s:
        return None
    s = s.lower()
    if s.startswith("me_"):
        s = s[3:]
    try:
        return int(s)
    except Exception:
        return None


def _user_from_request(request) -> Optional[Any]:
    """Resolve a real Django user.

    Priority:
    1) Real Django session user
    2) (DEBUG only) dev header/cookie (x-sd-viewer / sd_viewer) mapped to Django user id

    NOTE: DRF dev auth may set request.user to a SiddesViewer (id like "me_1").
    We treat that as DEBUG-only and map it back to Django User.
    """

    u = getattr(request, "user", None)
    if u is not None and getattr(u, "is_authenticated", False):
        # If this is a real Django User, id is int.
        try:
            uid = getattr(u, "pk", None)
            if isinstance(uid, int):
                return u
        except Exception:
            pass

        # If this is a SiddesViewer (dev), try to map its id.
        if getattr(settings, "DEBUG", False):
            try:
                vid_raw = getattr(u, "id", None)
                uid2 = _parse_me_id(str(vid_raw or ""))
                if uid2 is not None:
                    User = get_user_model()
                    return User.objects.filter(id=uid2).first()
            except Exception:
                pass

    if not getattr(settings, "DEBUG", False):
        return None

    # DEBUG-only fallback to raw header/cookie
    raw = None
    try:
        raw = request.headers.get("x-sd-viewer")
    except Exception:
        raw = None
    if not raw:
        try:
            raw = getattr(request, "COOKIES", {}).get("sd_viewer")
        except Exception:
            raw = None

    uid = _parse_me_id(str(raw or ""))
    if uid is None:
        return None

    User = get_user_model()
    return User.objects.filter(id=uid).first()


def _pretty_name(username: str) -> str:
    raw = (username or "").replace("_", " ").replace("-", " ").strip()
    if not raw:
        return "You"
    parts = [p for p in raw.split() if p]
    return " ".join([p[:1].upper() + p[1:] for p in parts])


def _ensure_facets(user) -> None:
    username = getattr(user, "username", "") or "you"
    full = _pretty_name(username)
    first = (full.split(" ")[0] if full else "You")
    initial = (first[:1].upper() + ".") if first else "Y."

    defaults: Dict[str, Dict[str, str]] = {
        "public": {
            "display_name": full,
            "headline": "",
            "bio": "",
            "pulse_label": "Town Hall",
            "pulse_text": "",
        },
        "friends": {
            "display_name": first,
            "headline": "",
            "bio": "",
            "pulse_label": "Pulse",
            "pulse_text": "",
        },
        "close": {
            "display_name": initial,
            "headline": "",
            "bio": "",
            "pulse_label": "Pulse",
            "pulse_text": "",
        },
        "work": {
            "display_name": full,
            "headline": "",
            "bio": "",
            "pulse_label": "Pulse",
            "pulse_text": "",
        },
    }

    for side in VIEW_SIDES:
        PrismFacet.objects.get_or_create(user=user, side=side, defaults=defaults.get(side, {}))


def _avatar_url_for_facet(f: PrismFacet) -> Optional[str]:
    """Resolve avatar URL for a facet.

    Uploaded avatar is stored as an R2 key (avatar_media_key). We return a /m/* URL.
    Public side avatars may be public; private sides remain private (short-lived tokens).
    """
    k = str(getattr(f, "avatar_media_key", "") or "").strip()
    if k:
        try:
            from siddes_media.token_urls import build_media_url
            is_pub = str(getattr(f, "side", "") or "").strip().lower() == "public"
            return build_media_url(k, is_public=bool(is_pub))
        except Exception:
            return "/m/" + k.lstrip("/")
    raw = str(getattr(f, "avatar_image_url", "") or "").strip()
    return raw or None


def _facet_dict(f: PrismFacet) -> Dict[str, Any]:
    return {
        "side": f.side,
        "displayName": f.display_name,
        "headline": f.headline,
        "bio": f.bio,
        "location": f.location or None,
        "website": f.website or None,
        "coverImage": (f.cover_image_url or None),
        "avatarMediaKey": (str(getattr(f, "avatar_media_key", "") or "").strip() or None),
        "avatarImage": _avatar_url_for_facet(f),
        "anthem": (
            {"title": f.anthem_title, "artist": f.anthem_artist}
            if (f.anthem_title or f.anthem_artist)
            else None
        ),
        "pulse": (
            {"label": f.pulse_label, "text": f.pulse_text}
            if (f.pulse_label or f.pulse_text)
            else None
        ),
        "updatedAt": f.updated_at.isoformat() if f.updated_at else None,
    }


@method_decorator(dev_csrf_exempt, name="dispatch")
class PrismView(APIView):
    """Owner Prism facets: GET/PATCH /api/prism"""

    def get(self, request):
        user = _user_from_request(request)
        if not user:
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        _ensure_facets(user)
        facets = PrismFacet.objects.filter(user=user).order_by("side")

        return Response(
            {
                "ok": True,
                "user": {"id": user.id, "username": user.username, "handle": "@" + user.username},
                "items": [_facet_dict(f) for f in facets],
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        user = _user_from_request(request)
        if not user:
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        side = str(body.get("side") or "").strip().lower()
        if side not in VIEW_SIDES:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

        _ensure_facets(user)
        f = PrismFacet.objects.filter(user=user, side=side).first()
        if not f:
            f = PrismFacet.objects.create(user=user, side=side)

        # Patch allowed fields
        def _set_str(field: str, key: str, max_len: int) -> None:
            if key in body and isinstance(body.get(key), str):
                v = str(body.get(key) or "").strip()
                setattr(f, field, v[:max_len])

        _set_str("display_name", "displayName", 64)
        _set_str("headline", "headline", 96)
        if "bio" in body and isinstance(body.get("bio"), str):
            f.bio = str(body.get("bio") or "")[:800]
        _set_str("location", "location", 64)
        _set_str("website", "website", 160)

        _set_str("cover_image_url", "coverImage", 300)
        _set_str("avatar_image_url", "avatarImage", 300)
        _set_str("avatar_media_key", "avatarMediaKey", 512)
        anthem = body.get("anthem") if isinstance(body.get("anthem"), dict) else None
        if anthem is not None:
            at = str(anthem.get("title") or "").strip()[:96]
            aa = str(anthem.get("artist") or "").strip()[:96]
            f.anthem_title = at
            f.anthem_artist = aa

        pulse = body.get("pulse") if isinstance(body.get("pulse"), dict) else None
        if pulse is not None:
            pl = str(pulse.get("label") or "").strip()[:48]
            pt = str(pulse.get("text") or "").strip()[:280]
            f.pulse_label = pl
            f.pulse_text = pt

        f.save()

        return Response({"ok": True, "item": _facet_dict(f)}, status=status.HTTP_200_OK)


def _normalize_username(raw: str) -> str:
    s = str(raw or "").strip()
    if s.startswith("@"):
        s = s[1:]
    return s.strip()


@method_decorator(dev_csrf_exempt, name="dispatch")
class ProfileView(APIView):
    """Viewer-resolved profile: GET /api/profile/<username>

    Supports optional query param:
      ?side=public|friends|close|work

    Viewer may only fetch sides in `allowedSides` (no access escalation).
    """

    def get(self, request, username: str):
        User = get_user_model()
        uname = _normalize_username(username).lower()
        if not uname:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        target = User.objects.filter(username__iexact=uname).first()
        if not target:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        viewer = _user_from_request(request)
        viewer_authed = bool(viewer)

        is_owner = bool(viewer and getattr(viewer, 'id', None) == getattr(target, 'id', None))
        # sd_424_profile_blocks: Blocks hard-stop profile visibility
        if viewer and viewer.id != target.id:
            try:
                viewer_tok = viewer_id_for_user(viewer)
                target_tok = "@" + str(getattr(target, "username", "") or "").lower()
                if target_tok and is_blocked_pair(viewer_tok, target_tok):
                    return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            except Exception:
                pass

        # What does the target show the viewer? (owner=target, member=viewer)
        view_side = "public"
        if viewer and viewer.id != target.id:
            rel_in = SideMembership.objects.filter(owner=target, member=viewer).first()
            if rel_in and rel_in.side in VIEW_SIDES:
                view_side = rel_in.side

        # Allowed sides (switching among these does NOT escalate access)
        if is_owner:
            allowed_sides = ["public", "friends", "close", "work"]
        elif view_side == "friends":
            allowed_sides = ["public", "friends"]
        elif view_side == "close":
            allowed_sides = ["public", "friends", "close"]
        elif view_side == "work":
            allowed_sides = ["public", "work"]
        else:
            allowed_sides = ["public"]

        requested = str(request.query_params.get("side") or "").strip().lower()
        if not requested:
            requested = view_side

        if requested not in VIEW_SIDES:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

        if requested not in allowed_sides:
            return Response(
                {
                    "ok": False,
                    "error": "locked",
                    "user": {"id": target.id, "username": target.username, "handle": "@" + target.username},
                    "viewSide": view_side,
                    "requestedSide": requested,
                    "allowedSides": allowed_sides,
                    "isOwner": is_owner,
                "viewerAuthed": viewer_authed,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        _ensure_facets(target)
        facet = PrismFacet.objects.filter(user=target, side=requested).first()
        if not facet:
            facet = PrismFacet.objects.create(user=target, side=requested)

        # What has the viewer done to this target? (owner=viewer, member=target)
        viewer_sided_as = None
        if viewer and viewer.id != target.id:
            rel_out = SideMembership.objects.filter(owner=viewer, member=target).first()
            viewer_sided_as = rel_out.side if rel_out else None

        # Siders count: how many owners have placed target into a side
        siders_count: Optional[int] = None
        if view_side != "close":
            try:
                siders_count = int(SideMembership.objects.filter(member=target).count())
            except Exception:
                siders_count = None

        # Shared sets: sets owned by viewer that include target (best-effort; contract-safe)
        shared_sets: List[str] = []
        if viewer and viewer.id != target.id:
            try:
                from siddes_sets.models import SiddesSet

                v_vid = viewer_id_for_user(viewer)
                t_vid = viewer_id_for_user(target)

                cand = list(SiddesSet.objects.filter(owner_id=v_vid).order_by("-updated_at")[:200])
                for s in cand:
                    try:
                        members = list(getattr(s, "members", []) or [])
                        if t_vid in members:
                            label = str(getattr(s, "label", "") or "").strip()
                            if label:
                                shared_sets.append(label)
                    except Exception:
                        continue

                seen = set()
                out = []
                for x in shared_sets:
                    if x in seen:
                        continue
                    seen.add(x)
                    out.append(x)
                shared_sets = out[:6]
            except Exception:
                shared_sets = []

        # --- Profile posts (side-aware, no access escalation) ---
        # Returns recent posts authored by the target in the requested Side.
        # Visibility rules remain server-truth:
        # - Same Side gating (requestedSide must be allowed)
        # - Set membership (fail-closed)
        # - Block/mute enforcement
        # - Per-viewer hidden posts
        posts_payload: Dict[str, Any] = {"side": requested, "count": 0, "items": [], "nextCursor": None, "hasMore": False}

        try:
            import time
            from django.db.models import Q
            from siddes_post.models import Post  # type: ignore
            from siddes_feed.feed_stub import (
                _bulk_echo,
                _bulk_engagement,
                _bulk_media,
                _can_view_record,
                _hydrate_from_record,
            )

            viewer_tok = viewer_id_for_user(viewer) if viewer else "anon"
            author_tok = viewer_id_for_user(target)

            lim_raw = str(getattr(request, "query_params", {}).get("limit") or "").strip()
            try:
                lim = int(lim_raw) if lim_raw else 40
            except Exception:
                lim = 40
            if lim < 1:
                lim = 1
            if lim > 80:
                lim = 80

            cursor_raw = str(getattr(request, "query_params", {}).get("cursor") or "").strip() or None

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

            # Per-viewer hidden posts (personal)
            hidden_ids: set[str] = set()
            try:
                from siddes_safety.models import UserHiddenPost  # type: ignore

                rows = list(
                    UserHiddenPost.objects.filter(viewer_id=str(viewer_tok))
                    .values_list("post_id", flat=True)[:5000]
                )
                hidden_ids = {str(x).strip() for x in rows if str(x).strip()}
            except Exception:
                hidden_ids = set()

            batch_size = max(200, lim * 5)
            if batch_size > 500:
                batch_size = 500

            visible: List[Any] = []
            after = cursor_raw
            last_scanned: Any = None
            has_more_underlying = False

            loops = 0
            while len(visible) < lim and loops < 5:
                loops += 1

                qs = Post.objects.filter(author_id=author_tok, side=str(requested)).order_by("-created_at", "-id")
                cts, cid = parse_cursor(after)
                if cts is not None and cid:
                    qs = qs.filter(Q(created_at__lt=cts) | (Q(created_at=cts) & Q(id__lt=cid)))

                recs = list(qs[: batch_size + 1])
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
                    if not _can_view_record(viewer_tok, r):
                        continue
                    visible.append(r)
                    if len(visible) >= lim:
                        stopped_early = True
                        break

                if stopped_early:
                    has_more_underlying = True
                    break

                if more_underlying and last_scanned is not None:
                    has_more_underlying = True
                    after = encode_cursor(last_scanned)
                    continue

                has_more_underlying = False
                break

            post_ids = [str(getattr(r, "id", "") or "").strip() for r in visible if str(getattr(r, "id", "") or "").strip()]
            like_counts, reply_counts, liked_ids = _bulk_engagement(viewer_tok, post_ids)
            echo_counts, echoed_ids = _bulk_echo(viewer_tok, post_ids, requested, visible)
            media_map = _bulk_media(post_ids)

            items: List[dict] = []
            side_name = str(getattr(facet, "display_name", "") or "").strip()

            for r in visible:
                pid = str(getattr(r, "id", "") or "").strip()
                it = _hydrate_from_record(
                    r,
                    viewer_id=viewer_tok,
                    like_count=int(like_counts.get(pid, 0) or 0),
                    reply_count=int(reply_counts.get(pid, 0) or 0),
                    liked=(pid in liked_ids),
                    echo_count=int(echo_counts.get(pid, 0) or 0),
                    echoed=(pid in echoed_ids),
                )

                if side_name:
                    it["author"] = side_name

                media = media_map.get(pid) or []
                if media:
                    it["media"] = media
                    it["kind"] = "image"

                items.append(it)

            next_cursor = None
            if has_more_underlying:
                if visible:
                    next_cursor = encode_cursor(visible[-1])
                elif last_scanned is not None:
                    next_cursor = encode_cursor(last_scanned)

            posts_payload = {
                "side": requested,
                "count": len(items),
                "items": items,
                "nextCursor": next_cursor,
                "hasMore": bool(next_cursor),
                "serverTs": time.time(),
            }
        except Exception:
            # Best-effort: profile must still render even if posts hydration fails.
            posts_payload = {"side": requested, "count": 0, "items": [], "nextCursor": None, "hasMore": False}

        return Response(
            {
                "ok": True,
                "user": {"id": target.id, "username": target.username, "handle": "@" + target.username},
                "viewSide": view_side,
                "requestedSide": requested,
                "allowedSides": allowed_sides,
                "facet": _facet_dict(facet),
                "siders": ("Close Vault" if view_side == "close" else siders_count),
                "viewerSidedAs": viewer_sided_as,
                "viewerAuthed": viewer_authed,
                "sharedSets": shared_sets,
                "posts": posts_payload,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(dev_csrf_exempt, name="dispatch")
class SideActionView(APIView):
    """Viewer action: Side/Unside someone. POST /api/side

    Body:
      {"username": "@alice", "side": "friends"|"close"|"work"|"public"}

    Rules:
    - side=public removes the relationship edge (unside)
    - viewer cannot side themselves
    """

    def post(self, request):
        viewer = _user_from_request(request)
        if not viewer:
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        uname = _normalize_username(body.get("username") or body.get("handle") or "")
        if not uname:
            return Response({"ok": False, "error": "missing_username"}, status=status.HTTP_400_BAD_REQUEST)

        side = str(body.get("side") or "").strip().lower()
        if side == "public" or side == "":
            side = "public"
        if side not in VIEW_SIDES:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        target = User.objects.filter(username__iexact=uname).first()
        if not target:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if target.id == viewer.id:
            return Response({"ok": False, "error": "cannot_side_self"}, status=status.HTTP_400_BAD_REQUEST)

        owner_tok = viewer_id_for_user(viewer)
        member_handle = "@" + str(getattr(target, "username", "") or "").lower()


        # sd_424_side_action_blocks: respect blocks (allow unside; prevent setting a side when blocked)
        try:
            viewer_tok = viewer_id_for_user(viewer)
            target_tok = "@" + str(getattr(target, "username", "") or "").lower()
            if target_tok and side != "public" and is_blocked_pair(viewer_tok, target_tok):
                return Response({"ok": False, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass

        if side == "public":
            try:
                _prune_member_from_owner_sets(owner_tok=owner_tok, member_handle=member_handle, allowed_sides=set())
            except Exception:
                pass

            SideMembership.objects.filter(owner=viewer, member=target).delete()
            return Response({"ok": True, "side": None}, status=status.HTTP_200_OK)

        if side not in MEMBER_SIDES:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

        
        # sd_530_confirm_close_work: require explicit confirm for Close/Work
        if side in ("close", "work"):
            c = body.get("confirm")
            if not (c is True or _truthy(str(c))):
                return Response({"ok": False, "error": "confirm_required"}, status=status.HTTP_400_BAD_REQUEST)

# sd_534_close_requires_friends: prevent jumping to Close without Friends first
        if side == "close":
            existing = SideMembership.objects.filter(owner=viewer, member=target).first()
            if not existing or existing.side not in ("friends", "close"): 
                return Response({"ok": False, "error": "friends_required"}, status=status.HTTP_400_BAD_REQUEST)

        obj, _ = SideMembership.objects.update_or_create(
            owner=viewer,
            member=target,
            defaults={"side": side},
        )

        try:
            _prune_member_from_owner_sets(owner_tok=owner_tok, member_handle=member_handle, allowed_sides=_allowed_set_sides_for_side(side))
        except Exception:
            pass

        return Response({"ok": True, "side": obj.side}, status=status.HTTP_200_OK)

@method_decorator(dev_csrf_exempt, name="dispatch")
class SidersLedgerView(APIView):
    """Self-only roster: who can see YOU in each Side.

    GET /api/siders

    Returns people you have placed into Friends/Close/Work (owner=you → member=them).
    """

    def get(self, request):
        viewer = _user_from_request(request)
        if not viewer:
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        # Outgoing edges: viewer → member
        rels = (
            SideMembership.objects.filter(owner=viewer)
            .select_related("member")
            .order_by("-updated_at")
        )

        buckets = {"friends": [], "close": [], "work": []}
        member_ids = []
        for r in rels:
            s = str(getattr(r, "side", "") or "").strip().lower()
            if s not in buckets:
                continue
            m = getattr(r, "member", None)
            if not m:
                continue
            buckets[s].append((m, getattr(r, "updated_at", None)))
            try:
                member_ids.append(int(getattr(m, "id")))
            except Exception:
                pass

        facet_by_uid = {}
        if member_ids:
            try:
                for f in PrismFacet.objects.filter(user_id__in=member_ids, side="public"):
                    facet_by_uid[int(f.user_id)] = f
            except Exception:
                facet_by_uid = {}

        def pack(u, side: str, updated_at):
            uid = int(getattr(u, "id"))
            username = str(getattr(u, "username", "") or "").strip()
            handle = "@" + username if username else ""
            f = facet_by_uid.get(uid)
            display = ""
            avatar = ""
            if f is not None:
                display = str(getattr(f, "display_name", "") or "").strip()
                avatar = str(getattr(f, "avatar_image_url", "") or "").strip()
            if not display:
                display = username or handle or ""
            ts = None
            try:
                ts = updated_at.isoformat() if updated_at is not None else None
            except Exception:
                ts = None
            return {
                "id": uid,
                "handle": handle,
                "displayName": display,
                "avatarImage": avatar,
                "side": side,
                "updatedAt": ts,
            }

        out = {
            "ok": True,
            "counts": {
                "friends": len(buckets["friends"]),
                "close": len(buckets["close"]),
                "work": len(buckets["work"]),
            },
            "sides": {
                "friends": [pack(u, "friends", ts) for (u, ts) in buckets["friends"]],
                "close": [pack(u, "close", ts) for (u, ts) in buckets["close"]],
                "work": [pack(u, "work", ts) for (u, ts) in buckets["work"]],
            },
        }
        return Response(out, status=status.HTTP_200_OK)

