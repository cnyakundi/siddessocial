"""Broadcasts database models.

Broadcasts are PUBLIC-only one-to-many channels.

Design rules:
- Broadcast metadata is public.
- Subscriber list is private by default (we expose subscriber_count only).
- Membership is relational (NOT JSON) to scale beyond small groups.
"""

from __future__ import annotations

from django.db import models


class BroadcastRole(models.TextChoices):
    OWNER = "owner", "Owner"
    WRITER = "writer", "Writer"
    SUBSCRIBER = "subscriber", "Subscriber"


class NotifyMode(models.TextChoices):
    OFF = "off", "Off"
    HIGHLIGHTS = "highlights", "Highlights"
    ALL = "all", "All"


class Broadcast(models.Model):
    id = models.CharField(primary_key=True, max_length=96)

    # Viewer identity string (matches the rest of Siddes): me_<django_user_id>
    owner_id = models.CharField(max_length=64, db_index=True)

    name = models.CharField(max_length=255)
    handle = models.CharField(max_length=64, unique=True, db_index=True)
    category = models.CharField(max_length=64, default="")
    desc = models.TextField(default="")

    pinned_rules = models.TextField(default="")

    subscriber_count = models.IntegerField(default=0)

    # Mirrors Post.created_at (float seconds). Used for unread dots + ordering.
    last_post_at = models.FloatField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["subscriber_count", "last_post_at"], name="bc_subs_last"),
            models.Index(fields=["last_post_at"], name="bc_last_post"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"Broadcast({self.id}, {self.handle})"


class BroadcastMember(models.Model):
    broadcast = models.ForeignKey(Broadcast, on_delete=models.CASCADE, related_name="members")

    viewer_id = models.CharField(max_length=64, db_index=True)

    role = models.CharField(max_length=16, choices=BroadcastRole.choices, default=BroadcastRole.SUBSCRIBER)

    notify_mode = models.CharField(max_length=16, choices=NotifyMode.choices, default=NotifyMode.OFF)
    muted = models.BooleanField(default=False)

    # Float seconds (same universe as Post.created_at)
    last_seen_at = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["broadcast", "viewer_id"], name="bc_member_broadcast_viewer_uniq"),
        ]
        indexes = [
            models.Index(fields=["viewer_id", "role"], name="bc_member_viewer_role"),
            models.Index(fields=["broadcast", "role"], name="bc_member_broadcast_role"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"BroadcastMember({self.broadcast_id}, {self.viewer_id}, {self.role})"
