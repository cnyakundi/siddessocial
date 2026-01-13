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

urlpatterns = [
    path("inbox/", include("siddes_inbox.urls")),
    path("", include("siddes_sets.urls")),
    path("", include("siddes_invites.urls")),
    path("", include("siddes_feed.urls")),
    path("", include("siddes_post.urls")),
]
