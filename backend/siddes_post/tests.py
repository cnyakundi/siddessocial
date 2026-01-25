from __future__ import annotations
from rest_framework.test import APITestCase
from django.test import override_settings

@override_settings(DEBUG=True)
class PostsApiSmokeTests(APITestCase):
    def _create_post(self, *, side: str, viewer: str = "me", text: str = "hello") -> str:
        r = self.client.post(
            "/api/post",
            {"side": side, "text": text},
            format="json",
            HTTP_X_SD_VIEWER=viewer,
        )
        assert r.status_code == 201, r.content
        data = r.json()
        assert data.get("ok") is True
        post = data.get("post") or {}
        pid = post.get("id")
        assert pid
        return str(pid)

    def test_create_requires_viewer(self):
        r = self.client.post("/api/post", {"side": "public", "text": "hi"}, format="json")
        assert r.status_code == 401

    def test_create_requires_me_role(self):
        r = self.client.post(
            "/api/post",
            {"side": "public", "text": "hi"},
            format="json",
            HTTP_X_SD_VIEWER="friends",
        )
        assert r.status_code == 403

    def test_public_post_visible_to_anon(self):
        pid = self._create_post(side="public", viewer="me", text="public hi")
        r = self.client.get(f"/api/post/{pid}", HTTP_X_SD_VIEWER="anon")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert (data.get("post") or {}).get("id") == pid

    def test_friends_post_not_visible_to_anon(self):
        pid = self._create_post(side="friends", viewer="me", text="friends hi")
        r = self.client.get(f"/api/post/{pid}", HTTP_X_SD_VIEWER="anon")
        assert r.status_code == 404
        data = r.json()
        assert data.get("ok") is False
        assert data.get("error") == "not_found"



# sd_717d_mentions_backend_tests: server-side @mention safety (No Leaks)
from django.contrib.auth import get_user_model


@override_settings(DEBUG=True)
class MentionsSafetyTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username="owner", password="x")
        self.friend = User.objects.create_user(username="friend", password="x")
        self.boss = User.objects.create_user(username="boss", password="x")

        from siddes_prism.models import SideMembership  # type: ignore
        SideMembership.objects.create(owner=self.owner, member=self.friend, side="friends")

    def _viewer(self):
        return f"me_{self.owner.id}"

    def test_friends_post_allows_side_member_mention(self):
        r = self.client.post(
            "/api/post",
            {"side": "friends", "text": "hi @friend"},
            format="json",
            HTTP_X_SD_VIEWER=self._viewer(),
        )
        assert r.status_code == 201, r.content

    def test_friends_post_blocks_non_member_mention(self):
        r = self.client.post(
            "/api/post",
            {"side": "friends", "text": "hi @boss"},
            format="json",
            HTTP_X_SD_VIEWER=self._viewer(),
        )
        assert r.status_code == 400, r.content
        data = r.json()
        assert data.get("error") == "mention_forbidden"

    def test_close_requires_close_membership(self):
        # friend is only in friends -> close mention should be blocked
        r = self.client.post(
            "/api/post",
            {"side": "close", "text": "hi @friend"},
            format="json",
            HTTP_X_SD_VIEWER=self._viewer(),
        )
        assert r.status_code == 400, r.content

        # upgrade membership to close -> now allowed
        from siddes_prism.models import SideMembership  # type: ignore
        SideMembership.objects.filter(owner=self.owner, member=self.friend).update(side="close")

        r2 = self.client.post(
            "/api/post",
            {"side": "close", "text": "hi @friend"},
            format="json",
            HTTP_X_SD_VIEWER=self._viewer(),
        )
        assert r2.status_code == 201, r2.content

    def test_set_post_blocks_mentions_outside_set(self):
        from siddes_sets.models import SiddesSet  # type: ignore
        from siddes_sets.store_db import sync_memberships  # type: ignore

        sid = "testset"
        SiddesSet.objects.create(
            id=sid,
            owner_id=self._viewer(),
            side="friends",
            label="Test",
            color="emerald",
            members=["@friend"],
            count=0,
        )
        sync_memberships(set_id=sid, members=["@friend"])

        r = self.client.post(
            "/api/post",
            {"side": "friends", "setId": sid, "text": "hi @boss"},
            format="json",
            HTTP_X_SD_VIEWER=self._viewer(),
        )
        assert r.status_code == 400, r.content

        r2 = self.client.post(
            "/api/post",
            {"side": "friends", "setId": sid, "text": "hi @friend"},
            format="json",
            HTTP_X_SD_VIEWER=self._viewer(),
        )
        assert r2.status_code == 201, r2.content

