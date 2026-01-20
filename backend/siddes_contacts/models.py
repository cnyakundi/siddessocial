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
