"""URL routing for Siddes backend."""

from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

from siddes_media.views import MediaRedirectView

from .views import healthz, readyz

urlpatterns = [
    path("m/<path:key>", MediaRedirectView.as_view()),

    path("healthz", healthz),
    path("readyz", readyz),
    # API root (Django REST Framework endpoints live under this tree)
    path("api/", include("siddes_backend.api")),
    path("admin/", admin.site.urls),
]
