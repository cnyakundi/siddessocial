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

from .models import PrismFacet, PrismSideId, SideMembership, UserFollow


VIEW_SIDES = ("public", "friends", "close", "work")
MEMBER_SIDES = ("friends", "close", "work")


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def viewer_id_for_user(user) -> str:
    return f"me_{getattr(user, 'id', '')}"


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
        if view_side == "friends":
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

        # Public follow (separate from SideMembership)
        viewer_follows = False
        if viewer and viewer.id != target.id:
            try:
                viewer_follows = UserFollow.objects.filter(follower=viewer, target=target).exists()
            except Exception:
                viewer_follows = False

        followers_count = None
        try:
            followers_count = int(UserFollow.objects.filter(target=target).count())
        except Exception:
            followers_count = None

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
                "viewerFollows": bool(viewer_follows),
                "followers": followers_count,
                "sharedSets": shared_sets,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(dev_csrf_exempt, name="dispatch")
class FollowActionView(APIView):
    """Viewer action: Follow/Unfollow someone. POST /api/follow

    Body:
      {"username": "@alice", "follow": true|false}
    """

    def post(self, request):
        viewer = _user_from_request(request)
        if not viewer:
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        uname = _normalize_username(body.get("username") or body.get("handle") or "")
        if not uname:
            return Response({"ok": False, "error": "missing_username"}, status=status.HTTP_400_BAD_REQUEST)

        want = body.get("follow")
        follow = bool(want) if isinstance(want, (bool, int)) else str(want or "").strip().lower() in ("1", "true", "yes", "y", "on", "follow")

        User = get_user_model()
        target = User.objects.filter(username__iexact=uname).first()
        if not target:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if target.id == viewer.id:
            return Response({"ok": False, "error": "cannot_follow_self"}, status=status.HTTP_400_BAD_REQUEST)

        # Respect blocks (allow unfollow; prevent follow when blocked)
        try:
            viewer_tok = viewer_id_for_user(viewer)
            target_tok = "@" + str(getattr(target, "username", "") or "").lower()
            if target_tok and follow and is_blocked_pair(viewer_tok, target_tok):
                return Response({"ok": False, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass

        if not follow:
            UserFollow.objects.filter(follower=viewer, target=target).delete()
            try:
                cnt = int(UserFollow.objects.filter(target=target).count())
            except Exception:
                cnt = None
            return Response({"ok": True, "following": False, "followers": cnt}, status=status.HTTP_200_OK)

        try:
            UserFollow.objects.get_or_create(follower=viewer, target=target)
        except Exception:
            pass

        try:
            cnt = int(UserFollow.objects.filter(target=target).count())
        except Exception:
            cnt = None

        return Response({"ok": True, "following": True, "followers": cnt}, status=status.HTTP_200_OK)


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


        # sd_424_side_action_blocks: respect blocks (allow unside; prevent setting a side when blocked)
        try:
            viewer_tok = viewer_id_for_user(viewer)
            target_tok = "@" + str(getattr(target, "username", "") or "").lower()
            if target_tok and side != "public" and is_blocked_pair(viewer_tok, target_tok):
                return Response({"ok": False, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass

        if side == "public":
            SideMembership.objects.filter(owner=viewer, member=target).delete()
            return Response({"ok": True, "side": None}, status=status.HTTP_200_OK)

        if side not in MEMBER_SIDES:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

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

        return Response({"ok": True, "side": obj.side}, status=status.HTTP_200_OK)
