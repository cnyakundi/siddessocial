"""Siddes DRF authentication (placeholder, military-grade direction).

Why this exists:
- We want to move from "viewer id in request header/cookie" (dev convenience)
  to real authentication (session/JWT/keys) for production.

Design:
- In DEV (settings.DEBUG=True): allow a lightweight "viewer" identity via:
    - Header: x-sd-viewer
    - Cookie: sd_viewer
  This keeps the beginner dev experience smooth while we build real auth.

- In PROD (settings.DEBUG=False): this auth class is inert (returns None).
  Production must rely on real authentication (Session/JWT/etc). Endpoints must
  remain default-safe (return restricted payloads when viewer is unknown).
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
    def is_authenticated(self) -> bool:  # DRF expects this attr/property
        return True

    def __str__(self) -> str:
        return str(self.id)


class DevHeaderViewerAuthentication(BaseAuthentication):
    """DEV-ONLY: authenticate a SiddesViewer from header/cookie.

    Enabled only when settings.DEBUG=True.
    """
    keyword = "x-sd-viewer"

    def authenticate(self, request) -> Optional[Tuple[SiddesViewer, str]]:
        # Hard stop for production safety.
        if not settings.DEBUG:
            return None

        viewer = request.headers.get("x-sd-viewer") or request.COOKIES.get("sd_viewer")
        if not viewer:
            return None

        viewer = str(viewer).strip()
        if not viewer:
            return None

        return (SiddesViewer(viewer), viewer)

