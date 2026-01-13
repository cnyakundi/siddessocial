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
