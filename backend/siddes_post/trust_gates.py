"""Public Trust Gates (backend-side, dev/demo)."""

from __future__ import annotations

import os
import re
import time
from typing import Dict, Optional


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def enabled() -> bool:
    return _truthy(os.environ.get("SD_PUBLIC_TRUST_GATES")) or _truthy(os.environ.get("NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES"))


def text_has_link(text: str) -> bool:
    t = (text or "").lower()
    return bool(re.search(r"https?://", t) or re.search(r"\bwww\.", t))


def normalize_trust_level(raw: str | None, fallback: int) -> int:
    try:
        v = int(str(raw or "").strip())
    except Exception:
        v = int(fallback)
    return max(0, min(3, v))


def min_interval_ms_for_trust(lvl: int) -> int:
    if lvl <= 0:
        return 60_000
    if lvl == 1:
        return 60_000
    if lvl == 2:
        return 15_000
    return 0


_last_action: Dict[str, int] = {}


def _check_min_interval(key: str, min_interval_ms: int, now_ms: Optional[int] = None) -> Dict[str, object]:
    if min_interval_ms <= 0:
        return {"ok": True}
    now = int(now_ms if now_ms is not None else time.time() * 1000)
    last = int(_last_action.get(key) or 0)
    delta = now - last
    if delta >= min_interval_ms:
        _last_action[key] = now
        return {"ok": True}
    return {"ok": False, "status": 429, "error": "rate_limited", "retry_after_ms": max(250, min_interval_ms - delta)}


def enforce_public_write_gates(*, viewer_id: Optional[str], trust_level: int, text: str, kind: str) -> Dict[str, object]:
    if not viewer_id:
        return {"ok": False, "status": 401, "error": "restricted"}

    if trust_level < 1:
        return {"ok": False, "status": 403, "error": "trust_required", "min_trust": 1}

    if text_has_link(text) and trust_level < 2:
        return {"ok": False, "status": 403, "error": "link_requires_trust", "min_trust": 2}

    rl_key = f"public_{kind}:{viewer_id}"
    min_interval = min_interval_ms_for_trust(trust_level)
    return _check_min_interval(rl_key, min_interval)
