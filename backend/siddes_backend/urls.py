"""URL routing for Siddes backend."""

from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

from .views import healthz

urlpatterns = [
    path("healthz", healthz),
    # API root (Django REST Framework endpoints live under this tree)
    path("api/", include("siddes_backend.api")),
    path("admin/", admin.site.urls),
]
