"""Token matching helpers.

We match by HMAC token only. We do not store raw contact payloads.

In production:
- known tokens are stored for verified identities (phone/email)
- incoming tokens are computed on receipt and matched

This module is framework-agnostic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Mapping, Sequence


@dataclass(frozen=True)
class MatchResult:
    token: str
    user_id: str
    handle: str
    display_name: str


def match_tokens(incoming_tokens: Sequence[str], known: Mapping[str, dict]) -> List[MatchResult]:
    """known: token -> {user_id, handle, display_name}"""
    out: List[MatchResult] = []
    for t in incoming_tokens:
        u = known.get(t)
        if not u:
            continue
        out.append(
            MatchResult(
                token=t,
                user_id=str(u.get("user_id")),
                handle=str(u.get("handle")),
                display_name=str(u.get("display_name")),
            )
        )
    return out
