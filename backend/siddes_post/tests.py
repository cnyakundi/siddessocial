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

