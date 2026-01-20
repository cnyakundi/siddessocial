#!/usr/bin/env bash
set -euo pipefail

# sd_322_device_session_management_apply_helper.sh
# LAUNCH PART 0 / P1.4 — Device & Session Management
#
# Adds:
# - backend/siddes_auth/models.UserSession (+ migration)
# - backend/siddes_auth/middleware.UserSessionCaptureMiddleware
# - backend/siddes_auth/sessions.py (API views)
# - /api/auth/sessions (GET)
# - /api/auth/sessions/revoke (POST)
# - /api/auth/sessions/logout_all (POST)
# - Frontend: /siddes-profile/account/sessions
# - Frontend API proxies: /api/auth/sessions/*

need_dir() {
  if [[ ! -d "$1" ]]; then
    echo "ERROR: Expected directory not found: $1"
    echo "Run this from your Siddes repo root."
    exit 1
  fi
}

PYBIN="python3"
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  PYBIN="python"
fi
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  echo "ERROR: python3 (or python) is required to apply this overlay."
  exit 1
fi

need_dir "backend"
need_dir "frontend"
need_dir "docs"
need_dir "backend/siddes_auth"
need_dir "backend/siddes_backend"
need_dir "frontend/src/app"
need_dir "frontend/src/app/api/auth"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_sd_322_sessions_${STAMP}"
mkdir -p "$BACKUP_DIR"

backup_if_exists() {
  local f="$1"
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -f "$f" "$BACKUP_DIR/$f"
  fi
}

echo "== sd_322: Device/session management =="
echo "Backups: $BACKUP_DIR"

# Backups
backup_if_exists "backend/siddes_auth/models.py"
backup_if_exists "backend/siddes_auth/urls.py"
backup_if_exists "backend/siddes_backend/settings.py"
backup_if_exists "docs/STATE.md"

backup_if_exists "frontend/src/app/siddes-profile/account/page.tsx"

# -----------------------------------------------------------------------------
# Backend: sessions API
# -----------------------------------------------------------------------------
cat > backend/siddes_auth/sessions.py <<'PY'
from __future__ import annotations

from typing import Any, Dict, Optional

from django.contrib.auth import logout
from django.contrib.sessions.models import Session
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt

from .models import UserSession


def _iso(dt) -> Optional[str]:
    if not dt:
        return None
    try:
        return dt.isoformat()
    except Exception:
        return None


@method_decorator(dev_csrf_exempt, name="dispatch")
class SessionsListView(APIView):
    throttle_scope = "auth_sessions_list"

    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        cur_key = ""
        try:
            cur_key = str(getattr(request, "session", None).session_key or "")
        except Exception:
            cur_key = ""

        rows = (
            UserSession.objects.filter(user=user)
            .order_by("-last_seen_at")
            .all()[:50]
        )

        sessions = []
        for r in rows:
            sessions.append(
                {
                    "id": r.id,
                    "current": bool(cur_key and r.session_key == cur_key),
                    "createdAt": _iso(r.created_at),
                    "lastSeenAt": _iso(r.last_seen_at),
                    "ip": r.ip or "",
                    "userAgent": (r.user_agent or "")[:256],
                    "revokedAt": _iso(r.revoked_at),
                }
            )

        return Response({"ok": True, "sessions": sessions}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class SessionsRevokeView(APIView):
    throttle_scope = "auth_sessions_revoke"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data or {}
        sid = body.get("id")
        try:
            sid_int = int(sid)
        except Exception:
            return Response({"ok": False, "error": "invalid_id"}, status=status.HTTP_400_BAD_REQUEST)

        rec = UserSession.objects.filter(user=user, id=sid_int).first()
        if not rec:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        cur_key = ""
        try:
            cur_key = str(getattr(request, "session", None).session_key or "")
        except Exception:
            cur_key = ""

        now = timezone.now()

        # If revoking current session, log out and flush.
        if cur_key and rec.session_key == cur_key:
            try:
                Session.objects.filter(session_key=rec.session_key).delete()
            except Exception:
                pass
            rec.revoked_at = now
            rec.save(update_fields=["revoked_at"])
            try:
                logout(request)
                request.session.flush()
            except Exception:
                pass
            return Response({"ok": True, "revoked": True, "loggedOut": True}, status=status.HTTP_200_OK)

        # Revoke other device
        try:
            Session.objects.filter(session_key=rec.session_key).delete()
        except Exception:
            pass

        rec.revoked_at = now
        rec.save(update_fields=["revoked_at"])

        return Response({"ok": True, "revoked": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class SessionsLogoutAllView(APIView):
    """
    POST /api/auth/sessions/logout_all
    Body (optional): { includeCurrent: false }
    Default: logs out OTHER sessions, keeps current session alive.
    """
    throttle_scope = "auth_sessions_logout_all"

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"ok": False, "error": "restricted"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data or {}
        include_current = bool(body.get("includeCurrent", False))

        cur_key = ""
        try:
            cur_key = str(getattr(request, "session", None).session_key or "")
        except Exception:
            cur_key = ""

        now = timezone.now()

        # Revoke from our tracking table (fast path)
        qs = UserSession.objects.filter(user=user, revoked_at__isnull=True)
        if cur_key and not include_current:
            qs = qs.exclude(session_key=cur_key)

        recs = list(qs.all())
        revoked_count = 0
        for r in recs:
            try:
                Session.objects.filter(session_key=r.session_key).delete()
            except Exception:
                pass
            r.revoked_at = now
            r.save(update_fields=["revoked_at"])
            revoked_count += 1

        # Best-effort: also scan django sessions table (completeness for sessions not yet tracked)
        scanned_deleted = 0
        try:
            for s in Session.objects.filter(expire_date__gt=now).iterator(chunk_size=200):
                try:
                    data = s.get_decoded() or {}
                    uid = str(data.get("_auth_user_id") or "")
                    if uid == str(user.id):
                        if cur_key and not include_current and s.session_key == cur_key:
                            continue
                        s.delete()
                        scanned_deleted += 1
                except Exception:
                    continue
        except Exception:
            pass

        logged_out = False
        if include_current:
            try:
                logout(request)
                request.session.flush()
                logged_out = True
            except Exception:
                logged_out = False

        return Response(
            {"ok": True, "revoked": revoked_count, "scannedDeleted": scanned_deleted, "loggedOut": logged_out},
            status=status.HTTP_200_OK,
        )
PY
echo "OK: wrote backend/siddes_auth/sessions.py"

# -----------------------------------------------------------------------------
# Backend: session capture middleware
# -----------------------------------------------------------------------------
cat > backend/siddes_auth/middleware.py <<'PY'
from __future__ import annotations

from django.contrib.auth import logout
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone

from .models import UserSession


class UserSessionCaptureMiddleware:
    """
    Track user sessions for device/session management.

    - Inserts/updates a UserSession row for authenticated requests.
    - If a session is marked revoked, logs the user out (deny-by-default).
    - Updates last_seen_at at most once per 60 seconds to reduce DB writes.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Pre: if session is revoked, force logout before view executes
        try:
            user = getattr(request, "user", None)
            session = getattr(request, "session", None)
            session_key = str(getattr(session, "session_key", "") or "")
            if user and getattr(user, "is_authenticated", False) and session_key:
                rec = UserSession.objects.filter(session_key=session_key).first()
                if rec and rec.revoked_at is not None:
                    try:
                        logout(request)
                        request.session.flush()
                    except Exception:
                        pass
        except (OperationalError, ProgrammingError):
            # migrations not applied yet
            pass
        except Exception:
            pass

        response = self.get_response(request)

        # Post: record usage (best-effort)
        try:
            user = importing_user = getattr(request, "user", None)
            session = getattr(request, "session", None)
            session_key = str(getattr(session, "session_key", "") or "")
            if not user or not getattr(user, "is_authenticated", False) or not session_key:
                return response

            now = timezone.now()

            ip = ""
            try:
                xff = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
                ip = xff or str(request.META.get("REMOTE_ADDR") or "").strip()
            except Exception:
                ip = ""

            ua = ""
            try:
                ua = str(request.META.get("HTTP_USER_AGENT") or "")[:256]
            except Exception:
                ua = ""

            rec = UserSession.objects.filter(session_key=session_key).first()
            if rec:
                # Update at most once per 60s
                try:
                    age = (now - (rec.last_seen_at or now)).total_seconds()
                except Exception:
                    age = 61
                if age >= 60:
                    rec.last_seen_at = now
                    if ip:
                        rec.ip = ip
                    if ua:
                        rec.user_agent = ua
                    rec.save(update_fields=["last_seen_at", "ip", "user_agent"])
            else:
                UserSession.objects.create(
                    user=user,
                    session_key=session_key,
                    last_seen_at=now,
                    ip=ip or "",
                    user_agent=ua or "",
                )
        except (OperationalError, ProgrammingError):
            # migrations not applied yet
            pass
        except Exception:
            pass

        return response
PY
echo "OK: wrote backend/siddes_auth/middleware.py"

# -----------------------------------------------------------------------------
# Backend: patch models.py to add UserSession
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib, sys

p = pathlib.Path("backend/siddes_auth/models.py")
txt = p.read_text(encoding="utf-8")

if "class UserSession" in txt:
    print("SKIP: UserSession already present in models.py")
    sys.exit(0)

block = """
class UserSession(models.Model):
    \"\"\"Tracked sessions for a user (device/session management).\"\"\"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="siddes_sessions")
    session_key = models.CharField(max_length=40, unique=True)

    ip = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.CharField(max_length=256, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "last_seen_at"]),
        ]
""".strip() + "\n"

p.write_text(txt.rstrip() + "\n\n" + block, encoding="utf-8")
print("OK: patched", str(p))
PY

# -----------------------------------------------------------------------------
# Backend: migration (auto-pick next number)
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib, re, sys

migdir = pathlib.Path("backend/siddes_auth/migrations")
migdir.mkdir(parents=True, exist_ok=True)

existing = [p for p in migdir.glob("*.py") if p.name != "__init__.py"]
if any("user_session" in p.name for p in existing):
    print("SKIP: migration for user sessions appears to exist already")
    sys.exit(0)

nums = []
number_to_stems = {}
for p in existing:
    m = re.match(r"([0-9]{4})_(.+)[.]py$", p.name)
    if not m:
        continue
    n = int(m.group(1))
    nums.append(n)
    number_to_stems.setdefault(n, []).append(p.stem)

if nums:
    last = max(nums)
    last_stem = sorted(number_to_stems[last])[-1]
    nextn = last + 1
else:
    # fallback (should not happen in a real Django app)
    last_stem = "0001_initial"
    nextn = 2

fname = migdir / f"{nextn:04d}_user_sessions.py"

content = f'''from __future__ import annotations

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_auth", "{last_stem}"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_key", models.CharField(max_length=40, unique=True)),
                ("ip", models.CharField(blank=True, default="", max_length=64)),
                ("user_agent", models.CharField(blank=True, default="", max_length=256)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField(auto_now=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="siddes_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={{
                "indexes": [models.Index(fields=["user", "last_seen_at"], name="siddes_auth_usersess_user_lastseen_idx")],
            }},
        ),
    ]
'''
fname.write_text(content, encoding="utf-8")
print("OK: wrote", str(fname))
PY

# -----------------------------------------------------------------------------
# Backend: patch auth urls.py
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib, sys

p = pathlib.Path("backend/siddes_auth/urls.py")
txt = p.read_text(encoding="utf-8")
orig = txt

if "SessionsListView" not in txt:
    # add import
    if "from .sessions import" not in txt:
        txt = txt.replace("from django.urls import path\n", "from django.urls import path\n\nfrom .sessions import SessionsListView, SessionsRevokeView, SessionsLogoutAllView\n")
    else:
        pass

# add paths if missing
def ensure_path(line: str):
    nonlocal txt
    if line in txt:
        return
    # insert before closing ]
    if "urlpatterns" in txt and txt.strip().endswith("]"):
        txt = txt.rstrip()
        txt = txt[:-1].rstrip()  # remove trailing ]
        if not txt.endswith(","):
            txt += ","
        txt += "\n    " + line + "\n]"
    else:
        txt += "\n" + line + "\n"

ensure_path('path(\"sessions\", SessionsListView.as_view()),')
ensure_path('path(\"sessions/revoke\", SessionsRevokeView.as_view()),')
ensure_path('path(\"sessions/logout_all\", SessionsLogoutAllView.as_view()),')

if txt != orig:
    p.write_text(txt + ("\n" if not txt.endswith("\n") else ""), encoding="utf-8")
    print("OK: patched", str(p))
else:
    print("SKIP: urls.py already up to date")
PY

# -----------------------------------------------------------------------------
# Backend: patch settings.py (middleware + throttles)
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib, sys

p = pathlib.Path("backend/siddes_backend/settings.py")
txt = p.read_text(encoding="utf-8")
orig = txt

# Insert middleware after AuthenticationMiddleware
mw_line = '"siddes_auth.middleware.UserSessionCaptureMiddleware",'
if mw_line not in txt:
    anchor = '"django.contrib.auth.middleware.AuthenticationMiddleware",'
    if anchor in txt:
        txt = txt.replace(anchor, anchor + "\n    " + mw_line)
    else:
        print("WARN: Could not find AuthenticationMiddleware anchor; not inserting session middleware.")

# Add throttles (insert after auth_google)
if "auth_sessions_list" not in txt:
    anchor = '"auth_google": _env("SIDDES_THROTTLE_AUTH_GOOGLE", "30/min"),'
    insert = anchor + "\n\n        \"auth_sessions_list\": _env(\"SIDDES_THROTTLE_AUTH_SESSIONS_LIST\", \"60/min\"),\n        \"auth_sessions_revoke\": _env(\"SIDDES_THROTTLE_AUTH_SESSIONS_REVOKE\", \"30/min\"),\n        \"auth_sessions_logout_all\": _env(\"SIDDES_THROTTLE_AUTH_SESSIONS_LOGOUT_ALL\", \"5/min\"),"
    if anchor in txt:
        txt = txt.replace(anchor, insert)
    else:
        print("WARN: Could not find auth_google throttle anchor; throttles not inserted.")

if txt != orig:
    p.write_text(txt, encoding="utf-8")
    print("OK: patched", str(p))
else:
    print("SKIP: settings.py already up to date")
PY

# -----------------------------------------------------------------------------
# Docs: SESSIONS.md
# -----------------------------------------------------------------------------
cat > docs/SESSIONS.md <<'MD'
# Siddes — Device & Session Management (sd_322)

This workstream adds a minimal “security cockpit” for users:
- list active sessions/devices
- revoke a specific session
- log out other devices

## Backend

### Tracked session table
`siddes_auth.UserSession`
- `session_key` (unique)
- ip, user_agent
- created_at, last_seen_at
- revoked_at

### Middleware
`UserSessionCaptureMiddleware`
- updates last_seen at most once per 60 seconds
- if a session is marked revoked → force logout (deny-by-default)

### Endpoints
- `GET /api/auth/sessions`
- `POST /api/auth/sessions/revoke` body: `{ "id": <UserSession.id> }`
- `POST /api/auth/sessions/logout_all` body: `{ "includeCurrent": false }`

## Frontend
- `/siddes-profile/account/sessions`

## Notes
- For reverse proxies, IP is taken from `X-Forwarded-For` (first hop) when present.
- For global scale, consider moving session tracking updates to an async queue later.
MD
echo "OK: wrote docs/SESSIONS.md"

# -----------------------------------------------------------------------------
# Docs: STATE.md update
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib, sys

p = pathlib.Path("docs/STATE.md")
if not p.exists():
    print("SKIP: docs/STATE.md missing")
    sys.exit(0)

txt = p.read_text(encoding="utf-8")
if "sd_322:" in txt:
    print("SKIP: docs/STATE.md already mentions sd_322")
    sys.exit(0)

lines = txt.splitlines()
out = []
inserted = False
for line in lines:
    out.append(line)
    if (not inserted) and line.strip().startswith("- **sd_321:**"):
        out.append("- **sd_322:** Device/session management (session list + revoke + logout other devices)")
        inserted = True
if not inserted:
    out.append("")
    out.append("- **sd_322:** Device/session management (session list + revoke + logout other devices)")

p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("OK: patched", str(p))
PY

# -----------------------------------------------------------------------------
# Frontend: API routes
# -----------------------------------------------------------------------------
mkdir -p frontend/src/app/api/auth/sessions
cat > frontend/src/app/api/auth/sessions/route.ts <<'TS'
import { NextResponse } from "next/server";
import { proxyJson } from "../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/auth/sessions", "GET");
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
}
TS

mkdir -p frontend/src/app/api/auth/sessions/revoke
cat > frontend/src/app/api/auth/sessions/revoke/route.ts <<'TS'
import { NextResponse } from "next/server";
import { proxyJson } from "../../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/auth/sessions/revoke", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
}
TS

mkdir -p frontend/src/app/api/auth/sessions/logout_all
cat > frontend/src/app/api/auth/sessions/logout_all/route.ts <<'TS'
import { NextResponse } from "next/server";
import { proxyJson } from "../../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/auth/sessions/logout_all", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data } = out;
  return NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
}
TS

echo "OK: wrote frontend auth session routes"

# -----------------------------------------------------------------------------
# Frontend: sessions page
# -----------------------------------------------------------------------------
mkdir -p frontend/src/app/siddes-profile/account/sessions
cat > frontend/src/app/siddes-profile/account/sessions/page.tsx <<'TSX'
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SessionRow = {
  id: number;
  current: boolean;
  createdAt?: string | null;
  lastSeenAt?: string | null;
  ip: string;
  userAgent: string;
  revokedAt?: string | null;
};

function fmt(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function AccountSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const activeRows = useMemo(() => rows.filter((r) => !r.revokedAt), [rows]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => ({} as any));
      if (!me?.authenticated) {
        const next = encodeURIComponent("/siddes-profile/account/sessions");
        window.location.href = `/login?next=${next}`;
        return;
      }
      setAuthed(true);

      const res = await fetch("/api/auth/sessions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setRows((data.sessions || []) as SessionRow[]);
      } else {
        setMsg(data?.error ? String(data.error) : "Failed to load sessions");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(id: number) {
    if (busy) return;
    const ok = window.confirm("Revoke this session? That device will be logged out.");
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/sessions/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setMsg(data?.loggedOut ? "This session was revoked (you were logged out)." : "Session revoked.");
        if (data?.loggedOut) {
          window.location.href = "/login";
          return;
        }
        await load();
      } else {
        setMsg(data?.error ? String(data.error) : "Failed to revoke session");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function logoutOthers() {
    if (busy) return;
    const ok = window.confirm("Log out other devices? Your current session stays signed in.");
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/sessions/logout_all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ includeCurrent: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setMsg(`Logged out other devices. revoked=${data.revoked} scannedDeleted=${data.scannedDeleted}`);
        await load();
      } else {
        setMsg(data?.error ? String(data.error) : "Failed to logout other devices");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Devices & Sessions</div>
            <div className="text-xs text-gray-500 mt-1">See where your account is signed in</div>
          </div>

          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-gray-900">Active sessions</div>
            <button
              type="button"
              onClick={logoutOthers}
              disabled={busy || loading || !authed || activeRows.length <= 1}
              className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
            >
              {busy ? "Working…" : "Log out other devices"}
            </button>
          </div>

          {msg ? <div className="mt-2 text-sm text-gray-700 font-semibold">{msg}</div> : null}

          {loading ? (
            <div className="mt-3 text-sm text-gray-500">Loading…</div>
          ) : activeRows.length === 0 ? (
            <div className="mt-3 text-sm text-gray-500">No sessions found yet. Use the app, then refresh.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {activeRows.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-gray-900 truncate">
                        {r.userAgent || "Unknown device"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        IP: <span className="font-semibold text-gray-700">{r.ip || "—"}</span>
                        {" · "}Last seen: <span className="font-semibold text-gray-700">{fmt(r.lastSeenAt)}</span>
                        {" · "}Created: <span className="font-semibold text-gray-700">{fmt(r.createdAt)}</span>
                      </div>
                    </div>

                    {r.current ? (
                      <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-gray-200 bg-white text-gray-700">
                        This device
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => revoke(r.id)}
                        disabled={busy}
                        className="shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500">
            Tip: If you see a device you don’t recognize, revoke it immediately and change your password.
          </div>
        </div>
      </div>
    </div>
  );
}
TSX
echo "OK: wrote sessions page"

# -----------------------------------------------------------------------------
# Frontend: patch account page with a link card (if missing)
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib, sys

p = pathlib.Path("frontend/src/app/siddes-profile/account/page.tsx")
if not p.exists():
    print("SKIP: account page not found")
    sys.exit(0)

txt = p.read_text(encoding="utf-8")
if "/siddes-profile/account/sessions" in txt:
    print("SKIP: account page already links to sessions page")
    sys.exit(0)

# Insert after Settings card block
anchor = 'href="/siddes-settings"'
pos = txt.find(anchor)
if pos == -1:
    print("WARN: Could not find settings card anchor; not patching account page.")
    sys.exit(0)

close = txt.find("</Link>", pos)
if close == -1:
    print("WARN: Could not find end of settings Link; not patching account page.")
    sys.exit(0)

insert = """

          <Link
            href="/siddes-profile/account/sessions"
            className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-4"
          >
            <div className="text-sm font-extrabold text-gray-900">Devices & Sessions</div>
            <div className="text-xs text-gray-500 mt-1">Log out other devices</div>
          </Link>
"""

txt2 = txt[: close + len("</Link>") ] + insert + txt[close + len("</Link>") :]
p.write_text(txt2, encoding="utf-8")
print("OK: patched", str(p))
PY

echo ""
echo "== sd_322 applied =="
echo "Next (VS Code terminal):"
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "  (restart frontend dev server too)"
echo ""
echo "Open:"
echo "  http://localhost:3000/siddes-profile/account/sessions"
echo ""
