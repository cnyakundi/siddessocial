from __future__ import annotations

from django.apps import apps
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered


def _register_all_siddes_models() -> None:
    """Register all Siddes models in Django admin.

    Rule: any model whose app_label starts with 'siddes_' is considered part of the product.
    """
    for model in apps.get_models():
        if not getattr(model, "_meta", None):
            continue
        if not str(model._meta.app_label).startswith("siddes_"):
            continue
        try:
            admin.site.register(model)
        except AlreadyRegistered:
            pass


_register_all_siddes_models()
