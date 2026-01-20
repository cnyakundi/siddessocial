"""Siddes API root (Django REST Framework).

Route structure (matches contract docs):
- /api/inbox/threads
- /api/inbox/thread/<id>

More feature routers can be registered here as they become real.

Note:
- We intentionally do NOT use Django Ninja anymore. DRF is the official API layer.
"""

from __future__ import annotations

from django.urls import include, path

from .views import readyz

urlpatterns = [
    path("health", readyz),
    path("inbox/", include("siddes_inbox.urls")),
    path("auth/", include("siddes_auth.urls")),
    path("contacts/", include("siddes_contacts.urls")),
    path("", include("siddes_broadcasts.urls")),
    path("", include("siddes_sets.urls")),
    path("", include("siddes_invites.urls")),
    path("", include("siddes_safety.urls")),
    path("", include("siddes_feed.urls")),
    path("", include("siddes_slate.urls")),
    # sd_230: Notifications must be reachable in production builds
    path("", include("siddes_notifications.urls")),
    path("", include("siddes_rituals.urls")),
    path("", include("siddes_post.urls")),
    path("", include("siddes_ml.urls")),
    path("", include("siddes_search.urls")),
        path("", include("siddes_prism.urls")),
    path("", include("siddes_media.urls")),
    path("telemetry/", include("siddes_telemetry.urls")),
]
