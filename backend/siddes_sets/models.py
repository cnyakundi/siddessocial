"""Sets (Subsides) DB models.

Sets are curated sets inside a Side.

This app becomes the persistent backing store for Sets and the DRF endpoints
under `/api/circles/*`.

Contract note:
- We intentionally mirror the Next.js stub response shapes so the frontend can
  switch to Django via `NEXT_PUBLIC_API_BASE` without rewriting UI.
"""

from __future__ import annotations

from django.db import models


class SideId(models.TextChoices):
    PUBLIC = "public", "Public"
    FRIENDS = "friends", "Friends"
    CLOSE = "close", "Close"
    WORK = "work", "Work"


class SetColor(models.TextChoices):
    ORANGE = "orange", "Orange"
    PURPLE = "purple", "Purple"
    BLUE = "blue", "Blue"
    EMERALD = "emerald", "Emerald"
    ROSE = "rose", "Rose"
    SLATE = "slate", "Slate"


class SetEventKind(models.TextChoices):
    CREATED = "created", "Created"
    RENAMED = "renamed", "Renamed"
    MEMBERS_UPDATED = "members_updated", "Members Updated"
    MOVED_SIDE = "moved_side", "Moved Side"
    RECOLORED = "recolored", "Recolored"


class SiddesSet(models.Model):
    """A Set (Subside): a user-curated set inside a Side."""

    id = models.CharField(primary_key=True, max_length=96)

    # In the stub universe, this is the deterministic viewer id (e.g., "me").
    owner_id = models.CharField(max_length=64)

    side = models.CharField(max_length=16, choices=SideId.choices, default=SideId.FRIENDS)
    label = models.CharField(max_length=255, default="")
    color = models.CharField(max_length=16, choices=SetColor.choices, default=SetColor.EMERALD)

    members = models.JSONField(default=list)

    # Optional count hint used by UI (posts count later); keep for contract parity.
    count = models.IntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_id", "side", "updated_at"], name="sets_owner_side_upd"),
            models.Index(fields=["owner_id", "updated_at"], name="sets_owner_upd"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"SiddesSet({self.id})"


class SiddesSetMember(models.Model):
    """Normalized Set membership row.

    Why this exists (sd_366):
    - JSONField membership (`SiddesSet.members`) is fine for API payload parity, but it is
      not join-friendly for large-scale membership/visibility checks.
    - This table enables indexed queries like:
        SetMember(member_id=X) -> set_ids
        SetMember(set_id=Y, member_id=X) -> exists

    Contract note:
    - We keep `SiddesSet.members` (JSON) for response parity and keep this table in sync on writes.
    """

    id = models.BigAutoField(primary_key=True)

    set = models.ForeignKey(SiddesSet, on_delete=models.CASCADE, related_name="member_links")
    member_id = models.CharField(max_length=64)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["set", "member_id"], name="set_member_unique"),
        ]
        indexes = [
            models.Index(fields=["member_id"], name="setmem_member"),
            models.Index(fields=["set", "member_id"], name="setmem_set_member"),
        ]


class SiddesSetEvent(models.Model):
    """A Set history/audit entry (server-truth)."""

    id = models.CharField(primary_key=True, max_length=96)

    set = models.ForeignKey(SiddesSet, on_delete=models.CASCADE, related_name="events")

    # Millisecond timestamp to match frontend contract.
    ts_ms = models.BigIntegerField()

    kind = models.CharField(max_length=32, choices=SetEventKind.choices)

    by = models.CharField(max_length=64, default="me")
    data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["set", "ts_ms"], name="set_event_set_ts"),
            models.Index(fields=["ts_ms"], name="set_event_ts"),
        ]
        ordering = ["-ts_ms"]

    def __str__(self) -> str:  # pragma: no cover
        return f"SiddesSetEvent({self.id}, {self.kind})"
