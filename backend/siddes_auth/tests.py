from __future__ import annotations

import hashlib
import os
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import EmailVerificationToken, MagicLinkToken, PasswordResetToken, SiddesProfile


def _h(raw: str) -> str:
    return hashlib.sha256((raw or "").encode("utf-8")).hexdigest()


class AuthEmailEngineSmokeTests(APITestCase):
    """Small, stable smoke tests for the auth email/token flows.

    These tests intentionally check:
      - anti-enumeration response for reset request
      - confirm endpoints authenticate the client session (cookie-based)
      - tokens become single-use
    """

    def setUp(self):
        # Ensure email sending never hits the network in tests.
        os.environ["DJANGO_DEBUG"] = "1"
        os.environ["SD_EMAIL_PROVIDER"] = "console"

        User = get_user_model()
        self.user = User.objects.create_user(
            username="alice",
            email="alice@example.com",
            password="OldPass123!",
        )
        SiddesProfile.objects.get_or_create(user=self.user)

    def test_password_reset_request_unknown_is_generic_ok(self):
        r = self.client.post("/api/auth/password/reset/request", {"identifier": "nobody@example.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertTrue(d.get("ok"))
        self.assertTrue(d.get("queued"))
        self.assertEqual(PasswordResetToken.objects.count(), 0)

    def test_password_reset_confirm_authenticates_and_marks_used(self):
        raw = "tok_pw_reset_1"
        now = timezone.now()
        PasswordResetToken.objects.create(
            user=self.user,
            email=self.user.email,
            token_hash=_h(raw),
            expires_at=now + timedelta(hours=2),
        )

        r = self.client.post(
            "/api/auth/password/reset/confirm",
            {"token": raw, "password": "NewPass123!"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertTrue(d.get("ok"))
        self.assertTrue(d.get("reset"))

        me = self.client.get("/api/auth/me")
        self.assertEqual(me.status_code, 200)
        md = me.json()
        self.assertTrue(md.get("authenticated"))

        rec = PasswordResetToken.objects.get(token_hash=_h(raw))
        self.assertIsNotNone(rec.used_at)

    def test_verify_confirm_marks_verified_and_authenticates(self):
        raw = "tok_verify_1"
        now = timezone.now()
        EmailVerificationToken.objects.create(
            user=self.user,
            email=self.user.email,
            token_hash=_h(raw),
            expires_at=now + timedelta(hours=24),
        )

        r = self.client.post("/api/auth/verify/confirm", {"token": raw}, format="json")
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertTrue(d.get("ok"))
        self.assertTrue(d.get("verified"))

        prof = SiddesProfile.objects.get(user=self.user)
        self.assertTrue(prof.email_verified)

        me = self.client.get("/api/auth/me")
        self.assertEqual(me.status_code, 200)
        md = me.json()
        self.assertTrue(md.get("authenticated"))
        self.assertTrue(md.get("emailVerified"))

    def test_magic_link_consume_authenticates_and_marks_used(self):
        raw = "tok_magic_1"
        now = timezone.now()
        MagicLinkToken.objects.create(
            user=self.user,
            email=self.user.email,
            token_hash=_h(raw),
            expires_at=now + timedelta(minutes=15),
        )

        r = self.client.post("/api/auth/magic/consume", {"token": raw}, format="json")
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertTrue(d.get("ok"))

        me = self.client.get("/api/auth/me")
        self.assertEqual(me.status_code, 200)
        md = me.json()
        self.assertTrue(md.get("authenticated"))

        rec = MagicLinkToken.objects.get(token_hash=_h(raw))
        self.assertIsNotNone(rec.used_at)
