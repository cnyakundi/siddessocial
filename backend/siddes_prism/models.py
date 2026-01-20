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
