from __future__ import annotations

from django.apps import AppConfig


class SiddesBackendConfig(AppConfig):
    """Project-level ops app.

    Purpose: expose management commands living under `siddes_backend.management.commands`.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "siddes_backend"
    verbose_name = "Siddes Backend"
