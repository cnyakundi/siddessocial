"""Inbox API views (Django REST Framework).

Goals:
- Match `docs/INBOX_BACKEND_CONTRACT.md` exactly.
- Stay **default-safe**: if a viewer can't be confidently authenticated/authorized,
  return `restricted: true` with no content.

Implementation note:
- We do NOT use Django Ninja. DRF is the official API layer.
- We exempt these endpoints from Django's CSRF middleware because the API will
  ultimately be token/session-authenticated at the application layer (not via
  CSRF-protected form posts). This keeps dev flow working for beginners.
"""

from __future__ import annotations

import hashlib
import os

# sd_121b: explicit mode boolean for SD_INBOX_STORE=db (used by test harness gate)
USE_DB = (str(os.environ.get("SD_INBOX_STORE", "")).strip().lower() == "db")

from typing import Any, Optional

from django.utils.decorators import method_decorator
from siddes_backend.csrf import dev_csrf_exempt
from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .endpoint_stub import ensure_thread, get_thread, list_threads, send_message, set_locked_side
from .store_devnull import DevNullInboxStore
from .store_db import DbInboxStore
from .store_memory import InMemoryInboxStore
from .models_stub import ParticipantRecord, SideId
from .visibility_stub import resolve_viewer_role

from siddes_safety.policy import is_blocked_pair, normalize_target_token


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")

# --- Inbox server-side cache (sd_582) ---
# Cache is server-side only (never edge-cache personalized/private payloads).
# Key includes viewer + side + cursor + limit. We also include a per-viewer "version"
# that is bumped after inbox mutations (send/lock) to avoid serving stale thread state.

def _inbox_cache_enabled() -> bool:
    return _truthy(os.environ.get("SIDDES_INBOX_CACHE_ENABLED", "1"))


def _inbox_cache_ttl() -> int:
    raw = os.environ.get("SIDDES_INBOX_CACHE_TTL_SECS", "15")
    try:
        ttl = int(str(raw).strip())
    except Exception:
        ttl = 15
    if ttl < 0:
        ttl = 0
    # Hard cap (avoid accidentally caching private payloads for too long)
    if ttl > 300:
        ttl = 300
    return ttl


_INBOX_VER_TTL_SECS = 7 * 24 * 60 * 60  # 7 days


def _inbox_ver_key(viewer_id: str) -> str:
    v = str(viewer_id or "").strip() or "anon"
    return f"inbox:v1:ver:{v}"


def _inbox_get_ver(viewer_id: str) -> int:
    try:
        v = cache.get(_inbox_ver_key(viewer_id))
        iv = int(v) if v is not None else 1
        return iv if iv > 0 else 1
    except Exception:
        return 1


def _inbox_bump_ver(viewer_id: str) -> None:
    v = str(viewer_id or "").strip()
    if not v:
        return
    k = _inbox_ver_key(v)
    try:
        cache.add(k, 1, timeout=_INBOX_VER_TTL_SECS)
        cache.incr(k)  # type: ignore[attr-defined]
    except Exception:
        try:
            cur = cache.get(k)
            nxt = (int(cur) + 1) if cur is not None else 2
            cache.set(k, nxt, timeout=_INBOX_VER_TTL_SECS)
        except Exception:
            pass


def _inbox_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _inbox_threads_cache_key(*, viewer_id: str, ver: int, side: str | None, limit: int, cursor: str | None) -> str:
    raw = f"v1|ver={ver}|viewer={viewer_id}|side={side or ''}|limit={limit}|cursor={cursor or ''}"
    return f"inbox:threads:v1:{_inbox_hash(raw)}"


def _inbox_thread_cache_key(*, viewer_id: str, ver: int, thread_id: str, limit: int, cursor: str | None) -> str:
    raw = f"v1|ver={ver}|viewer={viewer_id}|thread={thread_id}|limit={limit}|cursor={cursor or ''}"
    return f"inbox:thread:v1:{_inbox_hash(raw)}"



SIDE_IDS = ("public", "friends", "close", "work")

# sd_398: inbox blocks enforcement (hard stop: no view, no DM)


def _restricted_meta_payload() -> dict[str, Any]:
    return {"ok": True, "restricted": True, "meta": None}


def _restricted_send_payload() -> dict[str, Any]:
    return {"ok": True, "restricted": True, "message": None, "meta": None}


def _restricted_thread_payload() -> dict[str, Any]:
    return {
        "ok": True,
        "restricted": True,
        "thread": None,
        "meta": None,
        "messages": [],
        "messagesHasMore": False,
        "messagesNextCursor": None,
    }


def _other_token_from_thread_payload(thread_obj: Any) -> Optional[str]:
    try:
        t = thread_obj or {}
        if not isinstance(t, dict):
            return None
        p = t.get("participant") or {}
        if not isinstance(p, dict):
            return None
        tok = str(p.get("handle") or p.get("userId") or "").strip()
        return tok or None
    except Exception:
        return None


def _counterparty_token_for_thread_id(thread_id: str) -> Optional[str]:
    """Best-effort: look up the DB thread snapshot and return other party token.

    Memory-store threads may not exist in DB; fail-open in that case.
    """
    try:
        from .models import InboxThread  # local import (db store only)
        t = InboxThread.objects.filter(id=str(thread_id)).first()
        if not t:
            return None
        tok = str(getattr(t, "participant_handle", "") or "").strip()
        if tok:
            return tok
        tok2 = str(getattr(t, "participant_user_id", "") or "").strip()
        return tok2 or None
    except Exception:
        return None


# sd_609_bulk_blocks: bulk block filtering for inbox threads list (avoid N+1 is_blocked_pair calls)


def _sd_609_norm(raw: str | None) -> Optional[str]:
    try:
        from siddes_safety.policy import normalize_target_token

        return normalize_target_token(str(raw or "")) or None
    except Exception:
        s = str(raw or "").strip()
        return s or None


def _sd_609_counterparty_tokens(item: Any) -> list[str]:
    try:
        if not isinstance(item, dict):
            return []
        p = item.get("participant")
        if not isinstance(p, dict):
            return []
        out: list[str] = []
        for k in ("handle", "userId"):
            v = str(p.get(k) or "").strip()
            if v:
                out.append(v)
        return out
    except Exception:
        return []


def _sd_609_viewer_blocker_ids(viewer_id: str) -> list[str]:
    v = str(viewer_id or "").strip()
    if not v:
        return []
    try:
        from siddes_backend.identity import viewer_aliases

        out = set(viewer_aliases(v) or set())
        # Include legacy dev owner token for safety parity (seeded content uses owner_id="me").
        if v.startswith("me_"):
            out.add("me")
        out.add(v)
        return [str(x).strip() for x in out if str(x).strip()]
    except Exception:
        return [v]


def _sd_609_handle_maps(handles: set[str]) -> tuple[dict[str, str], dict[str, str]]:
    """Return (handle->me_<id>, me_<id>->handle) best-effort."""

    try:
        from django.contrib.auth import get_user_model
        from django.db.models import Q

        User = get_user_model()

        names: list[str] = []
        for h in handles:
            hh = str(h or "").strip()
            if not hh:
                continue
            if hh.startswith("@"):  # strip leading @
                hh = hh[1:]
            hh = hh.strip()
            if hh:
                names.append(hh)

        if not names:
            return {}, {}

        q = Q()
        for n in sorted({x.lower() for x in names if x}):
            q |= Q(username__iexact=n)

        if not q:
            return {}, {}

        rows = list(User.objects.filter(q).values_list("id", "username"))
        h2m: dict[str, str] = {}
        m2h: dict[str, str] = {}
        for uid, uname in rows:
            u = str(uname or "").strip()
            if not u:
                continue
            h = "@" + u.lower()
            mid = f"me_{uid}"
            h2m[h] = mid
            m2h[mid] = h
        return h2m, m2h
    except Exception:
        return {}, {}


def _sd_609_bulk_blocked_counterparty_norms(viewer_id: str, items: list[Any]) -> set[str]:
    """Return normalized counterparty tokens blocked either direction.

    Output contains both forms when possible:
      - @handle
      - me_<id>

    This is a best-effort optimization and must never break inbox endpoints.
    """

    try:
        v = str(viewer_id or "").strip()
        if not v:
            return set()

        # Gather counterparty tokens
        raw: set[str] = set()
        handles: set[str] = set()
        for it in items:
            for tok in _sd_609_counterparty_tokens(it):
                t = str(tok or "").strip()
                if not t:
                    continue
                raw.add(t)
                if t.startswith("@"):  # normalize handles for mapping
                    handles.add(t.lower())

        handle_to_me, me_to_handle = _sd_609_handle_maps(handles)

        other_norm: set[str] = set()
        other_blocker_ids: set[str] = set()

        for t in raw:
            other_blocker_ids.add(t)
            nt = _sd_609_norm(t)
            if nt:
                other_norm.add(nt)
                if nt.startswith("@") and nt in handle_to_me:
                    other_blocker_ids.add(handle_to_me[nt])

        # Expand known handle<->me mappings
        for h, mid in handle_to_me.items():
            other_norm.add(h)
            other_blocker_ids.add(mid)

        v_blocker_ids = _sd_609_viewer_blocker_ids(v)
        v_targets: set[str] = set()
        for x in v_blocker_ids:
            nt = _sd_609_norm(x)
            if nt:
                v_targets.add(nt)

        if not other_norm or not v_targets or not v_blocker_ids:
            return set()

        from siddes_safety.models import UserBlock

        blocked: set[str] = set()

        # viewer -> other
        rows1 = UserBlock.objects.filter(
            blocker_id__in=v_blocker_ids,
            blocked_token__in=list(other_norm),
        ).values_list("blocked_token", flat=True)

        for x in rows1:
            tok = str(x or "").strip()
            if not tok:
                continue
            blocked.add(tok)
            if tok.startswith("@") and tok in handle_to_me:
                blocked.add(handle_to_me[tok])
            if tok.startswith("me_") and tok in me_to_handle:
                blocked.add(me_to_handle[tok])

        # other -> viewer
        rows2 = UserBlock.objects.filter(
            blocker_id__in=list(other_blocker_ids),
            blocked_token__in=list(v_targets),
        ).values_list("blocker_id", flat=True)

        for x in rows2:
            bid = str(x or "").strip()
            if not bid:
                continue
            # include raw blocker id
            blocked.add(bid)
            nb = _sd_609_norm(bid)
            if nb:
                blocked.add(nb)
                if nb.startswith("@") and nb in handle_to_me:
                    blocked.add(handle_to_me[nb])
            if bid.startswith("me_") and bid in me_to_handle:
                blocked.add(me_to_handle[bid])

        return {str(b).strip() for b in blocked if str(b).strip()}
    except Exception:
        return set()


def _filter_blocked_threads_payload(viewer_id: Optional[str], payload: Any) -> Any:
    """Filter blocked threads in bulk (sd_609).

    Previous behavior called `is_blocked_pair` per item (N+1 queries).
    """

    try:
        if not viewer_id or not isinstance(payload, dict) or payload.get("restricted"):
            return payload
        items = payload.get("items")
        if not isinstance(items, list) or not items:
            return payload

        blocked = _sd_609_bulk_blocked_counterparty_norms(str(viewer_id), items)
        if not blocked:
            return payload

        kept = []
        for it in items:
            toks = _sd_609_counterparty_tokens(it)
            norms: set[str] = set()
            for t in toks:
                nt = _sd_609_norm(t)
                if nt:
                    norms.add(nt)
                if str(t).startswith("@"):  # raw handle form
                    norms.add(str(t).lower())

            if norms and any(n in blocked for n in norms):
                continue
            kept.append(it)

        out = dict(payload)
        out["items"] = kept
        return out
    except Exception:
        return payload


def _restrict_blocked_thread_payload(viewer_id: Optional[str], payload: Any) -> Any:
    try:
        if not viewer_id or not isinstance(payload, dict) or payload.get("restricted"):
            return payload
        tok = _other_token_from_thread_payload(payload.get("thread"))
        if tok and is_blocked_pair(str(viewer_id), str(tok)):
            return _restricted_thread_payload()
        return payload
    except Exception:
        return payload

# sd_609_bulk_blocks: end


def _db_ready() -> bool:
    """Best-effort check: is the DB reachable and are Inbox tables migrated?

    Purpose (sd_123): support `SD_INBOX_STORE=auto`.

    We keep this intentionally forgiving:
    - If the DB is down, we fall back to the in-memory store.
    - If migrations haven't been applied yet, we also fall back.
    """

    try:
        from django.db import connections

        conn = connections["default"]
        conn.ensure_connection()

        # Touch a known inbox table to confirm migrations are applied.
        from .models import InboxThread

        InboxThread.objects.using(conn.alias).all()[:1].exists()
        return True
    except Exception:
        return False



IS_DEBUG = getattr(settings, "DEBUG", False)

# Store selection (sd_121b / sd_123)
#
# SD_INBOX_STORE modes:
#   - memory (default): dev-only in-memory inbox (seeded demo content)
#   - auto           : use DB if ready, else memory (dev-only)
#   - db             : force DB store
#   - devnull        : always restricted-safe (no content)
INBOX_STORE = str(os.environ.get("SD_INBOX_STORE", "memory") or "memory").strip().lower()

USE_DB = (INBOX_STORE == "db")
USE_AUTO = (INBOX_STORE == "auto")
USE_DEVNULL = (INBOX_STORE in ("devnull", "null", "none"))
USE_MEMORY = (INBOX_STORE in ("memory", "mem", "inmemory", "ram"))

# Dev-only allowance: never run memory store when DEBUG=False.
ALLOW_MEMORY = bool(IS_DEBUG)

# Optional dev helper: shadow-write memory ops into DB best-effort.
DUALWRITE_DB = _truthy(os.environ.get("SD_INBOX_DUALWRITE_DB", ""))


def _make_memory_store():
    mem = InMemoryInboxStore()
    try:
        # Seed is dev-only (DEBUG).
        mem.seed_demo()
    except Exception:
        pass

    if DUALWRITE_DB:
        try:
            from .store_dualwrite import DualWriteInboxStore  # local import (dev-only path)
            # Only attempt shadow-write when DB is reachable/migrated.
            if _db_ready():
                return DualWriteInboxStore(primary=mem, shadow_db=DbInboxStore())
        except Exception:
            pass

    return mem


# Default-safe selection.
if USE_DEVNULL:
    store = DevNullInboxStore()
elif USE_DB:
    store = DbInboxStore()
elif USE_AUTO:
    if _db_ready():
        store = DbInboxStore()
    else:
        store = _make_memory_store() if ALLOW_MEMORY else DevNullInboxStore()
else:
    # Default: memory for dev; DB for prod (DEBUG=False)
    if ALLOW_MEMORY and USE_MEMORY:
        store = _make_memory_store()
    else:
        store = DbInboxStore()



def get_viewer_id(request) -> Optional[str]:
    # Resolve viewer id (default-safe).
    #
    # Priority:
    # 1) DRF authenticated user (Session/JWT/etc) -> me_<django_user_id>
    # 2) DEV-only header/cookie identity (settings.DEBUG=True)
    #
    # PROD safety:
    # - Never trust dev headers/cookies when DEBUG=False.

    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        uid = str(getattr(user, "id", "") or "").strip()
        return f"me_{uid}" if uid else None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return resolve_viewer_role(raw)



def _clamp_int(raw: Any, *, default: int, min_v: int, max_v: int) -> int:
    try:
        v = int(raw)
    except Exception:
        return default
    return max(min_v, min(max_v, v))


@method_decorator(dev_csrf_exempt, name="dispatch")
class InboxThreadsView(APIView):
    """GET /api/inbox/threads"""

    throttle_scope = "inbox_threads"

    def get(self, request):
        side = request.query_params.get("side")
        limit = _clamp_int(request.query_params.get("limit"), default=20, min_v=1, max_v=50)
        cursor = request.query_params.get("cursor")

        if side and side not in SIDE_IDS:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)
        viewer_id = get_viewer_id(request)

        cache_status = "bypass"
        cache_ttl = _inbox_cache_ttl()
        cache_key = None

        if viewer_id and _inbox_cache_enabled() and cache_ttl > 0:
            ver = _inbox_get_ver(str(viewer_id))
            cache_key = _inbox_threads_cache_key(
                viewer_id=str(viewer_id),
                ver=ver,
                side=side if side else None,
                limit=limit,
                cursor=cursor if cursor else None,
            )
            try:
                cached = cache.get(cache_key)
            except Exception:
                cached = None
                cache_key = None
            if cached is not None:
                resp = Response(cached, status=status.HTTP_200_OK)
                resp["X-Siddes-Cache"] = "hit"
                resp["X-Siddes-Cache-Ttl"] = str(cache_ttl)
                resp["Cache-Control"] = "private, no-store"
                resp["Vary"] = "Cookie, Authorization"
                return resp
            if cache_key is not None:
                cache_status = "miss"

        data = list_threads(
            store,
            viewer_id=viewer_id,
            side=side if side else None,
            limit=limit,
            cursor=cursor if cursor else None,
        )
        data = _filter_blocked_threads_payload(viewer_id, data)

        if cache_key is not None and cache_status == "miss" and isinstance(data, dict) and not data.get("restricted"):
            try:
                cache.set(cache_key, data, timeout=cache_ttl)
            except Exception:
                cache_status = "bypass"

        resp = Response(data, status=status.HTTP_200_OK)
        resp["Cache-Control"] = "private, no-store"
        resp["Vary"] = "Cookie, Authorization"
        resp["X-Siddes-Cache"] = cache_status
        if cache_status != "bypass":
            resp["X-Siddes-Cache-Ttl"] = str(cache_ttl)
        return resp



    def post(self, request):
        """POST /api/inbox/threads

        Siddes DM bootstrap: ensure a DM-style thread exists for a target.

        Body:
          { targetHandle: string, lockedSide?: SideId, displayName?: string }

        Default-safe:
        - missing viewer -> restricted:true
        - blocked pair -> restricted:true (hide existence)
        """

        viewer = get_viewer_id(request)
        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        raw_target = str(body.get("targetHandle") or "").strip()
        tok = normalize_target_token(raw_target)
        if not tok:
            return Response({"ok": False, "error": "invalid_target"}, status=status.HTTP_400_BAD_REQUEST)

        # sd_398: Blocks must hard-stop inbox access.
        if viewer and is_blocked_pair(str(viewer), str(tok)):
            return Response({"ok": True, "restricted": True, "thread": None, "meta": None}, status=status.HTTP_200_OK)

        raw_side = str(body.get("lockedSide") or "friends").strip()
        if raw_side not in SIDE_IDS:
            return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

        locked_side: SideId = raw_side  # type: ignore[assignment]

        display_name = str(body.get("displayName") or "").strip()
        if not display_name:
            display_name = tok.lstrip("@") or "User"

        def _initials(name: str) -> str:
            parts = [p for p in str(name or "").replace("@", "").split() if p]
            out = "".join([p[0].upper() for p in parts])[:2]
            return out or "?"

        participant = ParticipantRecord(
            display_name=display_name,
            initials=_initials(display_name),
            avatar_seed=tok,
            handle=tok,
        )

        data = ensure_thread(
            store,
            viewer_id=viewer,
            other_token=tok,
            locked_side=locked_side,
            title=display_name,
            participant=participant,
        )

        # sd_582: bump per-viewer version so cached thread/list refreshes after mutations
        if viewer:
            _inbox_bump_ver(str(viewer))

        resp = Response(data, status=status.HTTP_200_OK)
        resp["Cache-Control"] = "private, no-store"
        resp["Vary"] = "Cookie, Authorization"
        return resp

@method_decorator(dev_csrf_exempt, name="dispatch")
class InboxThreadView(APIView):
    """GET/POST /api/inbox/thread/:id"""

    throttle_scope = "inbox_thread"

    def get_throttles(self):
        # Method-specific throttle scopes.
        # POST (send/move) is treated as more expensive than GET (read).
        if getattr(self, "request", None) is not None and self.request.method == "POST":
            self.throttle_scope = "inbox_send"
        else:
            self.throttle_scope = "inbox_thread"
        return super().get_throttles()

    def get(self, request, thread_id: str):
        limit = _clamp_int(request.query_params.get("limit"), default=30, min_v=1, max_v=100)
        cursor = request.query_params.get("cursor")
        viewer_id = get_viewer_id(request)

        cache_status = "bypass"
        cache_ttl = _inbox_cache_ttl()
        cache_key = None

        if viewer_id and _inbox_cache_enabled() and cache_ttl > 0:
            ver = _inbox_get_ver(str(viewer_id))
            cache_key = _inbox_thread_cache_key(
                viewer_id=str(viewer_id),
                ver=ver,
                thread_id=str(thread_id),
                limit=limit,
                cursor=cursor if cursor else None,
            )
            try:
                cached = cache.get(cache_key)
            except Exception:
                cached = None
                cache_key = None
            if cached is not None:
                resp = Response(cached, status=status.HTTP_200_OK)
                resp["X-Siddes-Cache"] = "hit"
                resp["X-Siddes-Cache-Ttl"] = str(cache_ttl)
                resp["Cache-Control"] = "private, no-store"
                resp["Vary"] = "Cookie, Authorization"
                return resp
            if cache_key is not None:
                cache_status = "miss"

        data = get_thread(
            store,
            viewer_id=viewer_id,
            thread_id=thread_id,
            limit=limit,
            cursor=cursor if cursor else None,
        )
        data = _restrict_blocked_thread_payload(viewer_id, data)

        if cache_key is not None and cache_status == "miss" and isinstance(data, dict) and not data.get("restricted"):
            try:
                cache.set(cache_key, data, timeout=cache_ttl)
            except Exception:
                cache_status = "bypass"

        resp = Response(data, status=status.HTTP_200_OK)
        resp["Cache-Control"] = "private, no-store"
        resp["Vary"] = "Cookie, Authorization"
        resp["X-Siddes-Cache"] = cache_status
        if cache_status != "bypass":
            resp["X-Siddes-Cache-Ttl"] = str(cache_ttl)
        return resp

    def post(self, request, thread_id: str):
        viewer = get_viewer_id(request)
        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        # sd_398: Blocks must hard-stop inbox access.
        other_token = _counterparty_token_for_thread_id(thread_id)
        if viewer and other_token and is_blocked_pair(str(viewer), str(other_token)):
            # Hide existence details: behave like restricted.
            if body.get("setLockedSide") is not None:
                return Response(_restricted_meta_payload(), status=status.HTTP_200_OK)
            return Response(_restricted_send_payload(), status=status.HTTP_200_OK)


        if body.get("setLockedSide") is not None:
            side = str(body.get("setLockedSide") or "").strip()
            if side not in SIDE_IDS:
                return Response({"ok": False, "error": "invalid_side"}, status=status.HTTP_400_BAD_REQUEST)

            data = set_locked_side(store, viewer_id=viewer, thread_id=thread_id, side=side)  # type: ignore[arg-type]

            # sd_582: bump per-viewer version so cached thread/list refreshes after mutations
            if viewer:
                _inbox_bump_ver(str(viewer))

            resp = Response(data, status=status.HTTP_200_OK)
            resp["Cache-Control"] = "private, no-store"
            resp["Vary"] = "Cookie, Authorization"
            return resp

        raw_text = str(body.get("text") or "")
        text = raw_text.strip()
        if not text:
            # Contract: 400 + ok:false
            return Response({"ok": False, "error": "missing_text"}, status=status.HTTP_400_BAD_REQUEST)

        # sd_360: server-side message size limits (prevents DoS/DB bloat)
        max_len = 2000
        if len(text) > max_len:
            return Response({"ok": False, "error": "too_long", "max": max_len}, status=status.HTTP_400_BAD_REQUEST)

        # sd_605: per-recipient DM throttles (anti-harassment / burst spam).
        try:
            import os
            from siddes_backend.abuse_limits import enforce_pair_limits  # type: ignore

            other = _counterparty_token_for_thread_id(thread_id)
            per_min = int(os.getenv("SIDDES_RL_INBOX_SEND_TO_PER_MIN", "6"))
            per_hr = int(os.getenv("SIDDES_RL_INBOX_SEND_TO_PER_HOUR", "30"))
            rl = enforce_pair_limits(
                scope="inbox_send_recipient",
                actor_id=str(viewer),
                target_token=str(other or ""),
                per_minute=per_min,
                per_hour=per_hr,
            )
            if not rl.ok:
                return Response(
                    {
                        "ok": False,
                        "error": "rate_limited",
                        "scope": "inbox_send_recipient",
                        "retry_after_ms": int(rl.retry_after_ms or 1000),
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
        except Exception:
            pass

        client_key = body.get("clientKey") or body.get("client_key")

        try:
            data = send_message(
                store,
                viewer_id=viewer,
                thread_id=thread_id,
                text=text,
                client_key=str(client_key) if client_key is not None else None,
            )
        except ValueError:
            return Response({"ok": False, "error": "missing_text"}, status=status.HTTP_400_BAD_REQUEST)

        # sd_582: bump per-viewer version so cached thread/list refreshes after mutations
        if viewer:
            _inbox_bump_ver(str(viewer))

        resp = Response(data, status=status.HTTP_200_OK)
        resp["Cache-Control"] = "private, no-store"
        resp["Vary"] = "Cookie, Authorization"
        return resp


def _message_dict(m: Any) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(getattr(m, "id", "")),
        "ts": int(getattr(m, "ts", 0)),
        "from": str(getattr(m, "from_id", "")),
        "text": str(getattr(m, "text", "")),
        "side": str(getattr(m, "side", "")),
        "queued": bool(getattr(m, "queued", False)),
    }
    ck = getattr(m, "client_key", None)
    if ck is not None:
        out["clientKey"] = ck
    return out


def _meta_dict(meta: Any) -> dict[str, Any]:
    return {
        "lockedSide": str(getattr(meta, "locked_side", "")),
        "updatedAt": int(getattr(meta, "updated_at", 0)),
    }


def _debug_enabled() -> bool:
    return _truthy(os.environ.get("DJANGO_DEBUG", "0"))


@method_decorator(dev_csrf_exempt, name="dispatch")
class InboxDebugResetUnreadView(APIView):
    """POST /api/inbox/debug/unread/reset (dev-only)

    Body: { threadId }

    Notes:
    - Only enabled when DJANGO_DEBUG is truthy.
    - Only allowed for viewer=me.
    """

    throttle_scope = "inbox_debug"

    def post(self, request):
        if not _debug_enabled():
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        viewer = get_viewer_id(request)
        if viewer != "me":
            return Response({"ok": False, "error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        thread_id = str(body.get("threadId") or body.get("thread_id") or "").strip()
        if not thread_id:
            return Response({"ok": False, "error": "missing_thread"}, status=status.HTTP_400_BAD_REQUEST)

        fn = getattr(store, "debug_reset_unread", None)
        if not callable(fn):
            return Response({"ok": False, "error": "not_supported"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        try:
            fn(viewer_id=viewer, thread_id=thread_id)
        except KeyError:
            return Response({"ok": False, "error": "unknown_thread"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({"ok": False, "error": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"ok": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class InboxDebugIncomingView(APIView):
    """POST /api/inbox/debug/incoming (dev-only)

    Body: { threadId, text }

    Notes:
    - Only enabled when DJANGO_DEBUG is truthy.
    - Only allowed for viewer=me.
    """

    throttle_scope = "inbox_debug"

    def post(self, request):
        if not _debug_enabled():
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        viewer = get_viewer_id(request)
        if viewer != "me":
            return Response({"ok": False, "error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        body: dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        thread_id = str(body.get("threadId") or body.get("thread_id") or "").strip()
        text = str(body.get("text") or "Incoming (simulated) message").strip()

        if not thread_id:
            return Response({"ok": False, "error": "missing_thread"}, status=status.HTTP_400_BAD_REQUEST)

        fn = getattr(store, "debug_append_incoming", None)
        if not callable(fn):
            return Response({"ok": False, "error": "not_supported"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        try:
            msg, meta = fn(viewer_id=viewer, thread_id=thread_id, text=text)
        except KeyError:
            return Response({"ok": False, "error": "unknown_thread"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({"ok": False, "error": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"ok": True, "message": _message_dict(msg), "meta": _meta_dict(meta)}, status=status.HTTP_200_OK)
