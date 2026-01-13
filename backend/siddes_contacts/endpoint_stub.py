"""Contacts match endpoint stub (framework-agnostic).

This stub is meant to be called from a web framework handler.

Inputs:
- `identifiers`: list of strings (phones/emails)
- `pepper`: HMAC pepper (env or injected)
- `known_tokens`: mapping token -> user payload dict

Behavior:
- normalize identifiers
- token = HMAC_SHA256(pepper, normalized_identifier)
- match tokens against known
- return matches only
- do NOT store raw identifiers
"""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional

from .normalize import normalize_email, normalize_phone
from .tokens import hmac_token
from .match import match_tokens


def infer_type(s: str) -> str:
    if "@" in s:
        return "email"
    return "phone"


def contacts_match(
    identifiers: List[str],
    known_tokens: Mapping[str, dict],
    *,
    pepper: Optional[str] = None,
    default_region: str = "KE",
) -> Dict[str, Any]:
    tokens: List[str] = []
    for raw in identifiers:
        if not raw:
            continue
        t = infer_type(raw)
        if t == "email":
            n = normalize_email(raw)
            if n:
                tokens.append(hmac_token(n, pepper))
        else:
            n = normalize_phone(raw, default_region=default_region)
            if n:
                tokens.append(hmac_token(n, pepper))

    matches = match_tokens(tokens, known_tokens)
    return {"matches": [m.__dict__ for m in matches]}
