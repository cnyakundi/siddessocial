"""DB models for Rituals (sd_337).

Design goals:
- Rituals are NOT posts; they are structured micro-moments (mood/reading/question/townhall/etc.).
- Privacy is enforced in views (membership + side truth + block checks).
- IDs remain strings (compatible with existing URL style).
- created_at/expires_at are float seconds (matches existing timing conventions).

Cycle 2 adds:
- RitualIgnite: who ignited (one per viewer)
- RitualResponse: structured response payload (one per viewer)
"""

from __future__ import annotations

from django.db import models


SIDE_CHOICES = (
    ("public", "public"),
    ("friends", "friends"),
    ("close", "close"),
    ("work", "work"),
)


class Ritual(models.Model):
    """A Ritual (Room Pulse) prompt scoped to a Side and optionally a Set.

    Launch-safe rule:
    - Non-public rituals should be set-scoped (set_id required).
    """

    id = models.CharField(primary_key=True, max_length=64)

    side = models.CharField(max_length=16, choices=SIDE_CHOICES, db_index=True)
    set_id = models.CharField(max_length=96, null=True, blank=True, db_index=True)

    kind = models.CharField(max_length=32, db_index=True)
    title = models.CharField(max_length=128, default="")
    prompt = models.TextField(default="")

    # proposed | warming | active | archived
    status = models.CharField(max_length=16, db_index=True, default="proposed")

    created_by = models.CharField(max_length=64, db_index=True)
    created_at = models.FloatField(db_index=True)
    expires_at = models.FloatField(null=True, blank=True, db_index=True)

    # Spark mechanics (set-scoped ignition)
    ignite_threshold = models.IntegerField(default=0)
    ignites = models.IntegerField(default=0)

    # UI hint / summary surface (kind-specific)
    # Example: {"vibe": "😌 calm / 😩 tired", "avatars": ["Sarah", "Mike"], "topAnswers": ["Approvals"]}
    data = models.JSONField(default=dict, blank=True)

    # Dock hint: number of responses
    replies = models.IntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["side", "status", "-created_at"], name="siddes_ritu_side_s_5c2a1f_idx"),
            models.Index(fields=["set_id", "status", "-created_at"], name="siddes_ritu_set_i_2f262f_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"Ritual({self.id}, side={self.side}, kind={self.kind}, status={self.status})"


class RitualIgnite(models.Model):
    """A viewer has ignited / supported a ritual.

    One ignite per (ritual, viewer).
    """

    id = models.CharField(primary_key=True, max_length=64)
    ritual = models.ForeignKey(Ritual, on_delete=models.CASCADE, related_name="ignite_records")
    by = models.CharField(max_length=64, db_index=True)
    created_at = models.FloatField(db_index=True)

    class Meta:
        unique_together = (("ritual", "by"),)
        indexes = [
            models.Index(fields=["ritual", "-created_at"], name="siddes_ritu_ig_rit_4a9c_idx"),
        ]


class RitualResponse(models.Model):
    """A structured response to a ritual.

    Launch-safe v1:
    - One response per (ritual, viewer). Re-post updates the existing row.
    """

    id = models.CharField(primary_key=True, max_length=64)
    ritual = models.ForeignKey(Ritual, on_delete=models.CASCADE, related_name="responses")
    by = models.CharField(max_length=64, db_index=True)
    created_at = models.FloatField(db_index=True)

    kind = models.CharField(max_length=32, db_index=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    text = models.TextField(default="", blank=True)

    class Meta:
        unique_together = (("ritual", "by"),)
        indexes = [
            models.Index(fields=["ritual", "-created_at"], name="siddes_ritu_rs_rit_0f2b_idx"),
        ]
