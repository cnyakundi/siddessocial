from __future__ import annotations

from typing import Any, Dict

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc: Exception, context: Dict[str, Any]) -> Response:
    """Siddes DRF exception handler.

    Goals:
      - Preserve DRF default behavior (status codes, validation shapes)
      - Add correlation id: requestId (from RequestIdMiddleware)
      - Add ok:false so clients can treat it uniformly

    NOTE: We do not leak internal exception details in production.
    """
    response = drf_exception_handler(exc, context)

    request = context.get("request")
    rid = ""
    if request is not None:
        rid = str(getattr(request, "siddes_request_id", "") or "").strip()
        if not rid:
            rid = str(getattr(request, "META", {}).get("HTTP_X_REQUEST_ID") or "").strip()

    if response is None:
        data: Dict[str, Any] = {"ok": False, "error": "server_error"}
        if rid:
            data["requestId"] = rid
        return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    data = response.data

    if isinstance(data, dict):
        if "ok" not in data:
            data["ok"] = False
        if rid and "requestId" not in data:
            data["requestId"] = rid
        response.data = data
        return response

    # Rare: list payload. Wrap it so clients always have ok:false + requestId.
    wrapped: Dict[str, Any] = {"ok": False, "error": "validation_error", "details": data}
    if rid:
        wrapped["requestId"] = rid
    response.data = wrapped
    return response
