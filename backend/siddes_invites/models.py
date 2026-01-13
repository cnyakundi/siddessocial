"""Invites DB models.

A Set invite is a small record that allows:
- a Set owner (viewer) to invite another handle
- the recipient to accept or reject

This is intentionally minimal and uses string ids (viewer handles) until real auth exists.
"""

from __future__ import annotations

from django.db import models


VALID_SIDES = ("public", "friends", "close", "work")
VALID_STATUSES = ("pending", "accepted", "rejected", "revoked")


class SiddesInvite(models.Model):
    """A single invite to join a Set."""

    id = models.CharField(primary_key=True, max_length=96)

    # In the stub universe, these are deterministic viewer strings (e.g. "me", "@jordan").
    from_id = models.CharField(max_length=64)
    to_id = models.CharField(max_length=64)

    # The target Set is owned by `from_id` (owner). We keep a string set_id to avoid hard FK coupling.
    set_id = models.CharField(max_length=96)
    # Snapshot of the Set label at invite creation time so recipients can see it even without Set access.
    set_label = models.CharField(max_length=255, blank=True, default="")
    side = models.CharField(max_length=16, default="friends")

    status = models.CharField(max_length=16, default="pending")
    message = models.CharField(max_length=280, blank=True, default="")

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["to_id", "status", "updated_at"], name="inv_to_status_upd"),
            models.Index(fields=["from_id", "status", "updated_at"], name="inv_from_status_upd"),
            models.Index(fields=["set_id", "status", "updated_at"], name="inv_set_status_upd"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"SiddesInvite({self.id})"
