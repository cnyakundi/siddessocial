"""CSRF helpers (sd_237a).

Rule:
- DEBUG=True  -> allow dev-only CSRF exemptions
- DEBUG=False -> enforce CSRF (production safety)

This supports Siddes law:
- Session auth is the truth in production.
"""

from __future__ import annotations

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt


def dev_csrf_exempt(view_func):
    """Dev-only CSRF exemption wrapper."""
    if getattr(settings, "DEBUG", False):
        return csrf_exempt(view_func)
    return view_func
