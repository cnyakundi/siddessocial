from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from siddes_prism.models import SideMembership
from siddes_sets.models import SiddesSet


@override_settings(DEBUG=True)
class BlockRevokesAccessTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.alice = User.objects.create_user(username="alice_block", email="alice_block@example.com", password="pw")
        self.bob = User.objects.create_user(username="bob_block", email="bob_block@example.com", password="pw")
        self.h_alice = {"HTTP_X_SD_VIEWER": f"me_{self.alice.id}"}

    def test_block_revokes_side_memberships_and_set_membership(self):
        # Create private graph edges (both directions)
        SideMembership.objects.create(owner=self.alice, member=self.bob, side="close")
        SideMembership.objects.create(owner=self.bob, member=self.alice, side="friends")

        # Create sets with cross-membership via handles
        SiddesSet.objects.create(
            id="set_block_a",
            owner_id=f"me_{self.alice.id}",
            side="friends",
            label="Block Test A",
            color="emerald",
            members=["@bob_block"],
            count=0,
        )
        SiddesSet.objects.create(
            id="set_block_b",
            owner_id=f"me_{self.bob.id}",
            side="friends",
            label="Block Test B",
            color="emerald",
            members=["@alice_block"],
            count=0,
        )

        r = self.client.post("/api/blocks", {"target": "@bob_block"}, format="json", **self.h_alice)
        assert r.status_code == 200, r.content
        assert r.json().get("ok") is True

        # Side edges removed in BOTH directions
        assert not SideMembership.objects.filter(owner=self.alice, member=self.bob).exists()
        assert not SideMembership.objects.filter(owner=self.bob, member=self.alice).exists()

        # Sets membership removed (best-effort)
        s1 = SiddesSet.objects.get(id="set_block_a")
        assert "@bob_block" not in (s1.members or [])

        s2 = SiddesSet.objects.get(id="set_block_b")
        assert "@alice_block" not in (s2.members or [])
