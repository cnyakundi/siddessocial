"""DRF throttling (rate limiting) primitives for Siddes.

Why a custom throttle?
- In DEV, we authenticate requests as a lightweight `SiddesViewer` object (not a Django model).
- DRF's built-in throttles assume `request.user.pk` exists for authenticated users.

This custom scoped throttle supports both:
- Real Django users (uses `user.pk`)
- DEV Siddes viewers (uses `user.id`)

Use via:
- settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES']
- view.throttle_scope = "..."
"""

from __future__ import annotations

from rest_framework.throttling import ScopedRateThrottle


class SiddesScopedRateThrottle(ScopedRateThrottle):
    """Scoped throttle that supports SiddesViewer identities in dev."""

    def get_cache_key(self, request, view):  # type: ignore[override]
        # For authenticated requests, prefer a stable user identifier.
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            ident = getattr(user, "pk", None)
            if ident is None:
                ident = getattr(user, "id", None)
            if ident is None:
                ident = str(user)
            ident = str(ident)
        else:
            ident = self.get_ident(request)

        return self.cache_format % {"scope": self.scope, "ident": ident}


class SiddesLoginIdentifierThrottle(ScopedRateThrottle):
    """Per-identifier login throttling (credential-stuffing defense).

    Why:
    - IP throttles are not sufficient against distributed credential stuffing.
    - This throttle keys by a *hashed* login identifier (email/username), salted
      with SECRET_KEY, so raw identifiers don't leak into cache keys.

    Applies only when configured as a throttle class on LoginView.
    """

    scope = "auth_login_ident"

    def get_scope(self, view):  # type: ignore[override]
        # Ignore view.throttle_scope; use our dedicated scope.
        return self.scope

    def get_cache_key(self, request, view):  # type: ignore[override]
        try:
            data = getattr(request, "data", None) or {}
        except Exception:
            data = {}

        raw = str(data.get("identifier") or "").strip()
        if not raw:
            return None

        ident = raw.lower()
        if len(ident) > 256:
            ident = ident[:256]

        # Hash identifier to avoid storing raw emails/usernames in cache keys.
        try:
            from django.conf import settings  # type: ignore
            import hashlib

            salt = str(getattr(settings, "SECRET_KEY", ""))
            h = hashlib.sha256((salt + "|" + ident).encode("utf-8")).hexdigest()[:32]
        except Exception:
            h = ident[:32]

        return self.cache_format % {"scope": self.get_scope(view), "ident": h}

