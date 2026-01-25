"""Project-wide DRF exception shaping.

This is the final exception handler wired in settings.py.

Goals:
  - Stable client envelope: ok:false + requestId
  - Enumeration-safe signup errors (do not leak whether an email/username exists)
  - Stable throttling envelope: {error:"rate_limited", scope, retry_after_ms}
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response

from siddes_backend.drf_exceptions import exception_handler as _base_handler


def _safe_request_id(response: Optional[Response]) -> str:
    try:
        if response is None:
            return ""
        data = getattr(response, "data", None)
        if isinstance(data, dict):
            rid = str(data.get("requestId") or "").strip()
            return rid
    except Exception:
        pass
    return ""


def siddes_exception_handler(exc: Exception, context: Dict[str, Any]) -> Response | None:
    """Enumeration-safe exception handler.

    Notes:
      - Delegate to siddes_backend.drf_exceptions.exception_handler for the
        standard envelope (ok:false + requestId).
      - Then apply:
        (1) Throttling normalization
        (2) Signup enumeration hardening
    """
    response = _base_handler(exc, context)

    request = context.get("request") if isinstance(context, dict) else None
    view = context.get("view") if isinstance(context, dict) else None

    # --- 429 normalization ---
    try:
        if isinstance(exc, Throttled) and response is not None:
            rid = _safe_request_id(response)

            scope = ""
            if request is not None:
                scope = str(getattr(request, "siddes_throttle_scope", "") or "").strip()
            if not scope and view is not None:
                scope = str(getattr(view, "throttle_scope", "") or "").strip()

            wait_s: Optional[float] = None
            try:
                wait_s = float(getattr(exc, "wait", None)) if getattr(exc, "wait", None) is not None else None
            except Exception:
                wait_s = None
            if wait_s is None and request is not None:
                try:
                    wait_s = float(getattr(request, "siddes_throttle_wait", None))
                except Exception:
                    wait_s = None

            retry_after_ms: Optional[int] = None
            if wait_s is not None:
                try:
                    retry_after_ms = int(max(250, round(wait_s * 1000)))
                except Exception:
                    retry_after_ms = None

            payload: Dict[str, Any] = {"ok": False, "error": "rate_limited"}
            if scope:
                payload["scope"] = scope
            if retry_after_ms is not None:
                payload["retry_after_ms"] = retry_after_ms
                sec = max(1, int(round(retry_after_ms / 1000)))
                payload["message"] = f"Slow down — try again in {sec}s."
            if rid:
                payload["requestId"] = rid

            response.data = payload
            response.status_code = status.HTTP_429_TOO_MANY_REQUESTS
    except Exception:
        pass

    # --- Enumeration-safe signup ---
    try:
        if request is not None and response is not None:
            path = (getattr(request, "path", "") or "").rstrip("/")
            if path == "/api/auth/signup":
                data = getattr(response, "data", None)

                def _has_fields(d: object) -> bool:
                    return isinstance(d, dict) and ("email" in d or "username" in d)

                hits = False
                if _has_fields(data):
                    hits = True
                elif isinstance(data, dict) and data.get("error") == "validation_error" and _has_fields(data.get("details")):
                    hits = True

                if hits:
                    rid = _safe_request_id(response)
                    out: Dict[str, Any] = {"ok": False, "error": "signup_unavailable"}
                    if rid:
                        out["requestId"] = rid
                    response.data = out
                    response.status_code = 409
    except Exception:
        pass

    return response
