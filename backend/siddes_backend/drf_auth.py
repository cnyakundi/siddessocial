"""Siddes DRF authentication (placeholder, military-grade direction).

DEV convenience:
- Header: x-sd-viewer
- Cookie: sd_viewer

Production safety:
- If settings.DEBUG is False -> inert.

Critical rule:
- Real Django session auth MUST take precedence over the dev viewer.
- The dev viewer MUST NOT apply to /api/auth/* (those endpoints reflect real login state).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

from django.conf import settings
from rest_framework.authentication import BaseAuthentication


@dataclass
class SiddesViewer:
    """Minimal stand-in for an authenticated user during stub/demo mode."""

    id: str

    @property
    def is_authenticated(self) -> bool:  # DRF expects this
        # DEV viewer tokens are not real auth. Treat as unauthenticated so views
        # fall back to x-sd-viewer/sd_viewer and role gates remain meaningful.
        return False

    def __str__(self) -> str:
        return str(self.id)


class DevHeaderViewerAuthentication(BaseAuthentication):
    """DEV-ONLY: authenticate a SiddesViewer from header/cookie."""

    keyword = "x-sd-viewer"

    def authenticate(self, request) -> Optional[Tuple[SiddesViewer, str]]:
        if not settings.DEBUG:
            return None

        # Determine path reliably; if we can't, be conservative and do nothing.
        path = ""
        try:
            path = getattr(getattr(request, "_request", None), "path", "") or getattr(request, "path", "") or ""
        except Exception:
            path = ""
        path = str(path or "")
        if not path:
            return None

        # Never apply dev viewer to real auth endpoints.
        if path.startswith("/api/auth/"):
            return None

        # If a real Django user is already present (session auth), do not override.
        try:
            dj_req = getattr(request, "_request", request)
            dj_user = getattr(dj_req, "user", None)
            if dj_user is not None and getattr(dj_user, "is_authenticated", False):
                return None
        except Exception:
            pass

        viewer = None
        try:
            viewer = request.headers.get("x-sd-viewer")
        except Exception:
            viewer = None
        if not viewer:
            try:
                viewer = getattr(request, "COOKIES", {}).get("sd_viewer")
            except Exception:
                viewer = None

        viewer = str(viewer or "").strip()
        if not viewer:
            return None

        return (SiddesViewer(viewer), viewer)
