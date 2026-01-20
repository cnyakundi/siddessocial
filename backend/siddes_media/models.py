"""Media models (Cloudflare R2 key registry).

This is intentionally minimal:
- We store object metadata + ownership in Postgres.
- The bytes live in Cloudflare R2.

Security direction:
- Private media should not be edge-cached unless protected by signed tokens.
- Public media can be cached hard when keys are content-hashed.
"""

from __future__ import annotations

from django.db import models


KIND_CHOICES = (
    ("image", "image"),
    ("video", "video"),
)

STATUS_CHOICES = (
    ("pending", "pending"),
    ("committed", "committed"),
)


class MediaObject(models.Model):
    """Registry row for an object stored in R2.

    `r2_key` is the authoritative location in R2.
    `owner_id` is a Siddes viewer id string (e.g. me_1).
    """

    id = models.CharField(primary_key=True, max_length=64)

    owner_id = models.CharField(max_length=64, db_index=True)
    r2_key = models.CharField(max_length=512, unique=True)

    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    content_type = models.CharField(max_length=128)

    bytes = models.BigIntegerField(null=True, blank=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    duration_ms = models.IntegerField(null=True, blank=True)

    is_public = models.BooleanField(default=False, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending", db_index=True)

    created_at = models.FloatField(db_index=True)

    # Future wiring: attach to a Post (or Reply) when committed.
    post_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_id", "-created_at"], name="media_owner_time"),
            models.Index(fields=["is_public", "-created_at"], name="media_public_time"),
        ]

    def __str__(self) -> str:
        return f"MediaObject({self.id}, kind={self.kind}, key={self.r2_key})"
