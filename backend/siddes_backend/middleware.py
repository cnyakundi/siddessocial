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
import json
import logging
import time
import uuid

from django.http import HttpRequest, HttpResponse, JsonResponse

LOG_API = logging.getLogger("siddes.api")

def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


class DevCorsMiddleware:
    """Dev-only CORS middleware for local Next.js → Django.

    SECURITY (sd_397):
    - Allowlist Origins (no reflection of arbitrary Origin).
    - Only emits Access-Control-Allow-Credentials when origin is allowed.

    Configure allowed origins (comma-separated):
      SIDDES_DEV_CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"

    Defaults are safe for local dev.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        raw = os.environ.get(
            "SIDDES_DEV_CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://localhost:3002,"
            "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002",
        )
        self.allow_origins = {o.strip() for o in str(raw).split(",") if o.strip()}

    def _enabled(self, request: HttpRequest) -> bool:
        if not request.path.startswith("/api/"):
            return False
        try:
            from django.conf import settings
            return bool(getattr(settings, "DEBUG", False))
        except Exception:
            # Fall back to env (dev only)
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
        origin_ok = bool(origin and origin in self.allow_origins)

        if origin_ok:
            response["Access-Control-Allow-Origin"] = origin
            vary = response.get("Vary")
            response["Vary"] = f"{vary}, Origin" if vary else "Origin"
            # Only allow credentials for allowlisted origins.
            response["Access-Control-Allow-Credentials"] = "true"
        else:
            # If there's no Origin (e.g., curl), allow '*' but WITHOUT credentials.
            if not origin:
                response["Access-Control-Allow-Origin"] = "*"

        response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"

        # Expose request id so browser clients can read it.
        response["Access-Control-Expose-Headers"] = "X-Request-ID"

        req_headers = request.headers.get("Access-Control-Request-Headers")
        if req_headers:
            # Bound header reflection to avoid log/response bloat.
            req_headers = str(req_headers)[:512]
            response["Access-Control-Allow-Headers"] = req_headers
            vary = response.get("Vary")
            if vary and "Access-Control-Request-Headers" not in vary:
                response["Vary"] = f"{vary}, Access-Control-Request-Headers"
            elif not vary:
                response["Vary"] = "Access-Control-Request-Headers"
        else:
            response["Access-Control-Allow-Headers"] = "content-type, x-sd-viewer, x-csrftoken, x-request-id"

        response["Access-Control-Max-Age"] = "600"
        return response

class RequestIdMiddleware:
    """Attach a request id to each request and return it in the response header.

    - Accepts an incoming X-Request-ID when provided (propagates across services).
    - Otherwise generates a short id.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        rid = request.headers.get("X-Request-ID") or request.META.get("HTTP_X_REQUEST_ID")
        rid = str(rid or "").strip()
        if not rid:
            rid = uuid.uuid4().hex[:16]
        request.siddes_request_id = rid

        response: HttpResponse = self.get_response(request)
        response["X-Request-ID"] = rid
        return response

# sd_392_api_request_log_hardening_force_create
# --- sd_395: Harden API request logging (no spoofing + redaction) -----------
# --- sd_395: Harden API request logging (no spoofing + redaction) -----------
class ApiRequestLogMiddleware:
    """Structured JSON request logs for /api/*.

    Security hardening:
    - viewer is derived from authenticated request.user only (prevents log poisoning)
    - query params are redacted for sensitive keys, and bounded in length
    - /api/auth/* query strings are omitted entirely

    Notes:
    - In DEBUG, we include dev_viewer for convenience, but it is never treated as truth.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        t0 = time.time()
        response: HttpResponse = self.get_response(request)
        dt_ms = int((time.time() - t0) * 1000)

        rid = (
            getattr(request, "siddes_request_id", None)
            or request.headers.get("X-Request-ID")
            or request.META.get("HTTP_X_REQUEST_ID")
        )
        rid = str(rid or "").strip()[:64] or None

        viewer = None
        try:
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                uid = getattr(user, "id", None)
                viewer = f"me_{uid}" if uid is not None else None
        except Exception:
            viewer = None

        dev_viewer = None
        try:
            if _truthy(os.environ.get("DJANGO_DEBUG", "1")):
                dv = request.headers.get("x-sd-viewer") or request.COOKIES.get("sd_viewer")
                dev_viewer = str(dv or "").strip()[:64] or None
        except Exception:
            dev_viewer = None

        side = None
        try:
            side = str(request.GET.get("side") or "").strip().lower()[:16] or None
        except Exception:
            side = None

        query_out = ""
        try:
            path = str(request.path or "")
            if path.startswith("/api/auth/"):
                query_out = ""
            else:
                qs = str(request.META.get("QUERY_STRING") or "")
                if qs:
                    import urllib.parse
                    sensitive = {
                        "token", "password", "pass", "passwd", "session", "sessionid",
                        "csrf", "csrftoken", "auth", "authorization", "apikey", "api_key",
                        "key", "secret", "code", "otp",
                    }
                    pairs = urllib.parse.parse_qsl(qs, keep_blank_values=True, strict_parsing=False)
                    red = []
                    for k, v in pairs[:60]:
                        kl = str(k).lower()
                        if kl in sensitive or any(s in kl for s in ("token", "pass", "secret", "key", "csrf", "session", "auth")):
                            red.append((k, "[REDACTED]"))
                        else:
                            vv = str(v)
                            if len(vv) > 200:
                                vv = vv[:200] + "…"
                            red.append((k, vv))
                    query_out = urllib.parse.urlencode(red, doseq=True)
                    if len(query_out) > 800:
                        query_out = query_out[:800] + "…"
        except Exception:
            query_out = ""

        payload = {
            "event": "api_request",
            "request_id": rid,
            "viewer": viewer,
            "dev_viewer": dev_viewer,
            "method": request.method,
            "path": request.path,
            "query": query_out,
            "side": side,
            "status": int(getattr(response, "status_code", 0) or 0),
            "latency_ms": dt_ms,
        }
        try:
            LOG_API.info(json.dumps(payload, separators=(",", ":")))
        except Exception:
            pass

        return response
# -----------------------------------------------------------------------------

class ApiWriteAuthGuardMiddleware:
    """Safety net: require authenticated user for /api write methods in production.

    Why: protects against accidental missing auth checks in new endpoints.

    Allowlist prefixes (comma-separated):
      SIDDES_API_WRITE_ALLOWLIST=/api/auth/

    Dev behavior:
    - When DJANGO_DEBUG is truthy, allow x-sd-viewer/sd_viewer for write requests (beginner flow).
    """

    def __init__(self, get_response):
        self.get_response = get_response
        raw = os.environ.get("SIDDES_API_WRITE_ALLOWLIST", "/api/auth/")
        self.allow_prefixes = [p.strip() for p in str(raw).split(",") if p.strip()]

    def __call__(self, request: HttpRequest):
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        method = str(getattr(request, "method", "") or "").upper()
        if method in ("GET", "HEAD", "OPTIONS"):
            return self.get_response(request)

        for prefix in self.allow_prefixes:
            if request.path.startswith(prefix):
                return self.get_response(request)

        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return self.get_response(request)

        # Dev-only: allow x-sd-viewer/sd_viewer writes to keep local flows simple.
        if _truthy(os.environ.get("DJANGO_DEBUG", "1")):
            try:
                dev_viewer = (request.headers.get("x-sd-viewer") or request.COOKIES.get("sd_viewer"))
            except Exception:
                dev_viewer = None
            if str(dev_viewer or "").strip():
                return self.get_response(request)

        rid = (getattr(request, "siddes_request_id", None) or request.headers.get("X-Request-ID") or request.META.get("HTTP_X_REQUEST_ID"))
        rid = str(rid or "").strip()[:64] or None

        payload = {
            "ok": False,
            "restricted": True,
            "error": "restricted",
            "request_id": rid,
        }
        resp = JsonResponse(payload, status=401)
        resp["Cache-Control"] = "no-store"
        return resp

class PanicModeMiddleware:
    """Emergency write-freeze for /api/*.

    Enable by setting:
      SIDDES_PANIC_MODE=1

    Write methods (POST/PATCH/PUT/DELETE) to /api/* will return 503 unless the
    request path starts with an allowlisted prefix.

    Configure allowlist:
      SIDDES_PANIC_WRITE_ALLOWLIST=/api/auth/,/api/reports,/api/blocks,/api/appeals,/api/mutes,/api/hidden-posts,/api/moderation/

    Notes:
    - GET/HEAD/OPTIONS are always allowed.
    - This is a server-side kill switch for world safety.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        raw = os.environ.get(
            "SIDDES_PANIC_WRITE_ALLOWLIST",
            "/api/auth/,/api/reports,/api/blocks,/api/appeals,/api/mutes,/api/hidden-posts,/api/moderation/",
        )
        self.allow_prefixes = [p.strip() for p in str(raw).split(",") if p.strip()]

    def __call__(self, request: HttpRequest):
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        enabled = _truthy(os.environ.get("SIDDES_PANIC_MODE", "0"))
        if not enabled:
            return self.get_response(request)

        method = str(getattr(request, "method", "") or "").upper()
        if method in ("GET", "HEAD", "OPTIONS"):
            return self.get_response(request)

        for prefix in self.allow_prefixes:
            if request.path.startswith(prefix):
                return self.get_response(request)

        rid = getattr(request, "siddes_request_id", None) or request.headers.get("X-Request-ID")
        payload = {
            "ok": False,
            "error": "panic_mode",
            "message": "Temporarily disabled while Siddes stabilizes.",
            "request_id": str(rid or "").strip()[:64] or None,
        }
        resp = JsonResponse(payload, status=503)
        resp["Cache-Control"] = "no-store"
        return resp

class AccountStateMiddleware:
    """Block unsafe writes for accounts in restricted states.

    States (stored on SiddesProfile):
      - active
      - read_only
      - suspended
      - banned

    Behavior:
      - Only applies to /api/* and unsafe methods (POST/PATCH/PUT/DELETE)
      - Staff bypass
      - Allowlist prefixes for account recovery + safety flows

    Env:
      SIDDES_ACCOUNT_STATE_ENFORCE=1|0
      SIDDES_ACCOUNT_STATE_WRITE_ALLOWLIST=/api/auth/,/api/blocks,/api/mutes,/api/reports,/api/appeals,/api/hidden-posts,/api/moderation/
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = _truthy(os.environ.get('SIDDES_ACCOUNT_STATE_ENFORCE', '1'))
        raw = os.environ.get(
            'SIDDES_ACCOUNT_STATE_WRITE_ALLOWLIST',
            '/api/auth/,/api/blocks,/api/mutes,/api/reports,/api/appeals,/api/hidden-posts,/api/moderation/',
        )
        self.allow_prefixes = [p.strip() for p in str(raw).split(',') if p.strip()]

    def __call__(self, request: HttpRequest):
        if not self.enabled:
            return self.get_response(request)

        if not str(getattr(request, 'path', '') or '').startswith('/api/'):
            return self.get_response(request)

        method = str(getattr(request, 'method', '') or '').upper()
        if method in ('GET', 'HEAD', 'OPTIONS'):
            return self.get_response(request)

        path = str(getattr(request, 'path', '') or '')
        for pref in self.allow_prefixes:
            if path.startswith(pref):
                return self.get_response(request)

        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return self.get_response(request)

        if bool(getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)):
            return self.get_response(request)

        try:
            from django.utils import timezone
            from siddes_auth.models import SiddesProfile  # type: ignore

            prof = getattr(user, 'siddes_profile', None)
            if prof is None:
                prof, _ = SiddesProfile.objects.get_or_create(user=user)

            state = str(getattr(prof, 'account_state', '') or 'active').strip().lower() or 'active'
            until = getattr(prof, 'account_state_until', None)
            reason = str(getattr(prof, 'account_state_reason', '') or '').strip()[:200] or None

            # Auto-expire timeboxed restrictions without writing DB.
            if state in ('read_only', 'suspended') and until is not None:
                try:
                    if timezone.now() >= until:
                        return self.get_response(request)
                except Exception:
                    pass

            if state in ('', 'active'):
                return self.get_response(request)

            rid = (
                getattr(request, 'siddes_request_id', None)
                or request.headers.get('X-Request-ID')
                or request.META.get('HTTP_X_REQUEST_ID')
            )
            rid = str(rid or '').strip()[:64] or None

            retry_after_sec = None
            if until is not None:
                try:
                    retry_after_sec = max(0, int((until - timezone.now()).total_seconds()))
                except Exception:
                    retry_after_sec = None

            payload = {
                'ok': False,
                'restricted': True,
                'error': 'account_restricted',
                'state': state,
                'until': until.isoformat() if until is not None else None,
                'retry_after_sec': retry_after_sec,
                'reason': reason,
                'request_id': rid,
            }
            resp = JsonResponse(payload, status=403)
            resp['Cache-Control'] = 'no-store'
            return resp

        except Exception:
            # Fail-open: never crash the API because of enforcement.
            return self.get_response(request)

# --- Siddes: Daily quotas (anti-abuse, prod-only) -----------------------------
class DailyQuotaMiddleware:
    """
    Production-only daily quotas for key write actions (anti-abuse).
    Generous defaults; override via env. Does not add UX friction for normal use.
    Env:
      SIDDES_DISABLE_DAILY_QUOTAS=1
      SIDDES_QUOTA_POST_CREATE_PER_DAY=200
      SIDDES_QUOTA_POST_REPLY_CREATE_PER_DAY=500
      SIDDES_QUOTA_INBOX_SEND_PER_DAY=300
      SIDDES_QUOTA_INVITES_CREATE_PER_DAY=50
      SIDDES_QUOTA_SAFETY_REPORT_PER_DAY=30
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            from django.conf import settings
            if getattr(settings, "DEBUG", False):
                return self.get_response(request)

            import os, re
            from django.core.cache import cache
            from django.http import JsonResponse
            from django.utils import timezone

            if os.getenv("SIDDES_DISABLE_DAILY_QUOTAS", "0").lower() in ("1", "true", "yes", "y"):
                return self.get_response(request)

            user = getattr(request, "user", None)
            if not user or not getattr(user, "is_authenticated", False):
                return self.get_response(request)

            method = (getattr(request, "method", "") or "").upper()
            if method != "POST":
                return self.get_response(request)

            path = (getattr(request, "path", "") or "").rstrip("/")
            action = None

            # NOTE: these are backend paths (Django)
            if path == "/api/post":
                action = "post_create"
            elif re.match(r"^/api/post/[^/]+/reply$", path):
                action = "post_reply_create"
            elif re.match(r"^/api/inbox/[^/]+$", path):
                action = "inbox_send"
            elif path == "/api/invites":
                action = "invites_create"
            elif path == "/api/reports":
                action = "safety_report"

            if not action:
                return self.get_response(request)

            limits = {
                "post_create": int(os.getenv("SIDDES_QUOTA_POST_CREATE_PER_DAY", "200")),
                "post_reply_create": int(os.getenv("SIDDES_QUOTA_POST_REPLY_CREATE_PER_DAY", "500")),
                "inbox_send": int(os.getenv("SIDDES_QUOTA_INBOX_SEND_PER_DAY", "300")),
                "invites_create": int(os.getenv("SIDDES_QUOTA_INVITES_CREATE_PER_DAY", "50")),
                "safety_report": int(os.getenv("SIDDES_QUOTA_SAFETY_REPORT_PER_DAY", "30")),
            }
            limit = int(limits.get(action, 0) or 0)
            if limit <= 0:
                return self.get_response(request)

            day = timezone.now().strftime("%Y%m%d")
            key = f"sdq:{action}:{user.id}:{day}"
            ttl = 60 * 60 * 36  # 36h safety window

            try:
                cache.add(key, 0, timeout=ttl)
                new_val = cache.incr(key)
            except Exception:
                cur = cache.get(key) or 0
                new_val = int(cur) + 1
                cache.set(key, new_val, timeout=ttl)

            if new_val > limit:
                rid = (
                    getattr(request, "siddes_request_id", None)
                    or request.headers.get("X-Request-ID")
                    or request.META.get("HTTP_X_REQUEST_ID")
                )
                rid = str(rid or "").strip()[:64] or None
                return JsonResponse(
                    {
                        "ok": False,
                        "error": "quota_exceeded",
                        "action": action,
                        "limit": limit,
                        **({"requestId": rid} if rid else {}),
                    },
                    status=429,
                )

            return self.get_response(request)
        except Exception:
            # Never break the app because of quota middleware
            return self.get_response(request)
# -----------------------------------------------------------------------------


# --- sd_391_api_request_log_hardening_force_override ------------------------------
# Hardening goals:
# - viewer is derived ONLY from authenticated request.user (no x-sd-viewer spoofing)
# - redact sensitive query params (token/password/session/csrf/apikey/etc)
# - bound query size to prevent log-bloat

def _sd_redact_query_string(qs: str, *, max_pairs: int = 40, max_len: int = 512) -> str:
    try:
        if not qs:
            return ''
        # Hard cap before parsing
        if len(qs) > 2048:
            qs = qs[:2048]

        from urllib.parse import parse_qsl, urlencode

        sensitive = {
            'token','access_token','refresh_token','id_token',
            'password','pass','pwd',
            'session','sessionid','sid',
            'csrf','csrftoken','csrfmiddlewaretoken',
            'apikey','api_key','key','secret','signature',
            'authorization','auth',
            'code','otp','mfa','sso',
        }

        pairs = []
        for k, v in parse_qsl(qs, keep_blank_values=True):
            if len(pairs) >= max_pairs:
                break
            kl = (k or '').strip().lower()
            if kl in sensitive or any(kl.endswith(s) for s in ('token','secret','password','session')):
                pairs.append((k, '[REDACTED]'))
            else:
                vv = str(v or '')
                if len(vv) > 128:
                    vv = vv[:128] + '…'
                pairs.append((k, vv))

        out = urlencode(pairs, doseq=True)
        if len(out) > max_len:
            out = out[:max_len] + '…'
        return out
    except Exception:
        return ''


class ApiRequestLogMiddleware:
    """Structured JSON request logs for /api/*.

    Fields:
      request_id, method, path, status, latency_ms, viewer, (optional) dev_viewer

    Note: This definition is intentionally placed at the end of the module to
    override any earlier ApiRequestLogMiddleware definitions.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: 'HttpRequest'):
        try:
            if not str(getattr(request, 'path', '') or '').startswith('/api/'):
                return self.get_response(request)

            t0 = time.time()
            response = self.get_response(request)
            dt_ms = int((time.time() - t0) * 1000)

            rid = (
                getattr(request, 'siddes_request_id', None)
                or request.headers.get('X-Request-ID')
                or request.META.get('HTTP_X_REQUEST_ID')
            )
            rid = str(rid or '').strip()[:64] or None

            user = getattr(request, 'user', None)
            viewer = None
            if user is not None and getattr(user, 'is_authenticated', False):
                try:
                    viewer = f"me_{int(getattr(user, 'id'))}"
                except Exception:
                    viewer = 'me'

            # Dev convenience (do not treat as truth)
            dev_viewer = None
            try:
                if _truthy(os.environ.get('DJANGO_DEBUG', '1')):
                    dv = request.headers.get('x-sd-viewer') or request.COOKIES.get('sd_viewer')
                    dev_viewer = str(dv or '').strip()[:64] or None
            except Exception:
                dev_viewer = None

            side = request.GET.get('side')
            side = str(side or '').strip().lower()[:16] or None

            # Never log query strings for auth endpoints (tokens may appear here)
            path = str(getattr(request, 'path', '') or '')
            qs = ''
            if not path.startswith('/api/auth/'):
                qs_raw = request.META.get('QUERY_STRING') or ''
                qs = _sd_redact_query_string(str(qs_raw or ''))

            payload = {
                'event': 'api_request',
                'request_id': rid,
                'viewer': viewer,
                'method': request.method,
                'path': path,
                'query': qs,
                'side': side,
                'status': int(getattr(response, 'status_code', 0) or 0),
                'latency_ms': dt_ms,
            }
            if dev_viewer and (not viewer):
                payload['dev_viewer'] = dev_viewer

            try:
                LOG_API.info(json.dumps(payload, separators=(',', ':')))
            except Exception:
                pass

            return response
        except Exception:
            return self.get_response(request)

# --- end sd_391_api_request_log_hardening_force_override --------------------------
# --- sd_584: Cache safety headers for /api/* (prevents edge/shared caching) --------
class ApiCacheSafetyHeadersMiddleware:
    """Force safe cache headers on /api/* responses.

    Why:
    - CDN/edge caches must never store personalized responses.
    - Makes intent explicit even if a proxy/CDN rule is misconfigured.
    - PRIVATE BY DEFAULT; public endpoints must explicitly opt in.

    Public allowlist prefixes (comma-separated):
      SIDDES_PUBLIC_API_PREFIXES="/api/slate,/api/health"
    """

    def __init__(self, get_response):
        self.get_response = get_response
        raw = os.environ.get("SIDDES_PUBLIC_API_PREFIXES", "/api/slate,/api/health")
        self.public_prefixes = [p.strip() for p in str(raw).split(",") if p.strip()]

    def __call__(self, request: HttpRequest):
        response: HttpResponse = self.get_response(request)

        if not str(getattr(request, "path", "") or "").startswith("/api/"):
            return response

        path = str(getattr(request, "path", "") or "")
        is_public = any(path.startswith(p) for p in self.public_prefixes)

        cc = response.get("Cache-Control") or response.get("cache-control")

        if is_public:
            # Public endpoints: default to revalidate-only (safe).
            if not cc:
                response["Cache-Control"] = "public, max-age=0, must-revalidate"
        else:
            # Private by default: never store in shared caches.
            response["Cache-Control"] = "private, no-store"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"

            # Vary is a belt: protects caches that ignore private/no-store.
            vary = response.get("Vary") or ""
            parts = [p.strip() for p in str(vary).split(",") if p.strip()] if vary else []
            lower = {p.lower() for p in parts}
            for need in ("Cookie", "Authorization"):
                if need.lower() not in lower:
                    parts.append(need)
                    lower.add(need.lower())
            response["Vary"] = ", ".join(parts)

        return response
