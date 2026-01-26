from __future__ import annotations

from django.db import models

# sd_741_push_backend_db
class PushSubscription(models.Model):
    """Viewer-scoped push subscriptions.

    Stored per (viewer_id, endpoint). Endpoint identifies the device/browser subscription.
    """

    viewer_id = models.CharField(max_length=64, db_index=True)
    endpoint = models.TextField(db_index=True)
    p256dh = models.TextField()
    auth = models.TextField()
    raw = models.JSONField(default=dict)

    user_agent = models.CharField(max_length=255, default="")
    created_at = models.FloatField(db_index=True)  # seconds
    last_seen_at = models.FloatField(null=True, blank=True)  # seconds

    class Meta:
        unique_together = [("viewer_id", "endpoint")]
        indexes = [
            models.Index(fields=["viewer_id", "-created_at"], name="push_viewer_ca"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"PushSubscription(viewer={self.viewer_id}, endpoint={self.endpoint[:40]}...)"

# sd_743_push_prefs
class PushPreferences(models.Model):
    """Viewer-scoped push preferences (JSON)."""

    viewer_id = models.CharField(max_length=64, unique=True)
    prefs = models.JSONField(default=dict)
    updated_at = models.FloatField(db_index=True)

