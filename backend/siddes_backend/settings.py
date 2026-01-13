"""Django settings for Siddes.

This project is intentionally lightweight. Most domain logic lives in
framework-agnostic backend modules under `backend/siddes_*`.

Security posture:
- Default-safe APIs: if viewer cannot be authenticated/authorized, endpoints return
  `restricted: true` (no leaks).

Env vars:
- DJANGO_SECRET_KEY
- DJANGO_DEBUG (0/1)
- DJANGO_ALLOWED_HOSTS (comma-separated)
- DJANGO_TIME_ZONE
- DJANGO_CSRF_TRUSTED (comma-separated origins)
- DATABASE_URL
- SIDDES_THROTTLE_INBOX_THREADS
- SIDDES_THROTTLE_INBOX_THREAD
- SIDDES_THROTTLE_INBOX_SEND
- SIDDES_THROTTLE_INBOX_DEBUG
- DJANGO_HSTS_SECONDS (prod)
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


SECRET_KEY = _env("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = _truthy(os.environ.get("DJANGO_DEBUG", "1"))

allowed = _env("DJANGO_ALLOWED_HOSTS", "*")
ALLOWED_HOSTS = [h.strip() for h in allowed.split(",") if h.strip()] if allowed else ["*"]

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


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # API framework (official)
    "rest_framework",
    # Local apps
    "siddes_inbox.apps.SiddesInboxConfig",
    "siddes_post.apps.SiddesPostConfig",
    "siddes_sets.apps.SiddesSetsConfig",
    "siddes_invites.apps.SiddesInvitesConfig",
    "siddes_feed.apps.SiddesFeedConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "siddes_backend.middleware.DevCorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
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

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Dev-friendly origins for local Next.js → Django.
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in _env(
        "DJANGO_CSRF_TRUSTED",
        "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001",
    ).split(",")
    if o.strip()
]

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
    # - DEV: `DevHeaderViewerAuthentication` enables `x-sd-viewer` / `sd_viewer`.
    # - PROD: it becomes inert; production must use real auth (session/JWT/etc).
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "siddes_backend.drf_auth.DevHeaderViewerAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ),
    # We still return default-safe restricted payloads at the domain layer,
    # so keep DRF permissions open for now.
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    # Throttling (rate limiting) — military-grade hygiene.
    # We use a custom scoped throttle that supports our DEV `SiddesViewer` identity.
    "DEFAULT_THROTTLE_CLASSES": ("siddes_backend.throttles.SiddesScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "inbox_threads": _env("SIDDES_THROTTLE_INBOX_THREADS", "120/min"),
        "inbox_thread": _env("SIDDES_THROTTLE_INBOX_THREAD", "240/min"),
        "inbox_send": _env("SIDDES_THROTTLE_INBOX_SEND", "60/min"),
        "inbox_debug": _env("SIDDES_THROTTLE_INBOX_DEBUG", "30/min"),
    },
}
