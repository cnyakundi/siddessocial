from __future__ import annotations

from django.http import JsonResponse, HttpRequest


def healthz(request: HttpRequest):
    return JsonResponse({"ok": True, "service": "siddes-backend"})
