"""Rituals API (sd_337).

Endpoints:
- GET  /api/rituals?side=<public|friends|close|work>&setId=<optional>
- POST /api/rituals                           (propose)
- GET  /api/rituals/<id>
- POST /api/rituals/<id>/ignite
- POST /api/rituals/<id>/respond
- GET  /api/rituals/<id>/responses

Default-safe rules:
- Unknown viewer => restricted:true on list, 404 on detail.
- Non-public rituals are set-scoped (launch-safe). Set.side is the truth.
- Avoid existence leaks for unreadable set-scoped content.
- Blocked pairs should not see each other (fail-open if safety unavailable).
"""

from __future__ import annotations

import math
import re
import time
import uuid

import json
from typing import Any, Dict, List, Optional, Tuple, Set

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils.decorators import method_decorator

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt
from siddes_inbox.visibility_stub import resolve_viewer_role
from siddes_sets.store_db import DbSetsStore

from .models import Ritual, RitualIgnite, RitualResponse


_ALLOWED_SIDES = {"public", "friends", "close", "work"}
_DOCK_STATUS = {"active", "warming"}



# sd_340: safety hardening (validation + sanitization + kind gating)

_SET_KINDS_V1 = {"mood", "reading", "question"}
_PUBLIC_SIDEWIDE_KINDS_V1 = {"townhall"}
_BROADCAST_KINDS_V1 = {"question"}  # /topics (b_*) keeps Public calm

_MAX_TITLE = 128
_MAX_PROMPT = 240
_MAX_TEXT_PUBLIC = 280
_MAX_TEXT_PRIVATE = 800
_MAX_PAYLOAD_KEYS = 24
_MAX_PAYLOAD_BYTES = 2048


def _clamp_text(s: str, max_len: int) -> str:
    t = str(s or "").strip()
    if not t:
        return ""
    t = re.sub(r"\s+", " ", t)
    if len(t) <= max_len:
        return t
    return t[: max_len - 1].rstrip() + "…"


def _sanitize_payload(raw: Any) -> tuple[dict[str, Any], str | None]:
    # Sanitize payload into a small, flat-ish dict.
    # Returns: (payload, error_code|None)
    if raw is None:
        return {}, None
    if not isinstance(raw, dict):
        return {}, "bad_payload"

    out: dict[str, Any] = {}
    for k, v in raw.items():
        if len(out) >= _MAX_PAYLOAD_KEYS:
            break
        key = str(k or "").strip()
        if not key or len(key) > 64:
            continue
        if not re.match(r"^[A-Za-z0-9_\-]+$", key):
            continue

        val: Any
        if v is None or isinstance(v, (bool, int, float)):
            val = v
        elif isinstance(v, str):
            val = _clamp_text(v, 280)
        else:
            val = _clamp_text(str(v), 280)

        out[key] = val

    try:
        b = json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(b) > _MAX_PAYLOAD_BYTES:
            return {}, "payload_too_large"
    except Exception:
        return {}, "bad_payload"

    return out, None


def _ritual_is_open(r: Ritual) -> bool:
    try:
        if str(getattr(r, "status", "") or "") == "archived":
            return False
        exp = getattr(r, "expires_at", None)
        if exp is not None and float(exp) <= now_s():
            return False
    except Exception:
        return False
    return True


def _archive_other_active_in_set(*, set_id: str, keep_id: str) -> None:
    sid = str(set_id or "").strip()
    if not sid:
        return
    try:
        Ritual.objects.filter(set_id=sid, status="active").exclude(id=str(keep_id)).update(status="archived", expires_at=now_s())
    except Exception:
        return

def now_s() -> float:
    return float(time.time())


def new_id(prefix: str) -> str:
    return f"{prefix}_{int(now_s() * 1000)}_{uuid.uuid4().hex[:8]}"


def _raw_viewer_from_request(request) -> Optional[str]:
    # Align with existing Siddes views (feed/sets):
    # - Real/DRF-authenticated user => me_<user.id>
    # - DEBUG-only fallback => x-sd-viewer header or sd_viewer cookie

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


def _restricted_payload(has_viewer: bool, viewer: str, role: str, *, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {"ok": True, "restricted": True, "viewer": viewer if has_viewer else None, "role": role}
    if extra:
        out.update(extra)
    return out


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


def _is_blocked_pair(viewer_id: str, other_id: str) -> bool:
    try:
        from siddes_safety.policy import is_blocked_pair

        return bool(is_blocked_pair(viewer_id, other_id))
    except Exception:
        return False


def _set_item_for_viewer(viewer_id: str, set_id: str) -> Optional[Dict[str, Any]]:
    sid = str(set_id or "").strip()
    if not sid or sid.startswith("b_"):
        return None
    try:
        return DbSetsStore().get(owner_id=str(viewer_id), set_id=sid)
    except Exception:
        return None


def _ritual_to_item(r: Ritual) -> Dict[str, Any]:
    data = r.data if isinstance(r.data, dict) else {}
    return {
        "id": str(r.id),
        "kind": str(r.kind),
        "title": str(r.title or ""),
        "prompt": str(r.prompt or ""),
        "status": str(r.status),
        "side": str(r.side),
        "setId": str(r.set_id) if r.set_id else None,
        "createdBy": str(r.created_by),
        "createdAt": float(r.created_at or 0.0),
        "expiresAt": float(r.expires_at) if r.expires_at is not None else None,
        "igniteThreshold": int(r.ignite_threshold or 0),
        "ignites": int(r.ignites or 0),
        "replies": int(r.replies or 0),
        "data": data,
    }


def _compute_threshold(set_item: Dict[str, Any]) -> int:
    members = set_item.get("members") if isinstance(set_item, dict) else None
    m = members if isinstance(members, list) else []
    size = 1 + len([x for x in m if str(x or "").strip()])
    return int(min(10, max(2, math.ceil(math.sqrt(max(1, size))))))


def _default_expires_at(side: str) -> float:
    n = now_s()
    if side == "public":
        return n + 24 * 3600
    if side == "work":
        return n + 8 * 3600
    return n + 6 * 3600


def _clamp_expires(raw: Any, *, side: str) -> Optional[float]:
    if raw is None:
        return _default_expires_at(side)
    try:
        v = float(raw)
    except Exception:
        return _default_expires_at(side)

    n = now_s()
    if v <= n + 60:
        return _default_expires_at(side)
    max_v = n + 72 * 3600
    return min(v, max_v)


def _refresh_counts_and_status(r: Ritual) -> Ritual:
    try:
        ign = RitualIgnite.objects.filter(ritual=r).count()
    except Exception:
        ign = int(getattr(r, "ignites", 0) or 0)

    try:
        rep = RitualResponse.objects.filter(ritual=r).count()
    except Exception:
        rep = int(getattr(r, "replies", 0) or 0)

    r.ignites = int(ign)
    r.replies = int(rep)

    if str(r.side) != "public" and str(r.status) == "warming":
        thr = int(getattr(r, "ignite_threshold", 0) or 0)
        if thr > 0 and r.ignites >= thr:
            r.status = "active"

    return r


def _update_dock_summary(r: Ritual) -> Ritual:
    data: Dict[str, Any] = r.data if isinstance(r.data, dict) else {}

    thr = int(getattr(r, "ignite_threshold", 0) or 0)
    if thr > 0:
        data["progress"] = int(min(100, round((float(r.ignites) / float(max(1, thr))) * 100)))
        data["label"] = f"{r.ignites}/{thr} ignites"

    kind = str(getattr(r, "kind", "") or "").strip().lower()

    # Recent responders -> avatars
    try:
        rs = list(RitualResponse.objects.filter(ritual=r).order_by("-created_at")[:6])
        names: List[str] = []
        for rr in rs:
            try:
                from siddes_backend.identity import display_for_token

                d = display_for_token(str(getattr(rr, "by", "") or ""))
                nm = str((d or {}).get("name") or "").strip()
                if nm and nm not in names:
                    names.append(nm)
            except Exception:
                by = str(getattr(rr, "by", "") or "").strip()
                if by and by not in names:
                    names.append(by)
        if names:
            data["avatars"] = names[:3]
    except Exception:
        pass


    # Public Town Hall host (Gavel)
    if kind == "townhall" and str(getattr(r, "side", "") or "") == "public":
        try:
            from siddes_backend.identity import display_for_token

            d = display_for_token(str(getattr(r, "created_by", "") or ""))
            host = ""
            if isinstance(d, dict):
                host = str(d.get("name") or d.get("handle") or d.get("id") or "").strip()
            else:
                host = str(getattr(r, "created_by", "") or "").strip()
            if host:
                data["host"] = host
        except Exception:
            host = str(getattr(r, "created_by", "") or "").strip()
            if host:
                data["host"] = host

    if kind == "mood":
        try:
            rs = list(RitualResponse.objects.filter(ritual=r).order_by("-created_at")[:25])
            counts: Dict[str, int] = {}
            for rr in rs:
                payload = getattr(rr, "payload", {})
                if not isinstance(payload, dict):
                    continue
                v = str(payload.get("emoji") or payload.get("mood") or "").strip()
                if not v:
                    continue
                counts[v] = counts.get(v, 0) + 1
            top = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:2]
            if top:
                data["vibe"] = " / ".join([k for k, _ in top])
        except Exception:
            pass

    if kind in ("question", "townhall"):
        try:
            rs = list(RitualResponse.objects.filter(ritual=r).order_by("-created_at")[:50])
            top: List[str] = []
            for rr in rs:
                t = str(getattr(rr, "text", "") or "").strip()
                if not t:
                    continue
                t = re.sub(r"\s+", " ", t)
                if len(t) > 24:
                    t = t[:24].rstrip() + "…"
                if t not in top:
                    top.append(t)
                if len(top) >= 3:
                    break
            if top:
                data["topAnswers"] = top
        except Exception:
            pass

    r.data = data
    return r


def _load_ritual_or_none(*, viewer_id: str, ritual_id: str) -> Optional[Ritual]:
    rid = str(ritual_id or "").strip()
    if not rid:
        return None

    try:
        r = Ritual.objects.filter(id=rid).first()
    except Exception:
        r = None
    if not r:
        return None

    if _is_blocked_pair(viewer_id, str(getattr(r, "created_by", "") or "")):
        if not (_same_person(viewer_id, str(getattr(r, "created_by", "") or "")) or _viewer_is_staff(viewer_id)):
            return None

    side = str(getattr(r, "side", "") or "public").strip().lower() or "public"
    sid = str(getattr(r, "set_id", "") or "").strip() or None

    if side == "public":
        return r

    if not sid:
        if _same_person(viewer_id, str(getattr(r, "created_by", "") or "")) or _viewer_is_staff(viewer_id):
            return r
        return None

    if sid.startswith("b_"):
        return r

    set_item = _set_item_for_viewer(viewer_id, sid)
    if not set_item:
        return None

    set_side = str((set_item or {}).get("side") or "").strip().lower()
    if set_side in _ALLOWED_SIDES and set_side != side:
        return None

    return r


@method_decorator(dev_csrf_exempt, name="dispatch")
class RitualsView(APIView):
    """GET/POST /api/rituals"""

    throttle_scope = "ritual_list"

    def get_throttles(self):
        # Method-specific throttle scopes.
        if getattr(self, 'request', None) is not None and self.request.method == 'POST':
            self.throttle_scope = 'ritual_create'
        else:
            self.throttle_scope = 'ritual_list'
        return super().get_throttles()

    permission_classes: list = []

    def get(self, request, *args, **kwargs):
        has_viewer, viewer, role = _viewer_ctx(request)

        side_raw = str(getattr(request, "query_params", {}).get("side") or "public").strip().lower()
        side = side_raw if side_raw in _ALLOWED_SIDES else "public"

        qp = getattr(request, "query_params", {})
        set_id = str(qp.get("setId") or qp.get("set_id") or "").strip() or None

        if not has_viewer:
            return Response(
                _restricted_payload(has_viewer, viewer, role, extra={"side": side, "setId": set_id, "items": []}),
                status=status.HTTP_200_OK,
            )

        set_item = None
        if side != "public":
            if not set_id:
                return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "side": side, "setId": None, "items": []}, status=status.HTTP_200_OK)

            set_item = _set_item_for_viewer(viewer, set_id)
            if not set_item:
                return Response(
                    _restricted_payload(has_viewer, viewer, role, extra={"side": side, "setId": set_id, "items": []}),
                    status=status.HTTP_200_OK,
                )

            set_side = str((set_item or {}).get("side") or "").strip().lower()
            if set_side in _ALLOWED_SIDES:
                side = set_side

        n = now_s()
        qs = Ritual.objects.filter(side=side, status__in=list(_DOCK_STATUS)).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=n))

        if side == "public":
            qs = qs.filter(set_id__isnull=True)
        else:
            qs = qs.filter(set_id=str(set_id))

        items: List[Dict[str, Any]] = []

        if side == "public":
            # prefer the daily town hall (one-card dock)
            cand = None
            try:
                cand = qs.filter(kind__iexact="townhall", status="active").order_by("-created_at").first()
            except Exception:
                cand = None
            candidates = [cand] if cand is not None else list(qs.order_by("-created_at")[:10])
        else:
            candidates = list(qs.order_by("-created_at")[:10])

        for r in candidates:
            if not r:
                continue
            if _is_blocked_pair(viewer, str(getattr(r, "created_by", "") or "")):
                continue
            items.append(_ritual_to_item(r))
            if side == "public":
                break
            if len(items) >= 2:
                break


        return Response({"ok": True, "restricted": False, "viewer": viewer, "role": role, "side": side, "setId": set_id, "items": items}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return Response({"ok": False, "restricted": True, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        kind = str(body.get("kind") or "").strip().lower()
        title = str(body.get("title") or "").strip()
        prompt = str(body.get("prompt") or "").strip()
        side = str(body.get("side") or "public").strip().lower() or "public"
        set_id = str(body.get("setId") or body.get("set_id") or "").strip() or None


        # Public Town Hall is always side-wide (no set scope).
        if kind == "townhall":
            if set_id:
                return Response({"ok": False, "error": "townhall_requires_public_scope"}, status=status.HTTP_400_BAD_REQUEST)
            side = "public"
            if not title:
                title = "Daily Town Hall"


        # sd_340: clamp + normalize (prevents oversized prompts / titles)
        title = _clamp_text(title, _MAX_TITLE)
        prompt = _clamp_text(prompt, _MAX_PROMPT)

        if not kind or len(kind) > 32:
            return Response({"ok": False, "error": "bad_kind"}, status=status.HTTP_400_BAD_REQUEST)
        if not prompt:
            return Response({"ok": False, "error": "empty_prompt"}, status=status.HTTP_400_BAD_REQUEST)

        set_item = None

        if set_id and str(set_id).startswith("b_"):
            side = "public"
            try:
                from siddes_broadcasts.store_db import STORE as _BC_STORE

                if not _BC_STORE.can_write(viewer_id=viewer, broadcast_id=str(set_id)):
                    return Response({"ok": False, "restricted": True, "error": "broadcast_write_forbidden"}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                return Response({"ok": False, "restricted": True, "error": "broadcast_unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if set_id and not str(set_id).startswith("b_"):
            set_item = _set_item_for_viewer(viewer, str(set_id))
            if not set_item:
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            set_side = str((set_item or {}).get("side") or "").strip().lower()
            if set_side in _ALLOWED_SIDES:
                side = set_side

        if not set_id:
            if side != "public":
                return Response({"ok": False, "error": "set_required"}, status=status.HTTP_400_BAD_REQUEST)
            if not getattr(settings, "DEBUG", False) and not _viewer_is_staff(viewer):
                return Response({"ok": False, "restricted": True, "error": "public_write_forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # sd_340: kind gating keeps Public calm + keeps rooms structured
        is_broadcast = bool(set_id and str(set_id).startswith('b_'))
        if side == 'public' and not set_id:
            if kind not in _PUBLIC_SIDEWIDE_KINDS_V1:
                return Response({'ok': False, 'error': 'public_kind_forbidden'}, status=status.HTTP_400_BAD_REQUEST)
        elif is_broadcast:
            if kind not in _BROADCAST_KINDS_V1:
                return Response({'ok': False, 'error': 'broadcast_kind_forbidden'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if kind not in _SET_KINDS_V1:
                return Response({'ok': False, 'error': 'kind_forbidden'}, status=status.HTTP_400_BAD_REQUEST)

        thr = 0
        if side != "public" and set_item:
            thr = _compute_threshold(set_item)

        st = "active" if side == "public" else "warming"
        exp = _clamp_expires(body.get("expiresAt") or body.get("expires_at"), side=side)

        rid = new_id("rt")
        created_at = now_s()

        with transaction.atomic():
            if side == "public" and kind == "townhall":
                try:
                    Ritual.objects.filter(side="public", kind__iexact="townhall", status__in=["active", "warming"]).update(status="archived", expires_at=created_at)
                except Exception:
                    pass

            # sd_340: only one warming ritual per set at a time (keeps the room calm)
            if side != 'public' and set_id and not str(set_id).startswith('b_'):
                try:
                    Ritual.objects.filter(set_id=str(set_id), status='warming').update(status='archived', expires_at=created_at)
                except Exception:
                    pass

            r = Ritual.objects.create(
                id=rid,
                side=side,
                set_id=set_id,
                kind=kind,
                title=title,
                prompt=prompt,
                status=st,
                created_by=viewer,
                created_at=created_at,
                expires_at=exp,
                ignite_threshold=int(thr),
                ignites=0,
                replies=0,
                data={},
            )

            if side != "public" and int(thr) > 0:
                try:
                    RitualIgnite.objects.create(id=new_id("ri"), ritual=r, by=viewer, created_at=created_at)
                except Exception:
                    pass

            prev_status = str(getattr(r, 'status', '') or '')
            r = _refresh_counts_and_status(r)
            became_active = prev_status != 'active' and str(getattr(r, 'status', '') or '') == 'active'
            if became_active and str(getattr(r, 'side', '') or '') != 'public' and str(getattr(r, 'set_id', '') or ''):
                _archive_other_active_in_set(set_id=str(getattr(r, 'set_id', '') or ''), keep_id=str(getattr(r, 'id', '') or ''))
            r = _update_dock_summary(r)
            r.save(update_fields=["status", "ignites", "replies", "data"])

        return Response({"ok": True, "ritual": _ritual_to_item(r)}, status=status.HTTP_201_CREATED)


class RitualDetailView(APIView):
    """GET /api/rituals/<id>"""

    throttle_scope = "ritual_detail"
    permission_classes: list = []

    def get(self, request, ritual_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not ritual_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        r = _load_ritual_or_none(viewer_id=viewer, ritual_id=ritual_id)
        if not r:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"ok": True, "ritual": _ritual_to_item(r)}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class RitualIgniteView(APIView):
    """POST /api/rituals/<id>/ignite"""

    throttle_scope = "ritual_ignite"
    permission_classes: list = []

    def post(self, request, ritual_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not ritual_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        r = _load_ritual_or_none(viewer_id=viewer, ritual_id=ritual_id)
        if not r:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        # sd_340: do not allow interactions on expired/archived rituals
        if not _ritual_is_open(r):
            return Response({'ok': False, 'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

        if str(getattr(r, "side", "")) == "public":
            return Response({"ok": True, "ritual": _ritual_to_item(r)}, status=status.HTTP_200_OK)

        with transaction.atomic():
            try:
                RitualIgnite.objects.get_or_create(
                    ritual=r,
                    by=viewer,
                    defaults={"id": new_id("ri"), "created_at": now_s()},
                )
            except Exception:
                pass

            r = _refresh_counts_and_status(r)
            r = _update_dock_summary(r)
            r.save(update_fields=["status", "ignites", "replies", "data"])

        return Response({"ok": True, "ritual": _ritual_to_item(r)}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class RitualRespondView(APIView):
    """POST /api/rituals/<id>/respond"""

    throttle_scope = "ritual_respond"

    def get_throttles(self):
        # Public Town Hall answers use a tighter scope than private-room replies.
        rid = str(getattr(self, 'kwargs', {}).get('ritual_id') or '')
        scope = 'ritual_respond'
        try:
            r = Ritual.objects.filter(id=rid).only('side', 'kind').first()
            if r is not None and str(getattr(r, 'side', '') or '') == 'public' and str(getattr(r, 'kind', '') or '').lower() == 'townhall':
                scope = 'ritual_public_answer'
        except Exception:
            scope = 'ritual_respond'
        self.throttle_scope = scope
        return super().get_throttles()

    permission_classes: list = []

    def post(self, request, ritual_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not ritual_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        r = _load_ritual_or_none(viewer_id=viewer, ritual_id=ritual_id)
        if not r:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        payload = body.get("payload") if isinstance(body.get("payload"), dict) else {}
        text = str(body.get("text") or "").strip()

        if not payload and not text:
            return Response({"ok": False, "error": "empty_response"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if str(getattr(r, "side", "")) != "public":
                try:
                    RitualIgnite.objects.get_or_create(
                        ritual=r,
                        by=viewer,
                        defaults={"id": new_id("ri"), "created_at": now_s()},
                    )
                except Exception:
                    pass

            existing = None
            try:
                existing = RitualResponse.objects.filter(ritual=r, by=viewer).first()
            except Exception:
                existing = None

            if existing is None:
                try:
                    existing = RitualResponse.objects.create(
                        id=new_id("rr"),
                        ritual=r,
                        by=viewer,
                        created_at=now_s(),
                        kind=str(getattr(r, "kind", "") or ""),
                        payload=payload,
                        text=text,
                    )
                except Exception:
                    existing = None
            else:
                existing.payload = payload
                existing.text = text
                existing.created_at = now_s()
                try:
                    existing.save(update_fields=["payload", "text", "created_at"])
                except Exception:
                    pass

            r = _refresh_counts_and_status(r)
            r = _update_dock_summary(r)
            r.save(update_fields=["status", "ignites", "replies", "data"])

        return Response({"ok": True, "ritual": _ritual_to_item(r)}, status=status.HTTP_200_OK)


class RitualResponsesView(APIView):
    """GET /api/rituals/<id>/responses"""

    throttle_scope = "ritual_responses"
    permission_classes: list = []

    def get(self, request, ritual_id: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer or not ritual_id:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        r = _load_ritual_or_none(viewer_id=viewer, ritual_id=ritual_id)
        if not r:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        items: List[Dict[str, Any]] = []
        try:
            qs = RitualResponse.objects.filter(ritual=r).order_by("-created_at")[:50]
        except Exception:
            qs = []

        for rr in qs:
            by = str(getattr(rr, "by", "") or "").strip()
            disp = None
            try:
                from siddes_backend.identity import display_for_token

                disp = display_for_token(by)
            except Exception:
                disp = {"id": by, "handle": "@unknown", "name": by}

            items.append(
                {
                    "id": str(getattr(rr, "id", "") or ""),
                    "by": by,
                    "byDisplay": disp,
                    "createdAt": float(getattr(rr, "created_at", 0.0) or 0.0),
                    "kind": str(getattr(rr, "kind", "") or ""),
                    "payload": getattr(rr, "payload", {}) if isinstance(getattr(rr, "payload", {}), dict) else {},
                    "text": str(getattr(rr, "text", "") or ""),
                }
            )

        return Response({"ok": True, "ritualId": str(r.id), "items": items}, status=status.HTTP_200_OK)
