"""Inbox database models (scaffold).

These models are the *future* persistent backing store for Inbox.

Important:
- The API contract remains defined by `docs/INBOX_BACKEND_CONTRACT.md`.
- Current DRF views still use a dev in-memory store.
- A later overlay will add a DB-backed store that reads/writes these models.

Design notes (v0.7 scaffold):
- External IDs are strings (not auto-increment ints) to match the contract.
- We keep a lightweight participant snapshot on the thread for fast list rendering.
"""

from __future__ import annotations

from django.db import models


class SideId(models.TextChoices):
    PUBLIC = "public", "Public"
    FRIENDS = "friends", "Friends"
    CLOSE = "close", "Close"
    WORK = "work", "Work"


class ViewerRoleId(models.TextChoices):
    """Deterministic viewer roles used by the inbox visibility stub.

    This mirrors `backend/siddes_inbox/visibility_stub.py`.
    """

    ANON = "anon", "Anon"
    FRIENDS = "friends", "Friends"
    CLOSE = "close", "Close"
    WORK = "work", "Work"
    ME = "me", "Me"


class InboxThread(models.Model):
    """A conversation thread.

    Notes:
    - `id` is the external thread id used by the API.
    - Participant fields are a *snapshot* for fast thread listing.
    """

    id = models.CharField(primary_key=True, max_length=64)

    locked_side = models.CharField(max_length=16, choices=SideId.choices)

    title = models.CharField(max_length=255, default="")

    # sd_242a: real-user scoping. For now Inbox threads are per-owner for safety
    # until InboxThreadParticipant is introduced.
    owner_viewer_id = models.CharField(max_length=64, default="")

    # Participant snapshot (single-counterparty DM style for now)
    participant_display_name = models.CharField(max_length=255, default="")
    participant_initials = models.CharField(max_length=8, default="")
    participant_avatar_seed = models.CharField(max_length=64, null=True, blank=True)
    participant_user_id = models.CharField(max_length=64, null=True, blank=True)
    participant_handle = models.CharField(max_length=64, null=True, blank=True)

    # Last message cache (for thread list)
    last_text = models.TextField(default="")
    last_from_id = models.CharField(max_length=64, default="")

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_viewer_id", "updated_at"], name="inbox_thread_owner_upd"),
            models.Index(fields=["locked_side", "updated_at"], name="inbox_thread_side_upd"),
            models.Index(fields=["updated_at"], name="inbox_thread_updated"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"InboxThread({self.id})"


class InboxMessage(models.Model):
    """A message inside a thread."""

    id = models.CharField(primary_key=True, max_length=64)

    thread = models.ForeignKey(InboxThread, on_delete=models.CASCADE, related_name="messages")

    ts = models.DateTimeField()

    from_id = models.CharField(max_length=64)
    text = models.TextField()
    side = models.CharField(max_length=16, choices=SideId.choices)

    queued = models.BooleanField(default=False)
    client_key = models.CharField(max_length=128, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["thread", "ts"], name="inbox_msg_thread_ts"),
            models.Index(fields=["ts"], name="inbox_msg_ts"),
        ]
        ordering = ["ts"]

    def __str__(self) -> str:  # pragma: no cover
        return f"InboxMessage({self.id})"


class InboxThreadReadState(models.Model):
    """Per-viewer read/unread state for a thread (stub scaffold).

    Why:
    - Unread is inherently per-viewer.
    - Our v0.7 DB scaffold originally stored unread on `InboxThread.unread_count`
      (per-thread), which is not correct. That legacy field is removed in sd_121f.

    This model enables per-viewer unread counters while keeping the rest of the
    contract stable.
    """

    thread = models.ForeignKey(InboxThread, on_delete=models.CASCADE, related_name="read_states")

    # Viewer identity (stable string):
    # - Authenticated users: me_<django_user_id>
    # - DEV: may be 'friends', 'work', etc.
    viewer_id = models.CharField(max_length=64)

    # Derived role classifier (visibility shim / indexing).
    viewer_role = models.CharField(max_length=16, choices=ViewerRoleId.choices)

    # Canonical read marker used to derive unread counts.
    last_read_ts = models.DateTimeField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["thread", "viewer_id"], name="inbox_read_thread_viewerid_uniq"),
        ]
        indexes = [            models.Index(fields=["viewer_id", "thread"], name="inbox_read_viewerid_thread"),
            models.Index(fields=["thread", "viewer_id"], name="inbox_read_thread_viewerid"),

            models.Index(fields=["viewer_role", "thread"], name="inbox_read_role_thread"),
            models.Index(fields=["thread", "viewer_role"], name="inbox_read_thread_role"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"InboxThreadReadState({self.thread_id}, {self.viewer_role})"
