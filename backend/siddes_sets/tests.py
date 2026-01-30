from __future__ import annotations
from rest_framework.test import APITestCase
from django.test import override_settings

@override_settings(DEBUG=True)
class SetsApiSmokeTests(APITestCase):
    def test_list_default_safe_without_viewer(self):
        r = self.client.get("/api/circles")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("restricted") is True
        assert data.get("items") == []

    def test_create_requires_viewer(self):
        r = self.client.post("/api/circles", {"side": "friends", "label": "A"}, format="json")
        assert r.status_code == 401

    def test_create_requires_me_role(self):
        r = self.client.post(
            "/api/circles",
            {"side": "friends", "label": "A"},
            format="json",
            HTTP_X_SD_VIEWER="friends",
        )
        assert r.status_code == 403

    def test_owner_can_create_and_read(self):
        r = self.client.post(
            "/api/circles",
            {"side": "friends", "label": "TestSet", "members": []},
            format="json",
            HTTP_X_SD_VIEWER="me",
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("restricted") is False
        sid = (data.get("item") or {}).get("id")
        assert sid

        r2 = self.client.get(f"/api/circles/{sid}", HTTP_X_SD_VIEWER="me")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("ok") is True
        assert d2.get("restricted") is False
        assert (d2.get("item") or {}).get("id") == sid

    def test_non_member_get_is_default_safe(self):
        r = self.client.post(
            "/api/circles",
            {"side": "friends", "label": "PrivateSet", "members": []},
            format="json",
            HTTP_X_SD_VIEWER="me",
        )
        sid = (r.json().get("item") or {}).get("id")
        assert sid

        r2 = self.client.get(f"/api/circles/{sid}", HTTP_X_SD_VIEWER="close")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("ok") is True
        assert d2.get("restricted") is True
        assert d2.get("item") is None

    def test_member_can_read_set(self):
        r = self.client.post(
            "/api/circles",
            {"side": "friends", "label": "MemberSet", "members": ["@a"]},
            format="json",
            HTTP_X_SD_VIEWER="me",
        )
        assert r.status_code == 200
        sid = (r.json().get("item") or {}).get("id")
        assert sid

        r2 = self.client.get(f"/api/circles/{sid}", HTTP_X_SD_VIEWER="@a")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("ok") is True
        assert d2.get("restricted") is False
        assert (d2.get("item") or {}).get("id") == sid

