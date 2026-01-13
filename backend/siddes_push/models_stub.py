"""Backend-ready push subscription record (framework-agnostic).

In Django, this becomes a model like:

class PushSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    endpoint = models.TextField(db_index=True)
    p256dh = models.TextField()
    auth = models.TextField()
    raw = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

We store by endpoint to allow unsubscribe and dedupe.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class PushSubscriptionRecord:
    user_id: str
    endpoint: str
    p256dh: str
    auth: str
    raw: Dict[str, Any]
    created_at: float
    last_seen_at: Optional[float] = None
