from __future__ import annotations

from django.conf import settings
from django.db import models


class SiddesProfile(models.Model):
    """Siddes-specific profile + onboarding state (v0).

    We keep this separate from Django User so we can evolve without breaking auth.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="siddes_profile")

    # Onboarding
    onboarding_completed = models.BooleanField(default=False)
    onboarding_step = models.CharField(max_length=32, default="welcome")
    contact_sync_done = models.BooleanField(default=False)


    # Locality / region (sd_399)
    detected_region = models.CharField(max_length=8, blank=True, default="", db_index=True)
    detected_region_source = models.CharField(max_length=32, blank=True, default="")
    chosen_region = models.CharField(max_length=8, blank=True, default="", db_index=True)
    chosen_region_set_at = models.DateTimeField(null=True, blank=True)

    # Age gate (sd_399)
    age_gate_confirmed = models.BooleanField(default=False)
    age_gate_confirmed_at = models.DateTimeField(null=True, blank=True)


    # Email verification (Launch Part 0 / 0.2)
    email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    # Future: Side personas, trust, etc.
    # Safety / enforcement (Launch Part 0.6)
    # active|read_only|suspended|banned
    account_state = models.CharField(max_length=16, default="active", db_index=True)
    account_state_until = models.DateTimeField(null=True, blank=True)
    account_state_reason = models.CharField(max_length=160, blank=True)
    account_state_set_by = models.CharField(max_length=64, blank=True)
    account_state_set_at = models.DateTimeField(null=True, blank=True)


    # Account lifecycle (sd_324)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class EmailVerificationToken(models.Model):
    """Single-use email verification token (hashed)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_verify_tokens")
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]

class PasswordResetToken(models.Model):
    # Single-use password reset token (hashed).

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="password_reset_tokens")
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]

class MagicLinkToken(models.Model):
    """Single-use email magic-link token (hashed)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="magic_link_tokens")
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]



class UserSession(models.Model):
    """Tracked sessions for a user (device/session management)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="siddes_sessions")
    session_key = models.CharField(max_length=40, unique=True)

    ip = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.CharField(max_length=256, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "last_seen_at"]),
        ]



class EmailChangeToken(models.Model):
    """Single-use email change token (hashed)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='email_change_tokens')
    new_email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]



class AccountDeleteToken(models.Model):
    """Single-use account deletion token (hashed)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='account_delete_tokens')
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]
