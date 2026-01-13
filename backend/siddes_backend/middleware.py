"""Middleware utilities for Siddes backend.

Note: We keep dependencies minimal. For local dev, we provide a small CORS
middleware so the Next.js frontend (localhost:3000/3001/...) can call the
Django API (localhost:8000/8001/...) directly.

Security posture:
- This middleware only activates for `/api/*` AND when DJANGO_DEBUG is truthy.
- Production must use a stricter allowlist or a dedicated CORS package.
"""

from __future__ import annotations

import os

from django.http import HttpRequest, HttpResponse


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


class DevCorsMiddleware:
    """Dev-only CORS middleware for local Next.js → Django.

    This exists so beginner dev flow works without extra setup.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def _enabled(self, request: HttpRequest) -> bool:
        if not request.path.startswith("/api/"):
            return False
        return _truthy(os.environ.get("DJANGO_DEBUG", "1"))

    def __call__(self, request: HttpRequest):
        if not self._enabled(request):
            return self.get_response(request)

        # Preflight
        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        origin = request.headers.get("Origin")

        # For credentialed requests, Access-Control-Allow-Origin must not be '*'.
        if origin:
            response["Access-Control-Allow-Origin"] = origin
            vary = response.get("Vary")
            response["Vary"] = f"{vary}, Origin" if vary else "Origin"
        else:
            response["Access-Control-Allow-Origin"] = "*"

        response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"

        req_headers = request.headers.get("Access-Control-Request-Headers")
        if req_headers:
            response["Access-Control-Allow-Headers"] = req_headers
            vary = response.get("Vary")
            if vary and "Access-Control-Request-Headers" not in vary:
                response["Vary"] = f"{vary}, Access-Control-Request-Headers"
            elif not vary:
                response["Vary"] = "Access-Control-Request-Headers"
        else:
            response["Access-Control-Allow-Headers"] = "content-type, x-sd-viewer"

        # Allow cookies if the browser chooses to send them.
        response["Access-Control-Allow-Credentials"] = "true"
        response["Access-Control-Max-Age"] = "600"

        return response
