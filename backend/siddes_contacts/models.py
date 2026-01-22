from __future__ import annotations

from django.conf import settings
from django.db import models


class ContactIdentityToken(models.Model):
    """Verified identity tokens (HMAC) used for contact matching.

    We store only:
    - token (HMAC of normalized identifier)
    - kind (email|phone)
    - user (FK)
    """

    KIND_CHOICES = (
        ("email", "email"),
        ("phone", "phone"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="contact_tokens")
    token = models.CharField(max_length=64, db_index=True)
    kind = models.CharField(max_length=8, choices=KIND_CHOICES)

    # optional hint for debugging/dev UI (never store full contact payload)
    value_hint = models.CharField(max_length=32, blank=True, default="")

    verified_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("token", "kind"),)

class ContactMatchEdge(models.Model):
    """A viewer matched another Siddes user via contact tokens.

    Stores ONLY derived graph edges (viewer -> matched_user). Never stores the raw identifier.
    Used for: invite suggestions, mention candidates, import-set flows.

    Note: this is *not* a full contacts directory — it only reflects explicit user-initiated matching.
    """

    KIND_CHOICES = ContactIdentityToken.KIND_CHOICES

    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="contact_match_edges_out",
    )
    matched_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="contact_match_edges_in",
    )

    kind = models.CharField(max_length=8, choices=KIND_CHOICES, default="email")
    domain = models.CharField(max_length=128, blank=True, default="")
    workish = models.BooleanField(default=False)

    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["viewer", "matched_user"], name="sd_ct_edge_uniq_vm"),
        ]
        indexes = [
            models.Index(fields=["viewer", "-last_seen_at"], name="sd_ct_edge_v_ls_idx"),
            models.Index(fields=["matched_user", "-last_seen_at"], name="sd_ct_edge_m_ls_idx"),
        ]
