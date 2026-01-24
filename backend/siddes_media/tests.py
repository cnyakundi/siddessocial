from __future__ import annotations

import time

from django.test import override_settings
from rest_framework.test import APITestCase

from .models import MediaObject


@override_settings(DEBUG=True)
class MediaApiSmokeTests(APITestCase):
    def _mk(self, *, owner: str = "me", key: str = "t/x.png", kind: str = "image", ct: str = "image/png", public: bool = False, post_id: str | None = None):
        return MediaObject.objects.create(
            id=f"mo_{int(time.time()*1000)}",
            owner_id=owner,
            r2_key=key,
            kind=kind,
            content_type=ct,
            status="pending",
            is_public=bool(public),
            created_at=time.time(),
            post_id=post_id,
        )
    def test_sign_upload_default_safe_without_viewer(self):
            # Write-guard middleware blocks unauthenticated POSTs (server-truth).
            r = self.client.post("/api/media/sign-upload", {"kind": "image", "contentType": "image/png"}, format="json")
            assert r.status_code == 401
            d = r.json()
            assert d.get("restricted") is True


    def test_sign_upload_requires_me_role(self):
        r = self.client.post(
            "/api/media/sign-upload",
            {"kind": "image", "contentType": "image/png"},
            format="json",
            HTTP_X_SD_VIEWER="friends",
        )
        assert r.status_code == 403

    def test_commit_requires_me_role(self):
        obj = self._mk(owner="me", key="t/need_me.png")
        r = self.client.post("/api/media/commit", {"r2Key": obj.r2_key, "isPublic": True}, format="json", HTTP_X_SD_VIEWER="friends")
        assert r.status_code == 403

    def test_commit_owner_succeeds_and_allows_video(self):
        obj = self._mk(owner="me", key="t/v.mp4", kind="video", ct="video/mp4")
        r = self.client.post(
            "/api/media/commit",
            {"r2Key": obj.r2_key, "isPublic": False, "postId": "p_test"},
            format="json",
            HTTP_X_SD_VIEWER="me",
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        obj.refresh_from_db()
        assert obj.status == "committed"
        assert obj.post_id == "p_test"

    def test_url_private_without_viewer_is_restricted(self):
        obj = self._mk(owner="me", key="t/priv.png", public=False)
        r = self.client.get(f"/api/media/url?key={obj.r2_key}")
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert d.get("restricted") is True

    def test_url_private_non_owner_is_forbidden_even_without_r2(self):
        obj = self._mk(owner="me", key="t/priv2.png", public=False)
        r = self.client.get(f"/api/media/url?key={obj.r2_key}", HTTP_X_SD_VIEWER="friends")
        assert r.status_code == 403
        d = r.json()
        assert d.get("ok") is False
        assert d.get("error") == "forbidden"

    def test_url_owner_hits_r2_gate(self):
        obj = self._mk(owner="me", key="t/owner.png", public=False)
        r = self.client.get(f"/api/media/url?key={obj.r2_key}", HTTP_X_SD_VIEWER="me")
        # If R2 isn't configured in the test env, this is expected.
        if r.status_code == 503:
            d = r.json()
            assert d.get("ok") is False
            assert d.get("error") == "r2_not_configured"
        else:
            assert r.status_code == 200
            d = r.json()
            assert d.get("ok") is True
            assert isinstance(d.get("url"), str) and d.get("url")
