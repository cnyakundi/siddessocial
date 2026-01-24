from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import SideMembership


@override_settings(DEBUG=True)
class PrismGraphSecurityTests(APITestCase):
    """Hard regressions for Siddes Side graph direction + safety."""

    def setUp(self):
        User = get_user_model()
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="pw")
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="pw")
        self.h_alice = {"HTTP_X_SD_VIEWER": f"me_{self.alice.id}"}
        self.h_bob = {"HTTP_X_SD_VIEWER": f"me_{self.bob.id}"}

    def test_profile_locked_when_requesting_non_allowed_side(self):
        # Bob has not placed Alice into any side -> Alice only allowed to see Bob Public.
        r = self.client.get("/api/profile/bob?side=close", **self.h_alice)
        assert r.status_code == 403, r.content
        j = r.json()
        assert j.get("ok") is False
        assert j.get("error") == "locked"
        assert j.get("viewSide") == "public"
        assert j.get("requestedSide") == "close"
        assert j.get("allowedSides") == ["public"]

    def test_outgoing_siding_does_not_grant_incoming_access(self):
        # Alice places Bob into Friends.
        r = self.client.post("/api/side", {"username": "@bob", "side": "friends"}, format="json", **self.h_alice)
        assert r.status_code == 200, r.content
        assert r.json().get("ok") is True

        # Attempt Close upgrade without confirm must fail (sd_530).
        r = self.client.post("/api/side", {"username": "@bob", "side": "close"}, format="json", **self.h_alice)
        assert r.status_code == 400, r.content
        assert r.json().get("error") == "confirm_required"

        # Confirm Close upgrade succeeds.
        r = self.client.post(
            "/api/side",
            {"username": "@bob", "side": "close", "confirm": True},
            format="json",
            **self.h_alice,
        )
        assert r.status_code == 200, r.content
        assert r.json().get("ok") is True

        # Critical: Alice still cannot view Bob Close (because Bob hasn't sided Alice).
        r = self.client.get("/api/profile/bob?side=close", **self.h_alice)
        assert r.status_code == 403, r.content
        j = r.json()
        assert j.get("error") == "locked"
        assert j.get("viewSide") == "public"

        # Now Bob places Alice into Close -> Alice CAN view Bob Close.
        SideMembership.objects.update_or_create(owner=self.bob, member=self.alice, defaults={"side": "close"})
        r = self.client.get("/api/profile/bob?side=close", **self.h_alice)
        assert r.status_code == 200, r.content
        j = r.json()
        assert j.get("ok") is True
        assert j.get("viewSide") == "close"
        assert j.get("requestedSide") == "close"
        assert "close" in (j.get("allowedSides") or [])

    def test_close_requires_friends_first(self):
        # Even with confirm, you can't jump to Close unless they're already Friends.
        r = self.client.post(
            "/api/side",
            {"username": "@bob", "side": "close", "confirm": True},
            format="json",
            **self.h_alice,
        )
        assert r.status_code == 400, r.content
        assert r.json().get("error") == "friends_required"

    def test_work_requires_confirm(self):
        # Work doesn't require Friends, but DOES require explicit confirm.
        r = self.client.post("/api/side", {"username": "@bob", "side": "work"}, format="json", **self.h_alice)
        assert r.status_code == 400, r.content
        assert r.json().get("error") == "confirm_required"

        r = self.client.post(
            "/api/side",
            {"username": "@bob", "side": "work", "confirm": True},
            format="json",
            **self.h_alice,
        )
        assert r.status_code == 200, r.content
        assert r.json().get("ok") is True
