from rest_framework.views import exception_handler as drf_exception_handler

def siddes_exception_handler(exc, context):
    """
    Enumeration-safe exception handler:
      - For /api/auth/signup, never leak whether email/username exists.
    """
    response = drf_exception_handler(exc, context)
    request = context.get("request") if isinstance(context, dict) else None
    if response is None or request is None:
        return response

    try:
        path = (getattr(request, "path", "") or "").rstrip("/")
        if path == "/api/auth/signup":
            data = getattr(response, "data", None)

            # DRF ValidationError often looks like {"email": ["...already exists..."]}
            if isinstance(data, dict) and ("email" in data or "username" in data):
                response.data = {"ok": False, "error": "signup_unavailable"}
                response.status_code = 409
    except Exception:
        return response

    return response
