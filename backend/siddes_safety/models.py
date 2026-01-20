from __future__ import annotations

from django.db import models


class UserBlock(models.Model):
    """A viewer blocks another identity token."""

    blocker_id = models.CharField(max_length=64, db_index=True)
    blocked_token = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("blocker_id", "blocked_token")


class UserMute(models.Model):
    """A viewer mutes another identity token (one-way)."""

    muter_id = models.CharField(max_length=64, db_index=True)
    muted_token = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("muter_id", "muted_token")


class UserReport(models.Model):
    """A viewer reports content for moderation review."""

    reporter_id = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=16, db_index=True)  # post|user|reply|broadcast
    target_id = models.CharField(max_length=128, db_index=True)
    reason = models.CharField(max_length=32, db_index=True)
    details = models.TextField(blank=True)
    request_id = models.CharField(max_length=64, blank=True)

    # Moderation lifecycle
    status = models.CharField(max_length=16, db_index=True, default="open")  # open|reviewing|resolved|dismissed

    created_at = models.DateTimeField(auto_now_add=True)


class UserAppeal(models.Model):
    """A viewer appeals a moderation action or restriction.

    Minimal v0: capture text + target reference, with a staff-reviewable status.
    """

    appellant_id = models.CharField(max_length=64, db_index=True)

    # What is being appealed (best-effort reference).
    target_type = models.CharField(max_length=16, db_index=True, default="account")  # account|post|user|reply|broadcast|report
    target_id = models.CharField(max_length=128, db_index=True, blank=True, default="")

    reason = models.CharField(max_length=32, db_index=True, default="other")
    details = models.TextField(blank=True)
    request_id = models.CharField(max_length=64, blank=True)

    status = models.CharField(max_length=16, db_index=True, default="open")  # open|reviewing|resolved|dismissed

    # Staff-only note (optional)
    staff_note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)





class UserHiddenPost(models.Model):
    """A viewer hides a post (remove from their own view only)."""

    viewer_id = models.CharField(max_length=64, db_index=True)
    post_id = models.CharField(max_length=128, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("viewer_id", "post_id")

class ModerationAuditEvent(models.Model):
    """Staff-only audit trail for moderation actions."""

    actor_id = models.CharField(max_length=64, db_index=True)  # viewer token (usually me_<id>)
    action = models.CharField(max_length=32, db_index=True)  # report_status, post_hide, post_unhide
    target_type = models.CharField(max_length=16, db_index=True)  # report|post|user|reply|broadcast
    target_id = models.CharField(max_length=128, db_index=True)

    # Extra data (safe to ignore by clients)
    meta = models.JSONField(default=dict, blank=True)
    request_id = models.CharField(max_length=64, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
