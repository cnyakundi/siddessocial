from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional

from django.core.management.base import BaseCommand

from siddes_backend.edge_queue import is_enabled, queue_key


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def _redis():
    import redis  # type: ignore

    url = str(os.environ.get("REDIS_URL") or "").strip()
    if not url:
        return None
    return redis.from_url(url, decode_responses=True)


def _log(msg: str) -> None:
    print(msg, flush=True)


def _safe_int(x: Any) -> Optional[int]:
    try:
        if x is None:
            return None
        if isinstance(x, bool):
            return None
        return int(str(x).strip())
    except Exception:
        return None


def handle_ml_refresh_suggestions(payload: Dict[str, Any]) -> None:
    """Rebuild ML suggestions for a viewer from viewer-scoped contact edges."""

    from django.contrib.auth import get_user_model
    from siddes_contacts.models import ContactMatchEdge
    from siddes_ml.seed import seed_from_contact_matches

    vid = _safe_int(payload.get("viewer_id"))
    if not vid:
        return

    User = get_user_model()
    viewer = User.objects.filter(id=vid, is_active=True).first()
    if viewer is None:
        return

    edges = (
        ContactMatchEdge.objects.filter(
            viewer=viewer,
            matched_user__is_active=True,
            matched_user__siddes_profile__email_verified=True,
            matched_user__siddes_profile__deleted_at__isnull=True,
            matched_user__siddes_profile__account_state="active",
        )
        .select_related("matched_user")
        .order_by("-last_seen_at")[:120]
    )

    rows = []
    for e in edges:
        u = getattr(e, "matched_user", None)
        uname = str(getattr(u, "username", "") or "").strip() if u else ""
        if not uname:
            continue
        rows.append({"handle": "@" + uname.lstrip("@").strip().lower(), "domain": str(getattr(e, "domain", "") or "")})

    created = seed_from_contact_matches(viewer_id=f"me_{viewer.id}", match_rows=rows, model_version="edge_engine_v0")
    _log(f"edge_engine: ml_refresh_suggestions viewer=me_{viewer.id} created={created}")


HANDLERS = {
    "ml_refresh_suggestions": handle_ml_refresh_suggestions,
}


class Command(BaseCommand):
    help = "Run Siddes Edge Engine v0 (Redis queue worker)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process at most one job and exit")
        parser.add_argument("--idle-sleep", default="0.2", help="Sleep seconds between empty polls (default 0.2)")
        parser.add_argument("--brpop-timeout", default="5", help="BRPOP timeout seconds (default 5)")

    def handle(self, *args: Any, **opts: Any) -> None:
        if not is_enabled():
            _log("edge_engine: disabled (set SIDDES_EDGE_ENGINE_ENABLED=1 and REDIS_URL)")
            return

        r = _redis()
        if r is None:
            _log("edge_engine: REDIS_URL missing; nothing to do")
            return

        once = bool(opts.get("once"))
        idle_sleep = float(str(opts.get("idle_sleep") or "0.2").strip())
        brpop_timeout = int(str(opts.get("brpop_timeout") or "5").strip())

        qk = queue_key()
        _log(f"edge_engine: up queue={qk}")

        while True:
            try:
                item = r.brpop(qk, timeout=brpop_timeout)
            except Exception as e:
                _log(f"edge_engine: redis brpop error: {e}")
                time.sleep(1.0)
                continue

            if not item:
                if once:
                    return
                time.sleep(idle_sleep)
                continue

            # item: (key, value)
            _, raw = item
            try:
                job = json.loads(raw)
            except Exception:
                job = None

            if not isinstance(job, dict):
                continue

            jt = str(job.get("type") or "").strip()
            payload = job.get("payload")
            if not isinstance(payload, dict):
                payload = {}

            handler = HANDLERS.get(jt)
            if handler is None:
                _log(f"edge_engine: unknown job type={jt}")
                if once:
                    return
                continue

            try:
                handler(payload)
            except Exception as e:
                _log(f"edge_engine: job failed type={jt} err={e}")

            if once:
                return
