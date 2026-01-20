"""Tokenized media URLs for /m/* (Cloudflare Worker).

Goal:
- Public media: stable token (cacheable at edge)
- Private media: short-lived token (NOT cacheable)

Worker validates:
- HMAC signature
- key match
- expiry (if present)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, Optional
from urllib.parse import quote


DEFAULT_PRIVATE_TTL_SECONDS = 600  # 10 minutes (tunable via env)


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")


def _secret() -> str:
    return str(os.environ.get("SIDDES_MEDIA_TOKEN_SECRET", "") or "").strip()


def mint_media_token(key: str, *, is_public: bool) -> str:
    k = str(key or "").lstrip("/")
    if not k:
        return ""

    payload: Dict[str, Any] = {"k": k, "m": "pub" if is_public else "priv"}

    # Private tokens expire quickly to reduce leak risk.
    if not is_public:
        raw_ttl = str(os.environ.get("SIDDES_MEDIA_PRIVATE_TTL", "") or "").strip()
        ttl = int(raw_ttl) if raw_ttl.isdigit() else DEFAULT_PRIVATE_TTL_SECONDS
        ttl = max(60, min(ttl, 3600))  # clamp 60s..1h
        payload["e"] = int(time.time()) + ttl

    sec = _secret()
    if not sec:
        return ""

    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(sec.encode("utf-8"), raw, hashlib.sha256).digest()

    return _b64url(raw) + "." + _b64url(sig)


def build_media_url(key: str, *, is_public: bool, base_url: Optional[str] = None) -> str:
    """Return a URL that the Worker serves: /m/<key>?t=<token>.

    If SIDDES_MEDIA_TOKEN_SECRET is missing, falls back to /m/<key> (no token).
    """
    k = str(key or "").lstrip("/")
    if not k:
        return ""

    base = str(base_url or os.environ.get("SIDDES_MEDIA_BASE", "") or "").strip().rstrip("/")
    path = "/m/" + quote(k, safe="/~")

    token = mint_media_token(k, is_public=is_public)
    full = (base + path) if base else path

    if not token:
        return full
    return full + "?t=" + token
