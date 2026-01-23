from __future__ import annotations

from django.db import models


class Notification(models.Model):
    """Viewer-scoped notifications (v0).

    Stored as DB-backed demo content so frontend doesn't need MOCK_NOTIFICATIONS.
    """

    id = models.CharField(primary_key=True, max_length=64)

    viewer_id = models.CharField(max_length=64, db_index=True)

    side = models.CharField(max_length=16, default="public", db_index=True)

    # reply | like | mention
    type = models.CharField(max_length=16, db_index=True)

    actor = models.CharField(max_length=255, default="")
    glimpse = models.TextField(default="")

    post_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    post_title = models.CharField(max_length=255, null=True, blank=True)

    created_at = models.FloatField(db_index=True)  # seconds
    read_at = models.FloatField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["viewer_id", "-created_at"], name="siddes_noti_viewer__86b710_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"Notification({self.id}, viewer={self.viewer_id}, type={self.type})"
