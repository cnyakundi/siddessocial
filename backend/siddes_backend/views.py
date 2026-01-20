from __future__ import annotations

import os
import socket
from urllib.parse import urlparse

from django.conf import settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.http import JsonResponse, HttpRequest


def healthz(request: HttpRequest):
    """Liveness probe."""
    return JsonResponse({"ok": True, "service": "siddes-backend"})


def _err(e: Exception) -> str:
    if getattr(settings, "DEBUG", False):
        return f"{e.__class__.__name__}: {e}"
    return e.__class__.__name__


def _build_info() -> dict[str, str]:
    # Safe metadata only. Do NOT include secrets.
    return {
        "sha": str(os.environ.get("SIDDES_BUILD_SHA") or os.environ.get("GIT_SHA") or "dev"),
        "time": str(os.environ.get("SIDDES_BUILD_TIME") or ""),
        "version": str(os.environ.get("SIDDES_VERSION") or ""),
    }


def _redis_check() -> tuple[bool, str]:
    """Return (ok, detail).

    Uses raw socket RESP so we do not require redis-py.
    Supports:
      redis://[:password@]host:port/db
      rediss://... (treated.toggle: treated as redis:// for now)

    If REDIS_URL is not set, we treat Redis as "skip" (ok).
    """

    raw = str(os.environ.get("REDIS_URL") or "").strip()
    if not raw:
        return True, "skip"

    try:
        u = urlparse(raw)
        host = u.hostname or "localhost"
        port = int(u.port or 6379)
        password = u.password

        # Basic TCP connect.
        with socket.create_connection((host, port), timeout=1.5) as s:
            s.settimeout(1.5)

            # AUTH if password provided.
            if password:
                pw = password.encode("utf-8")
                cmd = b"*2\r\n$4\r\nAUTH\r\n$" + str(len(pw)).encode("ascii") + b"\r\n" + pw + b"\r\n"
                s.sendall(cmd)
                resp = s.recv(64)
                if not resp.startswith(b"+OK"):
                    return False, "auth_failed"

            # PING
            s.sendall(b"*1\r\n$4\r\nPING\r\n")
            resp = s.recv(64)
            if resp.startswith(b"+PONG"):
                return True, "ok"
            return False, "bad_pong"
    except Exception as e:
        return False, _err(e)


def readyz(request: HttpRequest):
    """Readiness probe.

    Siddes ops rules:
    - Liveness (/healthz) can be shallow.
    - Readiness (/readyz) must fail loud if DB is down or migrations are pending.
    - If REDIS_URL is configured, Redis must respond to PING.

    Response:
      200 -> ready
      503 -> not ready
    """

    checks: dict[str, object] = {}
    ok = True

    # 1) DB connectivity
    try:
        connection.ensure_connection()
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        checks["db"] = "ok"
    except Exception as e:
        ok = False
        checks["db"] = "error"
        checks["db_error"] = _err(e)

    # 2) Pending migrations
    try:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        pending = [f"{m.app_label}.{m.name}" for (m, backwards) in plan if not backwards]
        if pending:
            ok = False
            checks["migrations"] = "pending"
            checks["pending_migrations_count"] = len(pending)
            if getattr(settings, "DEBUG", False):
                checks["pending_migrations"] = pending[:20]
        else:
            checks["migrations"] = "ok"
    except Exception as e:
        ok = False
        checks["migrations"] = "error"
        checks["migrations_error"] = _err(e)

    # 3) Redis (optional unless configured)
    r_ok, r_detail = _redis_check()
    checks["redis"] = "ok" if r_ok else "error"
    if r_detail != "ok" and r_detail != "skip":
        checks["redis_error"] = r_detail
    if not r_ok:
        ok = False

    status = 200 if ok else 503
    payload: dict[str, object] = {
        "ok": ok,
        "service": "siddes-backend",
        "checks": checks,
        "build": _build_info(),
    }

    # In production, keep the payload tight.
    if not getattr(settings, "DEBUG", False):
        # Remove detailed error strings.
        for k in list(payload.get("checks", {}).keys()):
            if str(k).endswith("_error"):
                (payload["checks"]).pop(k, None)
        # Remove migration list.
        (payload["checks"]).pop("pending_migrations", None)

    return JsonResponse(payload, status=status)
