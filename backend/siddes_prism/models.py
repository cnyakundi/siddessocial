from __future__ import annotations

from django.conf import settings
from django.db import models

class PrismSideId(models.TextChoices):
    PUBLIC = "public", "Public"
    FRIENDS = "friends", "Friends"
    CLOSE = "close", "Close"
    WORK = "work", "Work"

class PrismFacet(models.Model):
    """One identity facet per user per Side.

    This is the server-truth backing store for Prism Profile.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="prism_facets")
    side = models.CharField(max_length=16, choices=PrismSideId.choices, db_index=True)

    display_name = models.CharField(max_length=64, default="")
    headline = models.CharField(max_length=96, default="")
    bio = models.TextField(default="")

    location = models.CharField(max_length=64, blank=True, default="")
    website = models.CharField(max_length=160, blank=True, default="")
    cover_image_url = models.CharField(max_length=300, blank=True, default="")

    avatar_image_url = models.CharField(max_length=300, blank=True, default="")

    avatar_media_key = models.CharField(max_length=512, blank=True, default="")

    anthem_title = models.CharField(max_length=96, blank=True, default="")
    anthem_artist = models.CharField(max_length=96, blank=True, default="")

    pulse_label = models.CharField(max_length=48, blank=True, default="")
    pulse_text = models.CharField(max_length=280, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "side"], name="prismfacet_user_side"),
        ]
        indexes = [
            models.Index(fields=["user", "side"], name="prismfacet_user_side_idx"),
        ]

class SideMembership(models.Model):
    """Relationship state: owner has placed member into a Side.

    This is the canonical graph edge used to resolve what a viewer sees
    when they visit another user's profile.

    Important:
    - side MUST NOT be 'public' (public is the absence of a relationship edge).
    - Each (owner, member) pair has at most one side.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="side_outgoing")
    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="side_incoming")
    side = models.CharField(max_length=16, choices=PrismSideId.choices, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "member"], name="side_membership_owner_member"),
            models.CheckConstraint(check=~models.Q(side=PrismSideId.PUBLIC), name="side_membership_no_public"),
            models.CheckConstraint(check=~models.Q(owner=models.F("member")), name="side_membership_no_self"),
        ]
        indexes = [
            models.Index(fields=["owner", "side", "updated_at"], name="side_owner_side_upd"),
            models.Index(fields=["member", "updated_at"], name="side_member_upd"),
        ]

class SideAccessRequest(models.Model):
    # Requester asks owner to place them into a Side (Friends/Close/Work).
    # Owner controls access; requester can only ask.

    STATUS_CHOICES = (
        ("pending", "pending"),
        ("accepted", "accepted"),
        ("rejected", "rejected"),
        ("cancelled", "cancelled"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="side_access_requests_in",
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="side_access_requests_out",
    )

    side = models.CharField(max_length=16, choices=PrismSideId.choices, db_index=True)
    status = models.CharField(max_length=16, default="pending", choices=STATUS_CHOICES, db_index=True)
    message = models.CharField(max_length=280, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "requester", "side"], name="side_access_req_uniq"),
            models.CheckConstraint(check=~models.Q(side=PrismSideId.PUBLIC), name="side_access_req_no_public"),
            models.CheckConstraint(check=~models.Q(owner=models.F("requester")), name="side_access_req_no_self"),
        ]
        indexes = [
            models.Index(fields=["owner", "status", "-updated_at"], name="side_access_owner_st_upd"),
            models.Index(fields=["requester", "status", "-updated_at"], name="side_access_req_st_upd"),
        ]
class UserFollow(models.Model):
    """Public follow edge: follower follows target.

    One-way subscription for *Public* content only.
    Does NOT grant access to Friends/Close/Work.
    """

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follow_outgoing",
    )
    target = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follow_incoming",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "target"], name="userfollow_follower_target"),
            models.CheckConstraint(check=~models.Q(follower=models.F("target")), name="userfollow_no_self"),
        ]
        indexes = [
            models.Index(fields=["target", "created_at"], name="userfollow_target_created"),
            models.Index(fields=["follower", "created_at"], name="userfollow_follower_created"),
        ]
