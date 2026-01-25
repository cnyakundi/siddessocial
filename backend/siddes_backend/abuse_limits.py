"""Lightweight abuse limits (target-based throttles).

DRF throttles are great for per-actor budgets, but harassment and spam often need
per-*target* limits too (e.g. "stop DMing the same person 50 times").

This module is intentionally minimal and cache-backed.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

from django.core.cache import cache


@dataclass
class RateLimitResult:
    ok: bool
    retry_after_ms: Optional[int] = None
    count: Optional[int] = None


def _safe_token(s: str, *, max_len: int = 64) -> str:
    t = str(s or "").strip()
    if len(t) > max_len:
        t = t[:max_len]
    return t


def _bucket(now_s: float, window_s: int) -> int:
    return int(now_s // float(window_s))


def _retry_after_ms(now_s: float, window_s: int) -> int:
    remain_s = float(window_s) - (now_s % float(window_s))
    return int(max(250, round(remain_s * 1000)))


def _incr(key: str, *, ttl: int) -> int:
    try:
        cache.add(key, 0, timeout=ttl)
        return int(cache.incr(key))
    except Exception:
        cur = int(cache.get(key) or 0)
        nxt = cur + 1
        try:
            cache.set(key, nxt, timeout=ttl)
        except Exception:
            pass
        return nxt


def enforce_bucket_limit(*, scope: str, parts: list[str], limit: int, window_s: int) -> RateLimitResult:
    if limit <= 0 or window_s <= 0:
        return RateLimitResult(ok=True)

    now_s = time.time()
    b = _bucket(now_s, window_s)
    retry_ms = _retry_after_ms(now_s, window_s)

    safe_parts = [_safe_token(p) for p in parts]
    key = "sdrl:%s:%d:%s" % (_safe_token(scope, max_len=48), b, "|".join(safe_parts))
    ttl = int(window_s + 10)
    n = _incr(key, ttl=ttl)

    if n > limit:
        return RateLimitResult(ok=False, retry_after_ms=retry_ms, count=n)

    return RateLimitResult(ok=True, retry_after_ms=None, count=n)


def enforce_pair_limits(
    *,
    scope: str,
    actor_id: str,
    target_token: str,
    per_minute: Optional[int] = None,
    per_hour: Optional[int] = None,
    per_day: Optional[int] = None,
) -> RateLimitResult:
    a = _safe_token(actor_id)
    t = _safe_token(target_token)
    if not a or not t:
        return RateLimitResult(ok=True)

    if per_minute is not None:
        r = enforce_bucket_limit(scope=f"{scope}:m", parts=[a, t], limit=int(per_minute), window_s=60)
        if not r.ok:
            return r

    if per_hour is not None:
        r = enforce_bucket_limit(scope=f"{scope}:h", parts=[a, t], limit=int(per_hour), window_s=3600)
        if not r.ok:
            return r

    if per_day is not None:
        r = enforce_bucket_limit(scope=f"{scope}:d", parts=[a, t], limit=int(per_day), window_s=86400)
        if not r.ok:
            return r

    return RateLimitResult(ok=True)
