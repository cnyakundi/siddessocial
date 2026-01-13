"""In-memory store (dev/demo) for push subscriptions.

Replace with DB persistence in Django.

Keyed by (user_id, endpoint).
"""

from __future__ import annotations

import time
from typing import Dict, List, Optional, Tuple

from .models_stub import PushSubscriptionRecord


class PushStore:
    def __init__(self) -> None:
        self._by_key: Dict[Tuple[str, str], PushSubscriptionRecord] = {}

    def upsert(self, user_id: str, endpoint: str, p256dh: str, auth: str, raw: dict) -> PushSubscriptionRecord:
        key = (user_id, endpoint)
        rec = PushSubscriptionRecord(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            raw=raw,
            created_at=time.time(),
        )
        self._by_key[key] = rec
        return rec

    def remove(self, user_id: str, endpoint: str) -> bool:
        key = (user_id, endpoint)
        return self._by_key.pop(key, None) is not None

    def list_for_user(self, user_id: str) -> List[PushSubscriptionRecord]:
        return [r for (uid, _), r in self._by_key.items() if uid == user_id]

    def count(self) -> int:
        return len(self._by_key)
