"""DB-backed Public Slate (sd_181i).

The Slate is a public guestbook-like section on profiles.
For now it's read-only in UI and seeded deterministically for demo.
"""

from __future__ import annotations

from django.db import models


KIND_CHOICES = (
    ("vouch", "vouch"),
    ("question", "question"),
)


class SlateEntry(models.Model):
    id = models.CharField(primary_key=True, max_length=64)

    # The profile handle this entry is about (e.g. "@elena")
    target_handle = models.CharField(max_length=64, db_index=True)

    # Author metadata (string-based for MVP compatibility)
    from_user_id = models.CharField(max_length=64, default="")
    from_name = models.CharField(max_length=255, default="")
    from_handle = models.CharField(max_length=64, default="")

    kind = models.CharField(max_length=16, choices=KIND_CHOICES, db_index=True)
    text = models.TextField(default="")

    # TrustLevel: 0..3 (matches frontend TrustLevel type)
    trust_level = models.IntegerField(default=1, db_index=True)

    created_at = models.FloatField(db_index=True)  # seconds

    class Meta:
        indexes = [
            models.Index(fields=["target_handle", "-trust_level", "-created_at"], name="siddes_slat_target__a607cd_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"SlateEntry({self.id}, target={self.target_handle}, kind={self.kind})"
