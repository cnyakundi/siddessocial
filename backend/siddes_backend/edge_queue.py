"""Siddes Edge Engine v0 (Redis queue).

Goals:
- Provide a tiny, reliable background runner WITHOUT Celery.
- Enqueue jobs from request paths without blocking UX.

Queue design:
- Redis LIST (BRPOP)
- JSON payload per job

Security/Privacy:
- Never store raw address books here.
- Keep payloads derived + minimal.

Env:
- REDIS_URL (required to actually queue)
- SIDDES_EDGE_QUEUE_KEY (optional override)
- SIDDES_EDGE_ENGINE_ENABLED (optional gate; default: enabled if REDIS_URL exists)
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, Dict, Optional


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in {"1", "true", "yes", "y", "on"}


DEFAULT_QUEUE_KEY = "siddes:edge:jobs:v1"


def queue_key() -> str:
    return (os.environ.get("SIDDES_EDGE_QUEUE_KEY") or "").strip() or DEFAULT_QUEUE_KEY


def is_enabled() -> bool:
    # Enabled when explicitly enabled OR when Redis exists (dev-friendly default).
    if _truthy(os.environ.get("SIDDES_EDGE_ENGINE_ENABLED")):
        return True
    return bool(str(os.environ.get("REDIS_URL") or "").strip())


def _redis():
    import redis  # type: ignore

    url = str(os.environ.get("REDIS_URL") or "").strip()
    if not url:
        return None
    return redis.from_url(url, decode_responses=True)


def enqueue(job_type: str, payload: Optional[Dict[str, Any]] = None) -> bool:
    """Enqueue a job. Returns True if queued, else False.

    Safe to call from request paths; failures are swallowed (fail-open).
    """

    if not is_enabled():
        return False

    jt = str(job_type or "").strip()
    if not jt:
        return False

    r = None
    try:
        r = _redis()
    except Exception:
        r = None

    if r is None:
        return False

    body = {
        "id": f"job_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}",
        "type": jt,
        "payload": payload or {},
        "enqueued_at": int(time.time()),
    }

    try:
        r.lpush(queue_key(), json.dumps(body, separators=(",", ":")))
        return True
    except Exception:
        return False
