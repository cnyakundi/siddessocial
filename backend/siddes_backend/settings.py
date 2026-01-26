"""Django settings for Siddes.

This project is intentionally lightweight. Most domain logic lives in
framework-agnostic backend modules under `backend/siddes_*`.

Security posture:
- Default-safe APIs: if viewer cannot be authenticated/authorized, endpoints return
  `restricted: true` (no leaks).

Env vars (common):
- DJANGO_SECRET_KEY
- DJANGO_DEBUG (0/1)
- DJANGO_ALLOWED_HOSTS (comma-separated)
- DJANGO_TIME_ZONE
- DJANGO_CSRF_TRUSTED (comma-separated origins)
- DATABASE_URL
- REDIS_URL

Operational knobs:
- SIDDES_MOD_AUDIT_RETENTION_DAYS
- SIDDES_REPORT_RETENTION_DAYS
- SIDDES_TELEMETRY_ENABLED (0/1)
- SIDDES_TELEMETRY_RETENTION_DAYS

- SIDDES_PANIC_MODE (0/1)
- SIDDES_PANIC_WRITE_ALLOWLIST (comma-separated /api prefixes)
"""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")




def _env(name: str, default: str) -> str:
    v = os.environ.get(name)
    if v is None:
        return default
    v = str(v).strip()
    return v if v else default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(str(raw).strip())
    except Exception:
        return default


# Moderation retention policy (used by management commands)
SIDDES_MOD_AUDIT_RETENTION_DAYS = _env_int("SIDDES_MOD_AUDIT_RETENTION_DAYS", 365)
SIDDES_REPORT_RETENTION_DAYS = _env_int("SIDDES_REPORT_RETENTION_DAYS", 365)


# Privacy-safe telemetry (counts-only)
SIDDES_TELEMETRY_ENABLED = _truthy(os.environ.get("SIDDES_TELEMETRY_ENABLED", "1"))
SIDDES_TELEMETRY_RETENTION_DAYS = _env_int("SIDDES_TELEMETRY_RETENTION_DAYS", 30)


# Broadcasts are not MVP. Enable explicitly.
SIDDES_BROADCASTS_ENABLED = _truthy(os.environ.get("SIDDES_BROADCASTS_ENABLED", "0"))


SECRET_KEY = _env("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = _truthy(os.environ.get("DJANGO_DEBUG", "1"))

allowed = _env("DJANGO_ALLOWED_HOSTS", "*")
ALLOWED_HOSTS = [h.strip() for h in allowed.split(",") if h.strip()] if allowed else ["*"]

# SD_166_ALLOWED_HOSTS_DEV_PATCH
# Allow docker service-name hosts in DEBUG.
if DEBUG and "*" not in ALLOWED_HOSTS:
    for _h in ("backend", "localhost", "127.0.0.1"):
        if _h not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_h)

# Production guardrails — fail fast when misconfigured.
if not DEBUG:
    if SECRET_KEY == "dev-insecure-change-me" or len(SECRET_KEY) < 32:
        raise RuntimeError(
            "Unsafe configuration: set DJANGO_SECRET_KEY to a strong value (>=32 chars) when DJANGO_DEBUG=0."
        )
    if "*" in ALLOWED_HOSTS:
        raise RuntimeError(
            "Unsafe configuration: set DJANGO_ALLOWED_HOSTS (no wildcard) when DJANGO_DEBUG=0."
        )

    # SD_357_CONTACTS_PEPPER_GUARD
    contacts_pepper = os.environ.get("SIDDES_CONTACTS_PEPPER", "").strip()
    if (not contacts_pepper) or contacts_pepper == "dev_pepper_change_me" or len(contacts_pepper) < 32:
        raise RuntimeError(
            "Unsafe configuration: set SIDDES_CONTACTS_PEPPER to a strong secret (>=32 chars) when DJANGO_DEBUG=0."
        )


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "siddes_backend.apps.SiddesBackendConfig",
    # API framework
    "rest_framework",
    # Local apps
    "siddes_contacts.apps.SiddesContactsConfig",
    "siddes_auth.apps.SiddesAuthConfig",
    "siddes_inbox.apps.SiddesInboxConfig",
    "siddes_post.apps.SiddesPostConfig",
    "siddes_sets.apps.SiddesSetsConfig",
    "siddes_invites.apps.SiddesInvitesConfig",
    "siddes_feed.apps.SiddesFeedConfig",
    "siddes_slate.apps.SiddesSlateConfig",
    "siddes_notifications.apps.SiddesNotificationsConfig",
    "siddes_push.apps.SiddesPushConfig",  # sd_741_push_backend_db
    "siddes_safety.apps.SiddesSafetyConfig",
    "siddes_ml.apps.SiddesMlConfig",
    "siddes_rituals.apps.SiddesRitualsConfig",
        "siddes_prism.apps.SiddesPrismConfig",
    "siddes_telemetry.apps.SiddesTelemetryConfig",
    "siddes_search.apps.SiddesSearchConfig",
    "siddes_media.apps.SiddesMediaConfig",
]


# Broadcasts are disabled for MVP unless explicitly enabled.
if SIDDES_BROADCASTS_ENABLED:
    INSTALLED_APPS.append("siddes_broadcasts.apps.SiddesBroadcastsConfig")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Siddes middleware (order matters)
    "siddes_backend.middleware.RequestIdMiddleware",
    "siddes_backend.middleware.ApiRequestLogMiddleware",
    "siddes_backend.middleware.PanicModeMiddleware",
    "siddes_backend.middleware.DevCorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "siddes_auth.middleware.UserSessionCaptureMiddleware",
    'siddes_backend.middleware.DailyQuotaMiddleware',
    "siddes_backend.middleware.AccountStateMiddleware",
    "siddes_backend.middleware.ApiWriteAuthGuardMiddleware",

    "siddes_backend.middleware.ApiCacheSafetyHeadersMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "siddes_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "siddes_backend.wsgi.application"
ASGI_APPLICATION = "siddes_backend.asgi.application"

# Database
# Prefer DATABASE_URL (docker-compose), otherwise sqlite.
try:
    import dj_database_url  # type: ignore
except Exception:  # pragma: no cover
    dj_database_url = None

if dj_database_url is not None:
    DATABASES = {
        "default": dj_database_url.config(
            default=f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}",
            conn_max_age=60,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Cache (sd_255)
REDIS_URL = os.environ.get("REDIS_URL", "").strip()
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "siddes-local",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE", "Africa/Nairobi")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Cookie samesite defaults (safe for local dev + prod)
SESSION_COOKIE_SAMESITE = os.environ.get("DJANGO_SESSION_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.environ.get("DJANGO_CSRF_SAMESITE", "Lax")

# sd_390_cookie_domain: optional shared cookie domain (only set if you use subdomains like app.example.com + api.example.com)
_cookie_domain = (os.environ.get("SIDDES_COOKIE_DOMAIN") or os.environ.get("SD_COOKIE_DOMAIN") or "").strip()
if _cookie_domain:
    SESSION_COOKIE_DOMAIN = _cookie_domain
    CSRF_COOKIE_DOMAIN = _cookie_domain

# Dev-friendly origins for local Next.js → Django.
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in _env(
        "DJANGO_CSRF_TRUSTED",
        "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001",
    ).split(",")
    if o.strip()
]

# Request/body size guardrails (sd_364)
# Protects against giant JSON payloads that can DoS the app or bloat logs/DB.
# Values are in BYTES. Defaults are conservative and can be overridden via env.
DATA_UPLOAD_MAX_MEMORY_SIZE = _env_int("SIDDES_DATA_UPLOAD_MAX_MEMORY_SIZE", 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = _env_int("SIDDES_FILE_UPLOAD_MAX_MEMORY_SIZE", 1024 * 1024)

# Production hardening knobs (safe defaults).
if not DEBUG:
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = _truthy(os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "1"))
    SECURE_HSTS_SECONDS = _env_int("DJANGO_HSTS_SECONDS", 31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"

# Django REST Framework settings
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": (
        ("rest_framework.renderers.JSONRenderer",)
        if not DEBUG
        else (
            "rest_framework.renderers.JSONRenderer",
            "rest_framework.renderers.BrowsableAPIRenderer",
        )
    ),
    # Auth skeleton:
    # - DEV: DevHeaderViewerAuthentication enables x-sd-viewer / sd_viewer.
    # - PROD: inert; production must use real auth (session/JWT/etc).
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "siddes_backend.drf_auth.DevHeaderViewerAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ) + (("rest_framework.authentication.BasicAuthentication",) if DEBUG else ()),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    # Observability: standard error envelope + requestId
    "EXCEPTION_HANDLER": "siddes_backend.drf_exceptions.exception_handler",
    # Throttling (rate limiting)
    "DEFAULT_THROTTLE_CLASSES": ("siddes_backend.throttles.SiddesScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": _env("SIDDES_THROTTLE_AUTH_LOGIN", "20/min"),
        "auth_login_ident": _env("SIDDES_THROTTLE_AUTH_LOGIN_IDENT", "10/min"),

        "auth_signup": _env("SIDDES_THROTTLE_AUTH_SIGNUP", "10/hour"),
        "auth_google": _env("SIDDES_THROTTLE_AUTH_GOOGLE", "30/min"),
        "auth_magic_request": _env("SIDDES_THROTTLE_AUTH_MAGIC_REQUEST", "10/hour"),
        "auth_magic_ident": _env("SIDDES_THROTTLE_AUTH_MAGIC_IDENT", "10/hour"),
        "auth_magic_consume": _env("SIDDES_THROTTLE_AUTH_MAGIC_CONSUME", "30/min"),

        "auth_pw_reset_request": _env("SIDDES_THROTTLE_AUTH_PW_RESET_REQUEST", "5/hour"),
        "auth_pw_reset_ident": _env("SIDDES_THROTTLE_AUTH_PW_RESET_IDENT", "10/hour"),
        "auth_pw_reset_confirm": _env("SIDDES_THROTTLE_AUTH_PW_RESET_CONFIRM", "30/min"),
        "auth_pw_change": _env("SIDDES_THROTTLE_AUTH_PW_CHANGE", "10/min"),

        "auth_verify_confirm": _env("SIDDES_THROTTLE_AUTH_VERIFY_CONFIRM", "30/min"),
        "auth_verify_resend": _env("SIDDES_THROTTLE_AUTH_VERIFY_RESEND", "10/hour"),

        "auth_sessions_list": _env("SIDDES_THROTTLE_AUTH_SESSIONS_LIST", "60/min"),
        "auth_sessions_revoke": _env("SIDDES_THROTTLE_AUTH_SESSIONS_REVOKE", "30/min"),
        "auth_sessions_logout_all": _env("SIDDES_THROTTLE_AUTH_SESSIONS_LOGOUT_ALL", "5/min"),

        "auth_email_change_request": _env("SIDDES_THROTTLE_AUTH_EMAIL_CHANGE_REQUEST", "10/hour"),
        "auth_email_change_confirm": _env("SIDDES_THROTTLE_AUTH_EMAIL_CHANGE_CONFIRM", "30/min"),
        "auth_account_deactivate": _env("SIDDES_THROTTLE_AUTH_ACCOUNT_DEACTIVATE", "5/hour"),
        "auth_account_delete_request": _env("SIDDES_THROTTLE_AUTH_ACCOUNT_DELETE_REQUEST", "5/hour"),
        "auth_account_delete_confirm": _env("SIDDES_THROTTLE_AUTH_ACCOUNT_DELETE_CONFIRM", "30/min"),
        "auth_export": _env("SIDDES_THROTTLE_AUTH_EXPORT", "10/min"),

        "contacts_match": _env("SIDDES_THROTTLE_CONTACTS_MATCH", "10/min"),

        "contacts_suggestions": _env("SIDDES_THROTTLE_CONTACTS_SUGGESTIONS", "30/min"),

        "invites_list": _env("SIDDES_THROTTLE_INVITES_LIST", "120/min"),
        "invites_create": _env("SIDDES_THROTTLE_INVITES_CREATE", "20/min"),
        "invites_detail": _env("SIDDES_THROTTLE_INVITES_DETAIL", "240/min"),
        "invites_action": _env("SIDDES_THROTTLE_INVITES_ACTION", "30/min"),

        # Public endpoints (IP-keyed throttles)
        "slate_public": _env("SIDDES_THROTTLE_SLATE_PUBLIC", "60/min"),

        "inbox_threads": _env("SIDDES_THROTTLE_INBOX_THREADS", "120/min"),
        "inbox_thread": _env("SIDDES_THROTTLE_INBOX_THREAD", "240/min"),
        "inbox_send": _env("SIDDES_THROTTLE_INBOX_SEND", "60/min"),
        "inbox_debug": _env("SIDDES_THROTTLE_INBOX_DEBUG", "30/min"),

        "post_create": _env("SIDDES_THROTTLE_POST_CREATE", "30/min"),
        "post_reply_create": _env("SIDDES_THROTTLE_POST_REPLY_CREATE", "60/min"),
        "post_like": _env("SIDDES_THROTTLE_POST_LIKE", "240/min"),
        "post_echo": _env("SIDDES_THROTTLE_POST_ECHO", "60/min"),
        "post_quote": _env("SIDDES_THROTTLE_POST_QUOTE", "30/min"),

        "post_edit": _env("SIDDES_THROTTLE_POST_EDIT", "30/min"),
        "post_delete": _env("SIDDES_THROTTLE_POST_DELETE", "10/min"),

        "safety_block": _env("SIDDES_THROTTLE_SAFETY_BLOCK", "30/min"),
        "safety_mute": _env("SIDDES_THROTTLE_SAFETY_MUTE", "60/min"),
        "safety_report": _env("SIDDES_THROTTLE_SAFETY_REPORT", "20/min"),

        "safety_hide": _env("SIDDES_THROTTLE_SAFETY_HIDE", "120/min"),
        "moderation_post": _env("SIDDES_THROTTLE_MODERATION_POST", "60/min"),
        "moderation_user_state": _env("SIDDES_THROTTLE_MODERATION_USER_STATE", "60/min"),
        "moderation_audit": _env("SIDDES_THROTTLE_MODERATION_AUDIT", "120/min"),
        "ritual_list": _env("SIDDES_THROTTLE_RITUAL_LIST", "240/min"),
        "ritual_detail": _env("SIDDES_THROTTLE_RITUAL_DETAIL", "240/min"),
        "ritual_responses": _env("SIDDES_THROTTLE_RITUAL_RESPONSES", "240/min"),
        "ritual_create": _env("SIDDES_THROTTLE_RITUAL_CREATE", "20/min"),
        "ritual_ignite": _env("SIDDES_THROTTLE_RITUAL_IGNITE", "120/min"),
        "ritual_respond": _env("SIDDES_THROTTLE_RITUAL_RESPOND", "60/min"),
        "ritual_public_answer": _env("SIDDES_THROTTLE_RITUAL_PUBLIC_ANSWER", "20/min"),

        "moderation_export": _env("SIDDES_THROTTLE_MODERATION_EXPORT", "30/min"),

        "search_users": _env("SIDDES_THROTTLE_SEARCH_USERS", "120/min"),
        "search_posts": _env("SIDDES_THROTTLE_SEARCH_POSTS", "60/min"),
    },
}

# Observability (sd_158)
SD_LOG_LEVEL = os.environ.get("SD_LOG_LEVEL", "INFO").upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "siddes.api": {
            "handlers": ["console"],
            "level": SD_LOG_LEVEL,
            "propagate": False,
        },
    },
}


# sd_434_silence_suspicious_session: Silence noisy Django "Session data corrupted" warnings in dev.
# These warnings come from django.security.SuspiciousSession when a stale/foreign session cookie is present.
# In production we keep the warnings (DEBUG=False).
if DEBUG:
    try:
        LOGGING.setdefault("loggers", {})
        LOGGING["loggers"].setdefault(
            "django.security.SuspiciousSession",
            {"handlers": ["console"], "level": "WARNING"},
        )
        # Force ERROR in dev so the console isn't spammed.
        LOGGING["loggers"]["django.security.SuspiciousSession"]["level"] = "ERROR"
        LOGGING["loggers"]["django.security.SuspiciousSession"]["propagate"] = False
    except Exception:
        pass

# Siddes: enumeration-safe DRF exception handler (signup)
try:
    REST_FRAMEWORK
except NameError:
    REST_FRAMEWORK = {}
REST_FRAMEWORK["EXCEPTION_HANDLER"] = "siddes_backend.exceptions.siddes_exception_handler"


# WhiteNoise (static files)
# - Production (DJANGO_DEBUG=0): required.
# - Dev: optional; use default Django static storage.
if not DEBUG:
    try:
        import whitenoise  # noqa: F401
    except Exception as e:  # pragma: no cover
        raise RuntimeError("whitenoise must be installed when DJANGO_DEBUG=0") from e

    if "whitenoise.middleware.WhiteNoiseMiddleware" not in MIDDLEWARE:
        try:
            _idx = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
            MIDDLEWARE.insert(_idx + 1, "whitenoise.middleware.WhiteNoiseMiddleware")
        except ValueError:
            MIDDLEWARE.insert(0, "whitenoise.middleware.WhiteNoiseMiddleware")

    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
else:
    STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"

