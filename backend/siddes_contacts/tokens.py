"""HMAC tokenization for contact matching.

Token algorithm (v0, locked):
- token = HMAC_SHA256(pepper, normalized_identifier)
- output = lowercase hex digest

Pepper configuration:
- env var `SIDDES_CONTACTS_PEPPER` (preferred)
- or explicit parameter (tests/dev)

Security notes:
- Do NOT use plain SHA hashes (phones/emails are dictionary-attackable).
- Pepper rotation requires re-tokenization of stored identities.
"""

from __future__ import annotations

import hashlib
import hmac
import os
from typing import Optional

ENV_PEPPER = "SIDDES_CONTACTS_PEPPER"


def get_pepper(explicit: Optional[str] = None) -> str:
    if explicit:
        return explicit
    v = os.environ.get(ENV_PEPPER)
    if v:
        return v
    # Dev fallback (NOT for production)
    return "dev_pepper_change_me"


def hmac_token(normalized_identifier: str, pepper: Optional[str] = None) -> str:
    key = get_pepper(pepper).encode("utf-8")
    msg = (normalized_identifier or "").encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()
