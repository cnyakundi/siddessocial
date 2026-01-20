from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@dataclass
class Finding:
    level: str  # "error" | "warn"
    code: str
    message: str


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _safe_str(e: Exception) -> str:
    # Do not leak secrets; keep it tight.
    name = e.__class__.__name__
    msg = str(e)
    if getattr(settings, "DEBUG", False):
        return f"{name}: {msg}"
    return name


class Command(BaseCommand):
    help = "Launch readiness checks. Exits non-zero if NOT SAFE TO SHIP."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Treat DEBUG=True and wildcard ALLOWED_HOSTS as errors (recommended for real launch).",
        )

    def handle(self, *args, **opts):
        strict = bool(opts.get("strict")) or _truthy(os.environ.get("SIDDES_LAUNCH_STRICT"))

        findings: List[Finding] = []

        # ---- Config checks ----
        if getattr(settings, "DEBUG", False):
            findings.append(
                Finding(
                    "error" if strict else "warn",
                    "DEBUG_TRUE",
                    "DEBUG is True (set DJANGO_DEBUG=0 for production).",
                )
            )

        secret = str(getattr(settings, "SECRET_KEY", "") or "").strip()
        if not secret or secret == "dev-insecure-change-me":
            findings.append(
                Finding(
                    "error",
                    "SECRET_KEY_DEFAULT",
                    "DJANGO_SECRET_KEY is default/insecure (set a strong value, >=32 chars).",
                )
            )
        elif len(secret) < 32:
            findings.append(
                Finding(
                    "error",
                    "SECRET_KEY_SHORT",
                    "DJANGO_SECRET_KEY is too short (<32 chars).",
                )
            )

        hosts = list(getattr(settings, "ALLOWED_HOSTS", []) or [])
        if "*" in hosts:
            findings.append(
                Finding(
                    "error" if strict else "warn",
                    "ALLOWED_HOSTS_WILDCARD",
                    "ALLOWED_HOSTS contains '*' wildcard (set DJANGO_ALLOWED_HOSTS with real domains).",
                )
            )

        # CSRF trusted origins should be explicit for production.
        if not getattr(settings, "DEBUG", False):
            trusted = list(getattr(settings, "CSRF_TRUSTED_ORIGINS", []) or [])
            if not trusted:
                findings.append(
                    Finding(
                        "error",
                        "CSRF_TRUSTED_EMPTY",
                        "CSRF_TRUSTED_ORIGINS is empty (set DJANGO_CSRF_TRUSTED).",
                    )
                )


        # CSRF trusted origins must NOT include localhost/127.0.0.1 in production.
        if not getattr(settings, "DEBUG", False):
            trusted = list(getattr(settings, "CSRF_TRUSTED_ORIGINS", []) or [])
            bad = [o for o in trusted if ("localhost" in o) or ("127.0.0.1" in o)]
            if bad:
                findings.append(
                    Finding(
                        "error" if strict else "warn",
                        "CSRF_TRUSTED_LOCALHOST",
                        "CSRF_TRUSTED_ORIGINS contains localhost/127.0.0.1 (remove for launch).",
                    )
                )

        # Public app base is required for email links (verify email / password reset).
        if not getattr(settings, "DEBUG", False):
            base = (
                os.environ.get("SIDDES_PUBLIC_APP_BASE")
                or os.environ.get("SD_PUBLIC_APP_BASE")
                or os.environ.get("SIDDES_PUBLIC_WEB_BASE")
                or os.environ.get("SD_PUBLIC_WEB_BASE")
                or ""
            ).strip()
            if not base:
                findings.append(
                    Finding(
                        "error",
                        "PUBLIC_APP_BASE_MISSING",
                        "Missing SIDDES_PUBLIC_APP_BASE (set to your Vercel app origin, e.g. https://app.example.com).",
                    )
                )
            elif "localhost" in base or "127.0.0.1" in base:
                findings.append(
                    Finding(
                        "error",
                        "PUBLIC_APP_BASE_LOCALHOST",
                        "SIDDES_PUBLIC_APP_BASE points to localhost (set to your real https domain).",
                    )
                )
        # Memory stores must never be enabled in production.
        allow_mem = str(os.environ.get("SIDDES_ALLOW_MEMORY_STORES", "")).strip() == "1"
        if allow_mem and not getattr(settings, "DEBUG", False):
            findings.append(
                Finding(
                    "error",
                    "MEMORY_STORES_ENABLED",
                    "SIDDES_ALLOW_MEMORY_STORES=1 while DEBUG=False (must be unset/0).",
                )
            )

        # Panic mode should be OFF for launch (unless you intentionally freeze writes).

        # ---- Email (transactional) ----
        if not getattr(settings, "DEBUG", False):
            provider = str(os.environ.get("SD_EMAIL_PROVIDER") or "").strip().lower()
            if not provider:
                provider = "smtp"

            if provider == "console":
                findings.append(
                    Finding(
                        "error",
                        "EMAIL_PROVIDER_CONSOLE",
                        "SD_EMAIL_PROVIDER is 'console' in production (set smtp or sendgrid).",
                    )
                )

            from_addr = str(os.environ.get("SD_EMAIL_FROM") or "").strip()
            if (not from_addr) or ("@" not in from_addr):
                findings.append(
                    Finding(
                        "warn" if not strict else "error",
                        "EMAIL_FROM_MISSING",
                        "SD_EMAIL_FROM is missing/invalid (set a real From address).",
                    )
                )

            if provider == "smtp":
                host = str(os.environ.get("SD_SMTP_HOST") or "").strip()
                if not host:
                    findings.append(
                        Finding(
                            "error",
                            "SMTP_HOST_MISSING",
                            "SD_SMTP_HOST is missing for SD_EMAIL_PROVIDER=smtp.",
                        )
                    )
            elif provider == "sendgrid":
                api_key = str(os.environ.get("SD_SENDGRID_API_KEY") or "").strip()
                if not api_key:
                    findings.append(
                        Finding(
                            "error",
                            "SENDGRID_API_KEY_MISSING",
                            "SD_SENDGRID_API_KEY is missing for SD_EMAIL_PROVIDER=sendgrid.",
                        )
                    )
            elif provider not in ("smtp", "sendgrid", "console"):
                findings.append(
                    Finding(
                        "warn",
                        "EMAIL_PROVIDER_UNKNOWN",
                        f"Unknown SD_EMAIL_PROVIDER='{provider}'. Supported: smtp, sendgrid, console.",
                    )
                )

            app_base = str(
                os.environ.get("SIDDES_PUBLIC_APP_BASE")
                or os.environ.get("SD_PUBLIC_APP_BASE")
                or os.environ.get("SIDDES_PUBLIC_WEB_BASE")
                or os.environ.get("SD_PUBLIC_WEB_BASE")
                or ""
            ).strip()
            if not app_base:
                findings.append(
                    Finding(
                        "warn",
                        "PUBLIC_APP_BASE_MISSING",
                        "SIDDES_PUBLIC_APP_BASE is not set (email links will not include clickable URLs).",
                    )
                )
        panic = str(os.environ.get("SIDDES_PANIC_MODE", "")).strip() == "1"
        if panic:
            findings.append(
                Finding(
                    "warn" if not strict else "error",
                    "PANIC_MODE_ON",
                    "SIDDES_PANIC_MODE=1 is enabled (writes may be frozen).",
                )
            )

        # ---- DB connectivity ----
        try:
            connection.ensure_connection()
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        except Exception as e:
            findings.append(Finding("error", "DB_DOWN", f"Database unreachable: {_safe_str(e)}"))

        # ---- Pending migrations ----
        try:
            executor = MigrationExecutor(connection)
            plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
            pending = [f"{m.app_label}.{m.name}" for (m, backwards) in plan if not backwards]
            if pending:
                findings.append(
                    Finding(
                        "error",
                        "MIGRATIONS_PENDING",
                        f"{len(pending)} pending migrations (run: python manage.py migrate).",
                    )
                )
        except Exception as e:
            findings.append(Finding("error", "MIGRATIONS_CHECK_FAILED", f"Migration check failed: {_safe_str(e)}"))

        # ---- Report ----
        errors = [f for f in findings if f.level == "error"]
        warns = [f for f in findings if f.level == "warn"]

        if errors:
            self.stderr.write("❌ NOT SAFE TO SHIP")
            for f in errors:
                self.stderr.write(f" - [{f.code}] {f.message}")
            if warns:
                self.stderr.write("")
                self.stderr.write("Warnings:")
                for f in warns:
                    self.stderr.write(f" - [{f.code}] {f.message}")
            raise SystemExit(1)

        self.stdout.write("✅ SAFE TO SHIP")
        if warns:
            self.stdout.write("")
            self.stdout.write("Warnings:")
            for f in warns:
                self.stdout.write(f" - [{f.code}] {f.message}")
